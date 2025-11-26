import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Hands } from '@mediapipe/hands';
import { Holistic } from '@mediapipe/holistic'; 
import { Camera } from '@mediapipe/camera_utils';

// 데이터 및 유틸리티 import
import { consonants, vowels, numbers, words } from '../data/modelData'; 
import { toXY, extractFeatures, extractHolisticFeatures } from '../utils/handUtils';
import './Study.css';

// 🟢 배포된 ngrok 주소 확인 필수!
const API_URL = "http://localhost:8000/predict"; 

const Study = () => {
  // --- 상태 관리 ---
  const [activeTab, setActiveTab] = useState('consonants');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCamOn, setIsCamOn] = useState(false);
  const [predictionMsg, setPredictionMsg] = useState("카메라를 켜주세요");
  const [isCorrect, setIsCorrect] = useState(null);

  // 🕒 턴 방식 상태 관리
  const [phase, setPhase] = useState('idle'); 
  const phaseRef = useRef('idle'); 

  // 🎨 UI 오버레이 상태
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
  const sequenceBuffer = useRef([]); 
  const SEQ_LENGTH = 90; 

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
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    targetLabelRef.current = currentTargetLabel;
    setIsCorrect(null);
    setPredictionMsg("손을 보여주세요 👋");
    setUiText('');
    setProgress(0);
    sequenceBuffer.current = [];
    
    if (isCamOn) setPhase('ready');
  }, [currentTargetLabel]);

  // --- 🔄 턴(Turn) 기반 로직 ---
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

    // 1. 준비 단계 (1s)
    if (phase === 'ready') {
        setUiColor('rgba(255, 215, 0, 0.8)'); 
        setUiText("Get Ready...");
        setPredictionMsg("준비하세요!");
        setProgress(0);
        sequenceBuffer.current = []; 
        
        timeout = setTimeout(() => {
            setPhase('recording');
        }, 1000); 
    } 
    // 2. 촬영 단계 (3s)
    else if (phase === 'recording') {
        setUiColor('rgba(30, 144, 255, 0.8)'); 
        setUiText("Recording...");
        setPredictionMsg("동작을 보여주세요!");
        
        timeout = setTimeout(() => {
            handleRecordingEnd(); 
        }, 3000); 
    } 
    // 3. 결과 단계 (5s)
    else if (phase === 'result') {
        timeout = setTimeout(() => {
            if (isCorrect) {
                 // 정답 시 대기
            } else {
                setPhase('ready'); 
            }
        }, 5000);
    }
    else if (phase === 'idle') {
        setPhase('ready');
    }

    return () => clearTimeout(timeout);
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
          setUiColor('rgba(46, 125, 50, 0.9)'); 
          setIsCorrect(true);
        } else {
          setPredictionMsg(`틀렸습니다 (인식: ${predicted})`);
          if (predicted === 'standby' || predicted === '대기') {
             setUiText("STANDBY (대기)");
             setUiColor('rgba(128, 128, 128, 0.8)'); 
          } else {
             setUiText(`${predicted.toUpperCase()} !!`);
             setUiColor('rgba(255, 140, 0, 0.8)'); 
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
      const isWordMode = activeTab === 'words' || (activeTab === 'all' && words.some(w => w.label === targetLabelRef.current));

      if (isWordMode) {
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

  // --- onResults ---
  const onResults = (results) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    
    ctx.save();
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    // CSS로 좌우반전 처리됨 (정방향 그리기)
    ctx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);

    if (isCorrect) { ctx.restore(); return; }

    const isWordMode = activeTab === 'words' || (activeTab === 'all' && words.some(w => w.label === targetLabelRef.current));

    if (isWordMode) {
        if (phaseRef.current === 'recording') {
            const features = extractHolisticFeatures(results);
            sequenceBuffer.current.push(features);
            
            const currentLen = sequenceBuffer.current.length;
            const pct = Math.min(100, Math.floor((currentLen / SEQ_LENGTH) * 100));
            if (currentLen % 5 === 0) setProgress(pct); 

            ctx.strokeStyle = "rgba(30, 144, 255, 0.8)";
            ctx.lineWidth = 10;
            ctx.strokeRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    } else {
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

  const currentItem = currentData[currentIndex];

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
          {/* 🌟 왼쪽 카드: 비디오/이미지 + 출처 표시 */}
          <div className="study-card">
             <div className="card-img-wrapper" style={{ position: 'relative' }}>
                {currentItem && (
                  <>
                    {currentItem.video ? (
                      <video 
                        src={currentItem.video} 
                        autoPlay loop muted playsInline controls 
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <img src={currentItem.img} alt="문제" />
                    )}

                    {/* ✅ [추가됨] 출처 오버레이 (비디오일 때만) */}
                    {currentItem.video && (
                      <span style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        fontSize: '0.75rem',
                        color: '#666',
                        backgroundColor: 'rgba(255, 255, 255, 0.85)',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        pointerEvents: 'none', // 클릭 통과
                        zIndex: 10,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        fontWeight: 'bold'
                      }}>
                        출처: 국립국어원 한국수어사전
                      </span>
                    )}
                  </>
                )}
             </div>
             <div className="card-text">{currentItem?.label}</div>
          </div>

          {/* 오른쪽 카드: 웹캠 */}
          <div className="study-card webcam-card">
            <div className="card-img-wrapper" style={{ position: 'relative' }}>
               <video ref={videoRef} style={{display:'none'}}></video>
               <canvas ref={canvasRef} className="output_canvas" width={640} height={480}></canvas>
               
               {/* UI 오버레이 */}
               {isCamOn && phase !== 'idle' && (activeTab === 'words' || (activeTab === 'all' && words.some(w => w.label === targetLabelRef.current))) && (
                 <>
                   <div style={{
                      position: 'absolute', top: 0, left: 0, width: '100%', height: '60px',
                      backgroundColor: uiColor, display: 'flex', alignItems: 'center', paddingLeft: '20px',
                      transition: 'background-color 0.3s'
                   }}>
                      <span style={{ color: 'white', fontSize: '1.5rem', fontWeight: 'bold', textShadow: '1px 1px 2px black' }}>
                        {phase === 'recording' ? `${uiText} ${progress}%` : uiText}
                      </span>
                   </div>

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