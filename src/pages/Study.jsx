import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

// 🟢 modelData에서 데이터 가져오기
import { consonants, vowels, numbers } from '../data/modelData'; 

import { toXY, extractFeatures } from '../utils/handUtils';
import './Study.css';

const API_URL = "https://itzel-unaching-unexceptionally.ngrok-free.dev/predict";

const Study = () => {
  // --- 상태 관리 ---
  const [activeTab, setActiveTab] = useState('consonants');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCamOn, setIsCamOn] = useState(false);
  const [predictionMsg, setPredictionMsg] = useState("AI 모델 준비 중...");
  const [isCorrect, setIsCorrect] = useState(null); // null, true, false

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  const lastPredictionTime = useRef(0);
  
  // 🔒 [추가] 현재 서버와 통신 중인지 확인하는 "잠금 장치"
  const isPredicting = useRef(false);

  // 🌟 현재 탭에 맞는 데이터 가져오기 (랜덤 섞기 적용)
  const currentData = useMemo(() => {
    if (activeTab === 'consonants') return consonants;
    if (activeTab === 'vowels') return vowels;
    if (activeTab === 'numbers') return numbers;
    
    if (activeTab === 'all') {
      const allData = [...consonants, ...vowels, ...numbers];
      for (let i = allData.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allData[i], allData[j]] = [allData[j], allData[i]];
      }
      return allData;
    }
    return [];
  }, [activeTab]);

// --- MediaPipe 설정 (수정된 버전) ---
  useEffect(() => {
    let hands = null;
    let camera = null;

    if (isCamOn) {
      hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      hands.onResults(onResults);

      if (videoRef.current) {
        camera = new Camera(videoRef.current, {
          onFrame: async () => {
            // 🔒 [핵심 수정] 카메라가 켜져 있고, hands 인스턴스가 존재할 때만 전송
            // videoRef.current가 존재하는지도 확인해야 안전함
            if (isCamOn && hands && videoRef.current) {
              try {
                await hands.send({ image: videoRef.current });
              } catch (error) {
                // 종료 시점에 발생하는 BindingError는 무시 (앱 충돌 방지)
                console.warn("MediaPipe send error (ignoring during cleanup):", error);
              }
            }
          },
          width: 640,
          height: 480,
        });
        
        cameraRef.current = camera;
        camera.start();
        setPredictionMsg("손을 보여주세요 👋");
      }
    }

    // Cleanup 함수 (뒷정리)
    return () => {
      // 1. 카메라 먼저 멈춤
      if (cameraRef.current) {
        cameraRef.current.stop();
        cameraRef.current = null;
      }
      
      // 2. Hands 종료
      if (hands) {
        // hands.close()는 비동기 충돌 가능성이 있으므로 try-catch로 감쌈
        try {
            hands.close();
        } catch (e) {
            console.log("Hands close error", e);
        }
        hands = null; // 변수 초기화로 onFrame 내부 접근 차단
      }
    };
  }, [isCamOn]); // 의존성 배열 유지

  // --- MediaPipe 결과 처리 및 AI 예측 ---
  const onResults = (results) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // 1. 캔버스 그리기
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    
    // 2. 손 감지 및 예측
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      
      const now = Date.now();
      
      // 🚨 [수정] 요청 간격을 1000ms(1초)로 늘리고, 통신 중(isPredicting)일 땐 요청 막음
      if (now - lastPredictionTime.current > 1000 && !isPredicting.current) {
        lastPredictionTime.current = now;
        
        const coords = toXY(landmarks);
        const features = extractFeatures(coords);
        const modelKey = activeTab === 'numbers' ? 'digit' : 'hangul';
        
        predictSign(features, modelKey);
      }
    }
    ctx.restore();
  };

  // --- 서버 통신 함수 ---
  const predictSign = async (features, modelKey) => {
    // 🔒 이미 통신 중이면 강제 종료 (이중 안전장치)
    if (isPredicting.current) return;

    try {
      isPredicting.current = true; // 🚩 깃발 들기 (통신 시작)
      setPredictionMsg("AI가 분석 중... 🤔");

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_key: modelKey, features: features }),
      });

      if (response.ok) {
        const data = await response.json();
        const predictedLabel = data.label;
        
        // 현재 정답 데이터가 있는지 확인
        if (!currentData[currentIndex]) return;

        const targetLabel = currentData[currentIndex].label.split(' ')[0];

        if (predictedLabel === targetLabel) {
          setPredictionMsg("정확해요! 🎉");
          setIsCorrect(true);
        } else {
          setPredictionMsg(`틀렸어요... (인식: ${predictedLabel})`);
          setIsCorrect(false);
        }
      } else {
          // 404, 500 에러 등 처리
          setPredictionMsg("서버 응답 오류 ⚠️");
      }
    } catch (error) {
      console.error("Server Error:", error);
      setPredictionMsg("서버 연결 실패 ⚠️");
    } finally {
      // ✅ 성공하든 실패하든 무조건 깃발 내리기 (다음 요청 허용)
      isPredicting.current = false; 
    }
  };

  // --- 네비게이션 핸들러 ---
  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? currentData.length - 1 : prev - 1));
    setIsCorrect(null);
    setPredictionMsg("손을 보여주세요 👋");
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === currentData.length - 1 ? 0 : prev + 1));
    setIsCorrect(null);
    setPredictionMsg("손을 보여주세요 👋");
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentIndex(0);
    setIsCorrect(null);
  };

  return (
    <div className="study-container">
      <h1 className="title">수어 배움터</h1>
      <p className="subtitle">카테고리를 선택하고 따라해보세요!</p>

      {/* 탭 메뉴 */}
      <nav className="study-tabs">
        {['consonants', 'vowels', 'numbers', 'all'].map(tab => (
          <button 
            key={tab}
            className={`tab-button ${activeTab === tab ? 'active' : ''}`}
            onClick={() => handleTabChange(tab)}
          >
            {tab === 'consonants' ? '자음 연습' : 
             tab === 'vowels' ? '모음 연습' : 
             tab === 'numbers' ? '숫자 연습' : '전체 연습'}
          </button>
        ))}
      </nav>

      <button 
        className={`cam-toggle-btn ${isCamOn ? 'on' : ''}`} 
        onClick={() => setIsCamOn(!isCamOn)}
      >
        {isCamOn ? '카메라 끄기 ⏹️' : 'AI 카메라 시작 📸'}
      </button>

      {/* 학습 컨텐츠 영역 */}
      <div className="study-content-wrapper">
        <button className="nav-btn prev" onClick={handlePrev}>◀</button>
        
        <div className="display-area">
          {/* 왼쪽: 정답 이미지 */}
          <div className="study-card">
             <div className="card-img-wrapper">
                {currentData[currentIndex] && (
                  <img src={currentData[currentIndex].img} alt="수어" />
                )}
             </div>
             <div className="card-text">
                {currentData[currentIndex] ? currentData[currentIndex].label : "데이터 없음"}
             </div>
          </div>

          {/* 오른쪽: 내 웹캠 화면 */}
          <div className="study-card webcam-card">
            <div className="card-img-wrapper">
               {!isCamOn && <div className="placeholder">카메라를 켜주세요</div>}
               <video ref={videoRef} className="input_video" style={{display: 'none'}}></video>
               <canvas ref={canvasRef} className={`output_canvas ${isCamOn ? '' : 'hidden'}`} width={640} height={480}></canvas>
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