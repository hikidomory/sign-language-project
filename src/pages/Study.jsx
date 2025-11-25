// src/pages/Study.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Hands } from '@mediapipe/hands';
import { Holistic } from '@mediapipe/holistic'; 
import { Camera } from '@mediapipe/camera_utils';

import { consonants, vowels, numbers, words } from '../data/modelData'; 
import { toXY, extractFeatures, extractHolisticFeatures } from '../utils/handUtils';
import './Study.css';

const API_URL = "http://localhost:8000/predict"; 

const Study = () => {
  // --- 상태 관리 ---
  const [activeTab, setActiveTab] = useState('consonants');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCamOn, setIsCamOn] = useState(false);
  const [predictionMsg, setPredictionMsg] = useState("카메라를 켜주세요");
  const [isCorrect, setIsCorrect] = useState(null);

  // 🕒 턴 방식 상태 관리 (단어 연습용)
  // phase: 'idle' | 'ready' (1초) | 'recording' (3초) | 'result' (3초)
  const [phase, setPhase] = useState('idle'); 
  const [timer, setTimer] = useState(0); // 화면에 보여줄 남은 시간

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  
  const lastPredictionTime = useRef(0);
  const isPredicting = useRef(false);
  
  const targetLabelRef = useRef(null);

  // ✅ 시퀀스 데이터 버퍼
  const sequenceBuffer = useRef([]); 
  const SEQ_LENGTH = 90; // 모델 입력 길이

  // 🌟 탭 데이터 설정
  const currentData = useMemo(() => {
    if (activeTab === 'consonants') return consonants;
    if (activeTab === 'vowels') return vowels;
    if (activeTab === 'numbers') return numbers;
    if (activeTab === 'words') return words;
    
    if (activeTab === 'all') {
      const allData = [...consonants, ...vowels, ...numbers, ...words];
      for (let i = allData.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allData[i], allData[j]] = [allData[j], allData[i]];
      }
      return allData;
    }
    return [];
  }, [activeTab]);

  const currentTargetLabel = useMemo(() => {
    if (!currentData[currentIndex]) return null;
    const label = currentData[currentIndex].label;
    return label.includes('(') ? label.split('(')[0].trim() : label.trim();
  }, [currentData, currentIndex]);

  useEffect(() => {
    targetLabelRef.current = currentTargetLabel;
    setIsCorrect(null);
    setPredictionMsg("손을 보여주세요 👋");
    
    // 문제가 바뀌면 턴 초기화
    if (isCamOn) setPhase('ready');
  }, [currentTargetLabel]);

  // --- 🔄 턴(Turn) 기반 게임 루프 (단어 모드용) ---
  useEffect(() => {
    if (!isCamOn) {
        setPhase('idle');
        return;
    }

    const isWordMode = activeTab === 'words' || (activeTab === 'all' && words.some(w => w.label === targetLabelRef.current));
    
    // 단어 모드가 아니면 루프 실행 안함 (실시간 모드)
    if (!isWordMode) {
        setPhase('idle');
        return;
    }

    let timeout;

    // 1. 준비 단계 (1초)
    if (phase === 'ready') {
        setPredictionMsg("준비... 1초 뒤 시작!");
        setTimer(1);
        sequenceBuffer.current = []; // 버퍼 초기화
        timeout = setTimeout(() => {
            setPhase('recording');
        }, 1000);
    } 
    // 2. 촬영 단계 (3초)
    else if (phase === 'recording') {
        setPredictionMsg("🎬 촬영 중! 동작을 보여주세요");
        setTimer(3);
        // 3초 후 결과 단계로 이동
        timeout = setTimeout(() => {
            handleRecordingEnd(); // 촬영 종료 처리 및 서버 전송
        }, 3000);
    } 
    // 3. 결과 확인 단계 (3초)
    else if (phase === 'result') {
        // (handleRecordingEnd에서 설정한 결과 메시지가 떠 있는 상태)
        setTimer(3);
        timeout = setTimeout(() => {
            // 정답을 맞췄으면 멈춤, 아니면 다시 준비 단계로
            if (isCorrect) {
                // 정답 상태 유지 (사용자가 다음 버튼 누를 때까지)
            } else {
                setPhase('ready'); // 다시 도전
            }
        }, 3000);
    }
    // 초기 진입
    else if (phase === 'idle') {
        setPhase('ready');
    }

    return () => clearTimeout(timeout);
  }, [phase, isCamOn, activeTab, isCorrect, currentTargetLabel]); // 의존성 배열 주의

  // --- 촬영 종료 및 데이터 전송 처리 ---
  const handleRecordingEnd = () => {
    // 1. 데이터가 있는지 확인
    if (sequenceBuffer.current.length === 0) {
        setPredictionMsg("데이터가 없습니다.");
        setPhase('result');
        return;
    }

    // 2. 데이터 길이 맞추기 (Resampling)
    // 웹캠 FPS에 따라 3초 동안 90개가 안 될 수도, 넘을 수도 있음.
    // 모델은 정확히 90개를 원하므로 길이를 맞춥니다.
    const rawData = sequenceBuffer.current;
    let processedData = [];

    if (rawData.length >= SEQ_LENGTH) {
        // 너무 많으면: 뒤에서부터 90개 자르기 (혹은 균등 추출)
        // 여기서는 가장 최근 동작이 중요하므로 뒤에서 90개
        processedData = rawData.slice(-SEQ_LENGTH);
    } else {
        // 너무 적으면: 마지막 프레임 복사해서 채우기 (Padding)
        processedData = [...rawData];
        const lastFrame = rawData[rawData.length - 1];
        while (processedData.length < SEQ_LENGTH) {
            processedData.push(lastFrame);
        }
    }

    // 3. 서버 전송
    setPredictionMsg("분석 중... 🤔");
    predictSign(processedData, 'word', targetLabelRef.current);
    
    setPhase('result');
  };

  // --- MediaPipe 설정 ---
  useEffect(() => {
    let detector = null;
    let camera = null;

    if (isCamOn) {
      const isWordMode = activeTab === 'words' || (activeTab === 'all' && words.some(w => w.label === targetLabelRef.current));

      if (isWordMode) {
        console.log("Loading Holistic Model (Turn Based)...");
        detector = new Holistic({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
        });
        detector.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      } else {
        console.log("Loading Hands Model (Realtime)...");
        detector = new Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });
        detector.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      }

      detector.onResults(onResults);

      if (videoRef.current) {
        camera = new Camera(videoRef.current, {
          onFrame: async () => {
            if (isCamOn && videoRef.current) await detector.send({ image: videoRef.current });
          },
          width: 640,
          height: 480,
        });
        cameraRef.current = camera;
        camera.start();
      }
    }

    return () => {
      if (cameraRef.current) { cameraRef.current.stop(); cameraRef.current = null; }
      if (detector) detector.close();
    };
  }, [isCamOn, activeTab, currentTargetLabel]);

  // --- onResults (데이터 수집) ---
  const onResults = (results) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    
    ctx.save();
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);

    // 정답 맞춘 상태면 그리기만 하고 로직 종료
    if (isCorrect) { ctx.restore(); return; }

    const isWordMode = activeTab === 'words' || (activeTab === 'all' && words.some(w => w.label === targetLabelRef.current));

    if (isWordMode) {
        // 🟢 [단어 모드] 'recording' 상태일 때만 데이터 수집
        if (phase === 'recording') {
            const features = extractHolisticFeatures(results);
            sequenceBuffer.current.push(features);
            
            // 시각적 피드백: 녹화 중일 때 테두리 표시 등
            ctx.strokeStyle = "red";
            ctx.lineWidth = 5;
            ctx.strokeRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    } else {
        // 🔵 [기존 모드] 실시간 Hands
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const now = Date.now();
            if (now - lastPredictionTime.current > 1000 && !isPredicting.current && targetLabelRef.current) {
                lastPredictionTime.current = now;
                const features = extractFeatures(toXY(results.multiHandLandmarks[0]));
                const modelKey = /^[0-9]+$/.test(targetLabelRef.current) ? 'digit' : 'hangul';
                predictSign(features, modelKey, targetLabelRef.current);
            }
        }
    }
    ctx.restore();
  };

  // --- 예측 요청 함수 ---
  const predictSign = async (features, modelKey, expectedLabel) => {
    if (isPredicting.current) return;
    try {
      isPredicting.current = true;
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_key: modelKey, features: features }),
      });

      if (response.ok) {
        const data = await response.json();
        const predicted = String(data.label).trim().normalize("NFKC");
        const target = String(expectedLabel).trim().normalize("NFKC");
        const confidence = data.confidence || 0;

        console.log(`[판정] AI:${predicted} (${(confidence*100).toFixed(1)}%) vs 정답:${target}`);

        if (predicted === target) {
          setPredictionMsg(`정답입니다! 🎉 (${predicted})`);
          setIsCorrect(true);
        } else {
          setPredictionMsg(`틀렸습니다 (인식: ${predicted})`);
          setIsCorrect(false);
        }
      }
    } catch (error) {
      console.error(error);
      setPredictionMsg("서버 연결 실패");
    } finally {
      isPredicting.current = false;
    }
  };

  // --- 핸들러 ---
  const handleTabChange = (tab) => { setActiveTab(tab); setCurrentIndex(0); setPhase('idle'); };
  const handlePrev = () => { setCurrentIndex(prev => prev === 0 ? currentData.length - 1 : prev - 1); setPhase('ready'); };
  const handleNext = () => { setCurrentIndex(prev => prev === currentData.length - 1 ? 0 : prev + 1); setPhase('ready'); };

  return (
    <div className="study-container">
      <h1 className="title">수어 배움터</h1>
      <nav className="study-tabs">
        {['consonants', 'vowels', 'numbers', 'words', 'all'].map(tab => (
          <button key={tab} className={`tab-button ${activeTab === tab ? 'active' : ''}`} onClick={() => handleTabChange(tab)}>
            {tab === 'consonants' ? '자음' : tab === 'vowels' ? '모음' : tab === 'numbers' ? '숫자' : tab === 'words' ? '단어' : '전체'}
          </button>
        ))}
      </nav>
      <button className={`cam-toggle-btn ${isCamOn ? 'on' : ''}`} onClick={() => setIsCamOn(!isCamOn)}>
        {isCamOn ? '카메라 끄기' : '카메라 켜기'}
      </button>

      <div className="study-content-wrapper">
        <button className="nav-btn prev" onClick={handlePrev}>◀</button>
        <div className="display-area">
          <div className="study-card">
             <div className="card-img-wrapper">
                {currentData[currentIndex] && <img src={currentData[currentIndex].img} alt="문제" />}
             </div>
             <div className="card-text">{currentData[currentIndex]?.label}</div>
          </div>
          <div className="study-card webcam-card">
            <div className="card-img-wrapper">
               <video ref={videoRef} style={{display:'none'}}></video>
               <canvas ref={canvasRef} className="output_canvas" width={640} height={480}></canvas>
               
               {/* 🕒 타이머/상태 오버레이 (단어 모드일 때만 표시) */}
               {isCamOn && (activeTab === 'words' || (activeTab === 'all' && words.some(w => w.label === targetLabelRef.current))) && (
                 <div style={{
                    position: 'absolute', top: 10, right: 10, 
                    backgroundColor: phase === 'recording' ? 'red' : 'rgba(0,0,0,0.5)', 
                    color: 'white', padding: '5px 10px', borderRadius: 5, fontWeight: 'bold'
                 }}>
                    {phase === 'ready' ? '준비' : phase === 'recording' ? 'REC ●' : '결과'}
                 </div>
               )}
            </div>
            <div className={`card-text result ${isCorrect === true ? 'success' : isCorrect === false ? 'fail' : ''}`}>
               {predictionMsg}
            </div>
          </div>
        </div>
        <button className="nav-btn next" onClick={handleNext}>▶</button>
      </div>
    </div>
  );
};

export default Study;