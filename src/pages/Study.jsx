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
  
  // 🔒 통신 중복 방지 락
  const isPredicting = useRef(false);

  // 🌟 현재 탭에 맞는 데이터 가져오기 (랜덤 섞기 적용)
  const currentData = useMemo(() => {
    if (activeTab === 'consonants') return consonants;
    if (activeTab === 'vowels') return vowels;
    if (activeTab === 'numbers') return numbers;
    
    if (activeTab === 'all') {
      const allData = [...consonants, ...vowels, ...numbers];
      // 간단한 셔플 로직
      for (let i = allData.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allData[i], allData[j]] = [allData[j], allData[i]];
      }
      return allData;
    }
    return [];
  }, [activeTab]);

  // 🎯 현재 화면에 표시된 정답 라벨 계산 (숫자 포맷 처리 등)
  const currentTargetLabel = useMemo(() => {
    if (!currentData[currentIndex]) return null;
    // "1 (하나)" -> "1" 로 분리, 공백 제거
    return currentData[currentIndex].label.split('(')[0].trim(); 
  }, [currentData, currentIndex]);


  // --- MediaPipe 설정 ---
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
            // 🔒 안전장치: 카메라/핸즈/비디오요소 확인
            if (isCamOn && hands && videoRef.current) {
              try {
                await hands.send({ image: videoRef.current });
              } catch (error) {
                if (!error.message.includes("BindingError")) {
                   console.warn("MediaPipe send error (ignoring cleanup):", error);
                }
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

    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
        cameraRef.current = null;
      }
      if (hands) {
        try { hands.close(); } catch (e) { console.log("Hands close error", e); }
        hands = null;
      }
    };
  }, [isCamOn]);

  // --- MediaPipe 결과 처리 ---
  const onResults = (results) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // 1. 그리기
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    
    // 2. 예측 요청
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      const now = Date.now();
      
      // 1초 딜레이 & 중복 요청 방지 & 현재 정답 데이터가 있을 때만
      if (now - lastPredictionTime.current > 1000 && !isPredicting.current && currentTargetLabel) {
        lastPredictionTime.current = now;
        
        const coords = toXY(landmarks);
        const features = extractFeatures(coords);
        const modelKey = activeTab === 'numbers' ? 'digit' : 'hangul';
        
        // 🚨 [핵심 수정] 예측 요청 시점의 '정답(currentTargetLabel)'을 인자로 넘김
        predictSign(features, modelKey, currentTargetLabel);
      }
    }
    ctx.restore();
  };

  // --- 서버 통신 함수 ---
  // targetLabel을 인자로 받아서 비동기 상태 꼬임 방지
  const predictSign = async (features, modelKey, expectedLabel) => {
    if (isPredicting.current) return;

    try {
      isPredicting.current = true;
      setPredictionMsg("AI가 분석 중... 🤔");

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_key: modelKey, features: features }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // 🔍 디버깅용 로그 (개발자 도구 콘솔 확인용)
        console.log(`[Prediction] AI: ${data.label} / 정답: ${expectedLabel}`);

        const predicted = String(data.label).trim(); // 문자열 변환 및 공백 제거
        const target = String(expectedLabel).trim();

        if (predicted === target) {
          setPredictionMsg(`정확해요! 🎉 (${predicted})`);
          setIsCorrect(true);
        } else {
          setPredictionMsg(`틀렸어요... (인식: ${predicted})`);
          setIsCorrect(false);
        }
      } else {
          setPredictionMsg("서버 응답 오류 ⚠️");
      }
    } catch (error) {
      console.error("Server Error:", error);
      setPredictionMsg("서버 연결 실패 ⚠️");
    } finally {
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

  // (return 부분은 기존과 동일하지만, currentTargetLabel 사용은 내부 로직용이므로 UI는 기존 유지)
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