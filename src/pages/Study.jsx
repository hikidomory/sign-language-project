// src/pages/Study.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Hands } from '@mediapipe/hands';
import { Holistic } from '@mediapipe/holistic'; // ✅ [추가] 몸 전체 인식 모델
import { Camera } from '@mediapipe/camera_utils';

// ✅ [추가] words 데이터 import
import { consonants, vowels, numbers, words } from '../data/modelData'; 
// ✅ [추가] extractHolisticFeatures 함수 import
import { toXY, extractFeatures, extractHolisticFeatures } from '../utils/handUtils';
import './Study.css';

// 로컬 파이썬 서버 주소 (ngrok 사용 시 해당 주소로 변경 필요)
const API_URL = "https://itzel-unaching-unexceptionally.ngrok-free.dev/predict";

const Study = () => {
  // --- 상태 관리 ---
  const [activeTab, setActiveTab] = useState('consonants');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCamOn, setIsCamOn] = useState(false);
  const [predictionMsg, setPredictionMsg] = useState("AI 모델 준비 중...");
  const [isCorrect, setIsCorrect] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  
  const lastPredictionTime = useRef(0);
  const isPredicting = useRef(false);
  
  // 🛠️ Stale Closure 방지용 Ref (최신 정답 참조)
  const targetLabelRef = useRef(null);

  // ✅ [추가] 시퀀스 데이터 버퍼 (단어 모델용 90프레임)
  const sequenceBuffer = useRef([]); 
  const SEQ_LENGTH = 90; 

  // 🌟 탭 데이터 설정
  const currentData = useMemo(() => {
    if (activeTab === 'consonants') return consonants;
    if (activeTab === 'vowels') return vowels;
    if (activeTab === 'numbers') return numbers;
    if (activeTab === 'words') return words; // ✅ 단어 데이터 반환
    
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

  // 🎯 현재 정답 라벨 계산
  const currentTargetLabel = useMemo(() => {
    if (!currentData[currentIndex]) return null;
    const label = currentData[currentIndex].label;
    return label.includes('(') ? label.split('(')[0].trim() : label.trim();
  }, [currentData, currentIndex]);

  // 정답이 바뀌면 Ref 업데이트 및 상태 초기화
  useEffect(() => {
    targetLabelRef.current = currentTargetLabel;
    sequenceBuffer.current = []; // 문제 바뀌면 버퍼 비우기
    setIsCorrect(null);
    setPredictionMsg("손을 보여주세요 👋");
  }, [currentTargetLabel]);

  // --- MediaPipe 설정 (Hands & Holistic 분기 처리) ---
  useEffect(() => {
    let detector = null;
    let camera = null;

    if (isCamOn) {
      // ✅ 현재 풀어야 할 문제가 '단어'인지 확인
      const isWordMode = activeTab === 'words' || (activeTab === 'all' && words.some(w => w.label === targetLabelRef.current));

      if (isWordMode) {
        // 1. [Holistic 모드] 단어 연습용 (몸+손 전체)
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
        // 2. [Hands 모드] 자음/모음/숫자 연습용 (손만 인식 - 기존 유지)
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
        setPredictionMsg("손을 보여주세요 👋");
      }
    } else {
      setPredictionMsg("AI 모델 준비 중...");
      setIsCorrect(null);
    }

    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
        cameraRef.current = null;
      }
      if (detector) detector.close();
    };
  }, [isCamOn, activeTab, currentTargetLabel]); // 문제가 바뀔 때(all 탭) 모델 전환을 위해 currentTargetLabel 의존성 추가

  // --- 결과 처리 ---
  const onResults = (results) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    
    ctx.save();
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);
    
    // 정답을 맞췄다면 중단
    if (isCorrect) {
      ctx.restore();
      return; 
    }

    // 현재 모드 확인
    const isWordMode = activeTab === 'words' || (activeTab === 'all' && words.some(w => w.label === targetLabelRef.current));

    if (isWordMode) {
        // 🟢 [단어 모드] Holistic 데이터 수집 (90프레임)
        // extractHolisticFeatures 함수가 handUtils.js에 있어야 함
        const features = extractHolisticFeatures(results); 
        sequenceBuffer.current.push(features);

        // 버퍼 크기 유지 (최신 90개)
        if (sequenceBuffer.current.length > SEQ_LENGTH) {
            sequenceBuffer.current.shift();
        }

        // 90개가 찼고 예측 중이 아니면 전송
        if (sequenceBuffer.current.length === SEQ_LENGTH && !isPredicting.current) {
             // 0.5초 간격으로 제한
             if (Date.now() - lastPredictionTime.current > 500) {
                 lastPredictionTime.current = Date.now();
                 predictSign(sequenceBuffer.current, 'word', targetLabelRef.current);
             }
        }
    } else {
        // 🔵 [기존 모드] Hands 데이터 수집 (1프레임)
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

  // --- 서버 예측 함수 ---
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

        console.log(`[판정] 모델:${modelKey} | AI:${predicted} (${(confidence*100).toFixed(1)}%) vs 정답:${target}`);

        if (predicted === target) {
          setPredictionMsg(`정확해요! 🎉 (${predicted})`);
          setIsCorrect(true);
          sequenceBuffer.current = []; // 버퍼 초기화
        } else {
          setPredictionMsg(`다시 해보세요 (인식: ${predicted})`);
          setIsCorrect(false);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      isPredicting.current = false; 
    }
  };

  // --- 네비게이션 ---
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentIndex(0);
    setIsCorrect(null);
    sequenceBuffer.current = [];
    setPredictionMsg("손을 보여주세요 👋");
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? currentData.length - 1 : prev - 1));
    sequenceBuffer.current = [];
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === currentData.length - 1 ? 0 : prev + 1));
    sequenceBuffer.current = [];
  };

  return (
    <div className="study-container">
      <h1 className="title">수어 배움터</h1>
      <p className="subtitle">카테고리를 선택하고 따라해보세요!</p>

      <nav className="study-tabs">
        {['consonants', 'vowels', 'numbers', 'words', 'all'].map(tab => (
          <button 
            key={tab}
            className={`tab-button ${activeTab === tab ? 'active' : ''}`}
            onClick={() => handleTabChange(tab)}
          >
            {tab === 'consonants' ? '자음 연습' : 
             tab === 'vowels' ? '모음 연습' : 
             tab === 'numbers' ? '숫자 연습' : 
             tab === 'words' ? '단어 연습' : '전체 연습'}
          </button>
        ))}
      </nav>

      <button 
        className={`cam-toggle-btn ${isCamOn ? 'on' : ''}`} 
        onClick={() => setIsCamOn(!isCamOn)}
      >
        {isCamOn ? '카메라 끄기 ⏹️' : 'AI 카메라 시작 📸'}
      </button>

      <div className="study-content-wrapper">
        <button className="nav-btn prev" onClick={handlePrev}>◀</button>
        
        <div className="display-area">
          <div className="study-card">
             <div className="card-img-wrapper">
                {currentData[currentIndex] && (
                  <img src={currentData[currentIndex].img} alt="수어 예시" />
                )}
             </div>
             <div className="card-text">
                {currentData[currentIndex] ? currentData[currentIndex].label : ""}
             </div>
          </div>

          <div className="study-card webcam-card">
            <div className="card-img-wrapper">
               {!isCamOn && <div className="placeholder">버튼을 눌러 시작하세요</div>}
               <video ref={videoRef} className="input_video" style={{display: 'none'}}></video>
               <canvas 
                 ref={canvasRef} 
                 className={`output_canvas ${isCamOn ? '' : 'hidden'}`} 
                 width={640} 
                 height={480}
               ></canvas>
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