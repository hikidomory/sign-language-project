import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Hands } from '@mediapipe/hands';
import { Holistic } from '@mediapipe/holistic'; 
import { Camera } from '@mediapipe/camera_utils';

// 데이터 및 유틸리티 import
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

  // 🕒 턴 방식 상태 관리 (idle -> ready -> recording -> result)
  const [phase, setPhase] = useState('idle'); 
  const phaseRef = useRef('idle'); // onResults에서 최신 상태 참조용

  // 🎨 UI 오버레이 상태 (파이썬 코드 스타일)
  const [uiText, setUiText] = useState('');
  const [uiColor, setUiColor] = useState('rgba(0,0,0,0.5)');
  const [progress, setProgress] = useState(0);

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  
  const lastPredictionTime = useRef(0);
  const isPredicting = useRef(false);
  
  const targetLabelRef = useRef(null);
  const sequenceBuffer = useRef([]); // 90프레임 데이터 저장소
  const SEQ_LENGTH = 90; 

  // 🌟 탭 데이터 설정
  const currentData = useMemo(() => {
    if (activeTab === 'consonants') return consonants;
    if (activeTab === 'vowels') return vowels;
    if (activeTab === 'numbers') return numbers;
    if (activeTab === 'words') return words;
    
    if (activeTab === 'all') {
      const allData = [...consonants, ...vowels, ...numbers, ...words];
      // 랜덤 섞기
      for (let i = allData.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allData[i], allData[j]] = [allData[j], allData[i]];
      }
      return allData;
    }
    return [];
  }, [activeTab]);

  // 현재 정답 라벨
  const currentTargetLabel = useMemo(() => {
    if (!currentData[currentIndex]) return null;
    const label = currentData[currentIndex].label;
    return label.includes('(') ? label.split('(')[0].trim() : label.trim();
  }, [currentData, currentIndex]);

  // phase 상태 동기화 (Stale Closure 방지)
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // 문제가 바뀌면 초기화
  useEffect(() => {
    targetLabelRef.current = currentTargetLabel;
    setIsCorrect(null);
    setPredictionMsg("손을 보여주세요 👋");
    setUiText('');
    setProgress(0);
    sequenceBuffer.current = [];
    
    // 카메라가 켜져 있다면 준비 단계로 진입
    if (isCamOn) setPhase('ready');
  }, [currentTargetLabel]);

  // --- 🔄 턴(Turn) 기반 로직 (단어 연습용) ---
  useEffect(() => {
    if (!isCamOn) {
        setPhase('idle');
        setUiText('');
        return;
    }

    // 단어 모드인지 확인
    const isWordMode = activeTab === 'words' || (activeTab === 'all' && words.some(w => w.label === targetLabelRef.current));
    
    if (!isWordMode) {
        setPhase('idle');
        return;
    }

    let timeout;
    let interval;

    // 1. 준비 단계 (Get Ready... 1s)
    if (phase === 'ready') {
        setUiColor('rgba(255, 215, 0, 0.8)'); // Yellow (파이썬 box_color: (0, 255, 255))
        setUiText("Get Ready...");
        setPredictionMsg("준비하세요!");
        setProgress(0);
        sequenceBuffer.current = []; 
        
        timeout = setTimeout(() => {
            setPhase('recording');
        }, 1000); // 1.0초
    } 
    // 2. 촬영 단계 (Recording... 3s)
    else if (phase === 'recording') {
        setUiColor('rgba(255, 0, 0, 0.8)'); // Red (파이썬 box_color: (0, 0, 255))
        setUiText("Recording...");
        setPredictionMsg("동작을 보여주세요!");
        
        // 3초 타이머
        timeout = setTimeout(() => {
            handleRecordingEnd(); 
        }, 3000); 
    } 
    // 3. 결과 단계 (Result... 5s)
    else if (phase === 'result') {
        // 색상은 결과에 따라 handleRecordingEnd에서 설정됨 (Green/Grey)
        
        // 파이썬 코드의 RESULT_TIME = 5.0 반영
        timeout = setTimeout(() => {
            if (isCorrect) {
                 // 정답이면 사용자가 넘길 때까지 대기
            } else {
                setPhase('ready'); // 틀리면 다시 준비 단계로
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
    // 데이터가 없으면 에러 처리
    if (sequenceBuffer.current.length === 0) {
        setPredictionMsg("데이터가 없습니다. (인식 실패)");
        setUiText("No Data");
        setUiColor('rgba(128, 128, 128, 0.8)');
        setPhase('result');
        return;
    }

    // 데이터 길이 맞추기 (90개로 Sampling 또는 Padding)
    const rawData = sequenceBuffer.current;
    let processedData = [];

    if (rawData.length >= SEQ_LENGTH) {
        // 데이터가 많으면 뒤에서부터 90개 자르기
        processedData = rawData.slice(-SEQ_LENGTH);
    } else {
        // 데이터가 부족하면 마지막 프레임 복사해서 채우기
        processedData = [...rawData];
        const lastFrame = rawData[rawData.length - 1];
        while (processedData.length < SEQ_LENGTH) {
            processedData.push(lastFrame);
        }
    }

    setPredictionMsg("분석 중...");
    predictSign(processedData, 'word', targetLabelRef.current);
    
    setPhase('result');
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
          setUiText(`${predicted.toUpperCase()} !!`);
          setUiColor('rgba(0, 255, 0, 0.8)'); // Green
          setIsCorrect(true);
        } else {
          setPredictionMsg(`틀렸습니다 (인식: ${predicted})`);
          if (predicted === 'standby' || predicted === '대기') {
             setUiText("STANDBY (대기)");
             setUiColor('rgba(128, 128, 128, 0.8)'); // Grey
          } else {
             setUiText(`${predicted.toUpperCase()} !!`);
             setUiColor('rgba(255, 0, 0, 0.8)'); // Red (오답 표시)
          }
          setIsCorrect(false);
        }
      }
    } catch (error) {
      console.error(error);
      setPredictionMsg("서버 연결 실패");
      setUiText("ERROR");
      setUiColor('rgba(128, 128, 128, 0.8)');
    } finally {
      isPredicting.current = false;
    }
  };

  // --- MediaPipe 설정 ---
  useEffect(() => {
    let detector = null;
    let camera = null;

    if (isCamOn) {
      // 현재 모드 확인
      const isWordMode = activeTab === 'words' || (activeTab === 'all' && words.some(w => w.label === targetLabelRef.current));

      if (isWordMode) {
        // [Holistic] 단어 연습용
        console.log("Loading Holistic Model...");
        detector = new Holistic({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
        });
        detector.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      } else {
        // [Hands] 기존 연습용
        console.log("Loading Hands Model...");
        detector = new Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });
        detector.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      }

      detector.onResults(onResults);

      if (videoRef.current) {
        camera = new Camera(videoRef.current, {
          onFrame: async () => {
            if (isCamOn && videoRef.current) {
              await detector.send({ image: videoRef.current });
            }
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

  // --- onResults (화면 그리기 및 데이터 수집) ---
  const onResults = (results) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    
    ctx.save();
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    // 🌟 캔버스 좌우 반전 (거울 모드)
    ctx.translate(canvasRef.current.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);

    if (isCorrect) { ctx.restore(); return; }

    const isWordMode = activeTab === 'words' || (activeTab === 'all' && words.some(w => w.label === targetLabelRef.current));

    if (isWordMode) {
        // 🟢 [단어 모드] recording 상태일 때만 데이터 수집
        if (phaseRef.current === 'recording') {
            const features = extractHolisticFeatures(results);
            sequenceBuffer.current.push(features);
            
            // 진행률 업데이트 (UI 표시용)
            const currentLen = sequenceBuffer.current.length;
            const pct = Math.min(100, Math.floor((currentLen / SEQ_LENGTH) * 100));
            // 성능을 위해 5프레임마다 상태 업데이트
            if (currentLen % 5 === 0) setProgress(pct); 

            // 녹화 중일 때 빨간 테두리
            ctx.strokeStyle = "red";
            ctx.lineWidth = 10;
            ctx.strokeRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    } else {
        // 🔵 [기존 모드] 실시간 인식
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
          {/* 문제 이미지 카드 */}
          <div className="study-card">
             <div className="card-img-wrapper">
                {currentData[currentIndex] && <img src={currentData[currentIndex].img} alt="문제" />}
             </div>
             <div className="card-text">{currentData[currentIndex]?.label}</div>
          </div>

          {/* 웹캠 및 결과 카드 */}
          <div className="study-card webcam-card">
            <div className="card-img-wrapper" style={{ position: 'relative' }}>
               <video ref={videoRef} style={{display:'none'}}></video>
               <canvas ref={canvasRef} className="output_canvas" width={640} height={480}></canvas>
               
               {/* 🎨 UI 오버레이 (단어 모드 + 카메라 켜짐 + idle 아닐 때) */}
               {isCamOn && phase !== 'idle' && (activeTab === 'words' || (activeTab === 'all' && words.some(w => w.label === targetLabelRef.current))) && (
                 <>
                   {/* 상단 상태 바 */}
                   <div style={{
                      position: 'absolute', top: 0, left: 0, width: '100%', height: '60px',
                      backgroundColor: uiColor, display: 'flex', alignItems: 'center', paddingLeft: '20px',
                      transition: 'background-color 0.3s'
                   }}>
                      <span style={{ color: 'white', fontSize: '1.5rem', fontWeight: 'bold', textShadow: '1px 1px 2px black' }}>
                        {phase === 'recording' ? `${uiText} ${progress}%` : uiText}
                      </span>
                   </div>

                   {/* 진행률 바 (녹화 중일 때만) */}
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