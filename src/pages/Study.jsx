// src/pages/Study.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Hands } from '@mediapipe/hands';
import { Holistic } from '@mediapipe/holistic'; 
import { Camera } from '@mediapipe/camera_utils';

import { consonants, vowels, numbers, words } from '../data/modelData'; 
import { toXY, extractFeatures, extractHolisticFeatures } from '../utils/handUtils';
import './Study.css';

const API_URL = "https://itzel-unaching-unexceptionally.ngrok-free.dev/predict";

const Study = () => {
  // --- 상태 관리 ---
  const [activeTab, setActiveTab] = useState('consonants');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCamOn, setIsCamOn] = useState(false);
  const [predictionMsg, setPredictionMsg] = useState("카메라를 켜주세요");
  const [isCorrect, setIsCorrect] = useState(null);

  // 🕒 턴 방식 상태 관리
  const [phase, setPhase] = useState('idle'); 
  const [timer, setTimer] = useState(0); 
  const phaseRef = useRef('idle'); // Stale Closure 방지

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  
  const lastPredictionTime = useRef(0);
  const isPredicting = useRef(false);
  
  const targetLabelRef = useRef(null);
  const sequenceBuffer = useRef([]); 
  const SEQ_LENGTH = 90; 

  // 🎨 UI용 상태 (파이썬 코드의 box_color, display_text 반영)
  const [uiColor, setUiColor] = useState('rgba(0,0,0,0.5)'); // 기본값
  const [uiText, setUiText] = useState('');
  const [progress, setProgress] = useState(0); // 녹화 진행률

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

  // phaseRef 동기화
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // 문제 변경 시 초기화
  useEffect(() => {
    targetLabelRef.current = currentTargetLabel;
    setIsCorrect(null);
    setPredictionMsg("손을 보여주세요 👋");
    setProgress(0);
    
    if (isCamOn) setPhase('ready');
  }, [currentTargetLabel]);

  // --- 🔄 턴(Turn) 기반 로직 (파이썬 코드 적극 반영) ---
  useEffect(() => {
    if (!isCamOn) {
        setPhase('idle');
        setUiText('');
        return;
    }

    const isWordMode = activeTab === 'words' || (activeTab === 'all' && words.some(w => w.label === targetLabelRef.current));
    
    if (!isWordMode) {
        setPhase('idle');
        return;
    }

    let timeout;
    let interval;

    // 1. 준비 단계 (Get Ready... 1s)
    if (phase === 'ready') {
        setUiColor('rgba(255, 215, 0, 0.8)'); // Yellow (파이썬 box_color)
        setUiText("Get Ready...");
        setPredictionMsg("준비하세요!");
        setProgress(0);
        sequenceBuffer.current = []; 
        
        // 1초 카운트다운
        let count = 1;
        setTimer(count);
        interval = setInterval(() => {
            count -= 0.1;
            if (count <= 0) clearInterval(interval);
        }, 100);

        timeout = setTimeout(() => {
            setPhase('recording');
        }, 1000); // 1.0초
    } 
    // 2. 촬영 단계 (Recording... 3s)
    else if (phase === 'recording') {
        setUiColor('rgba(255, 0, 0, 0.8)'); // Red (파이썬 box_color)
        setUiText("Recording...");
        setPredictionMsg("동작을 보여주세요!");
        
        // 3초 타이머
        timeout = setTimeout(() => {
            handleRecordingEnd(); 
        }, 3000); // 3.0초 (seq_length=90 @ 30fps 가정)
    } 
    // 3. 결과 단계 (Result... 5s)
    else if (phase === 'result') {
        // 색상은 결과에 따라 handleRecordingEnd에서 설정됨 (Green/Grey)
        
        // ✅ [수정] 파이썬 코드의 RESULT_TIME = 5.0 반영
        timeout = setTimeout(() => {
            if (isCorrect) {
                 // 정답이면 대기 (사용자가 넘길 때까지)
            } else {
                setPhase('ready'); // 틀리면 다시 준비
            }
        }, 5000); // 5.0초
    }
    // 초기 진입
    else if (phase === 'idle') {
        setPhase('ready');
    }

    return () => {
        clearTimeout(timeout);
        clearInterval(interval);
    };
  }, [phase, isCamOn, activeTab, isCorrect, currentTargetLabel]);

  // --- 촬영 종료 및 데이터 전송 ---
  const handleRecordingEnd = () => {
    if (sequenceBuffer.current.length === 0) {
        setPredictionMsg("데이터가 없습니다.");
        setUiText("No Data");
        setUiColor('rgba(128, 128, 128, 0.8)');
        setPhase('result');
        return;
    }

    // 데이터 길이 맞추기 (90개)
    const rawData = sequenceBuffer.current;
    let processedData = [];

    if (rawData.length >= SEQ_LENGTH) {
        processedData = rawData.slice(-SEQ_LENGTH);
    } else {
        processedData = [...rawData];
        const lastFrame = rawData[rawData.length - 1];
        while (processedData.length < SEQ_LENGTH) {
            processedData.push(lastFrame);
        }
    }
console.log("훔칠 데이터:", JSON.stringify(processedData));
    setPredictionMsg("분석 중...");
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
        detector = new Holistic({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
        });
        detector.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      } else {
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

  // --- onResults ---
  const onResults = (results) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    
    ctx.save();
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    // 🌟 [거울 모드] 좌우 반전
    ctx.translate(canvasRef.current.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);

    if (isCorrect) { ctx.restore(); return; }

    const isWordMode = activeTab === 'words' || (activeTab === 'all' && words.some(w => w.label === targetLabelRef.current));

    if (isWordMode) {
        if (phaseRef.current === 'recording') {
            const features = extractHolisticFeatures(results);
            sequenceBuffer.current.push(features);
            
            // 진행률 업데이트 (UI용)
            // 파이썬 로직: len(sequence) / seq_length
            const currentLen = sequenceBuffer.current.length;
            const pct = Math.min(100, Math.round((currentLen / SEQ_LENGTH) * 100));
            // React 상태 업데이트는 비동기라 렌더링 사이클에 맡김 (성능 고려)
            // 여기서는 실시간성을 위해 직접 그리지 않고 상태만 업데이트하거나 
            // 캔버스에 직접 그리는 방식이 좋음. 아래는 상태 업데이트 방식.
            if (currentLen % 5 === 0) setProgress(pct); 
            
            // 녹화 중 테두리 (Red)
            ctx.strokeStyle = "red";
            ctx.lineWidth = 10;
            ctx.strokeRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    } else {
        // 기존 Hands 모드
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

  // --- 예측 요청 ---
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
          setUiText(`${predicted.toUpperCase()} !!`);
          setUiColor('rgba(0, 255, 0, 0.8)'); // Green
          setIsCorrect(true);
        } else {
          setPredictionMsg(`틀렸습니다 (인식: ${predicted})`);
          if (predicted === 'standby') {
             setUiText("STANDBY (대기)");
             setUiColor('rgba(128, 128, 128, 0.8)'); // Grey
          } else {
             setUiText(`${predicted.toUpperCase()} !!`);
             setUiColor('rgba(255, 0, 0, 0.8)'); // Red (오답 표시용, 파이썬엔 없지만 추가)
          }
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
            <div className="card-img-wrapper" style={{ position: 'relative' }}>
               <video ref={videoRef} style={{display:'none'}}></video>
               <canvas ref={canvasRef} className="output_canvas" width={640} height={480}></canvas>
               
               {/* 🎨 파이썬 스타일 UI 오버레이 */}
               {isCamOn && (activeTab === 'words' || (activeTab === 'all' && words.some(w => w.label === targetLabelRef.current))) && phase !== 'idle' && (
                 <>
                   {/* 상단 박스 */}
                   <div style={{
                      position: 'absolute', top: 0, left: 0, width: '100%', height: '60px',
                      backgroundColor: uiColor, display: 'flex', alignItems: 'center', paddingLeft: '20px',
                      transition: 'background-color 0.3s'
                   }}>
                      <span style={{ color: 'white', fontSize: '1.5rem', fontWeight: 'bold', textShadow: '1px 1px 2px black' }}>
                        {phase === 'recording' ? `${uiText} ${progress}%` : uiText}
                      </span>
                   </div>

                   {/* 진행률 바 (녹화 중일 때) */}
                   {phase === 'recording' && (
                     <div style={{
                       position: 'absolute', top: '55px', left: 0, height: '5px',
                       width: `${progress}%`, backgroundColor: 'white', transition: 'width 0.1s linear'
                     }}></div>
                   )}
                 </>
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