import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

// modelData에서 데이터 가져오기
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
  const [isCorrect, setIsCorrect] = useState(null); // null(대기), true(정답), false(오답)

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  const lastPredictionTime = useRef(0);
  const isPredicting = useRef(false);

  // 🌟 탭 데이터 설정 (studyroom.js의 로직과 유사하게 구성)
  const currentData = useMemo(() => {
    if (activeTab === 'consonants') return consonants;
    if (activeTab === 'vowels') return vowels;
    if (activeTab === 'numbers') return numbers;
    
    if (activeTab === 'all') {
      // 전체 연습 모드 (랜덤 섞기 포함)
      const allData = [...consonants, ...vowels, ...numbers];
      for (let i = allData.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allData[i], allData[j]] = [allData[j], allData[i]];
      }
      return allData;
    }
    return [];
  }, [activeTab]);

  // 🎯 현재 정답 라벨 (숫자의 경우 "1 (하나)"에서 "1"만 추출)
  const currentTargetLabel = useMemo(() => {
    if (!currentData[currentIndex]) return null;
    const label = currentData[currentIndex].label;
    // 괄호가 있다면 앞부분만 사용 (예: "1 (하나)" -> "1")
    return label.includes('(') ? label.split('(')[0].trim() : label.trim();
  }, [currentData, currentIndex]);

  // --- MediaPipe 초기화 및 카메라 설정 ---
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
            if (isCamOn && videoRef.current) {
              await hands.send({ image: videoRef.current });
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
      // 카메라가 꺼지면 메시지 초기화
      setPredictionMsg("AI 모델 준비 중...");
      setIsCorrect(null);
    }

    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
        cameraRef.current = null;
      }
      if (hands) {
        hands.close();
      }
    };
  }, [isCamOn]);

  // --- MediaPipe 결과 처리 및 예측 요청 ---
  const onResults = (results) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // 1. 캔버스 그리기 (거울 모드 유지를 위해 CSS transform 활용 권장)
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    
    // 2. 손 랜드마크가 있으면 예측 시도
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      
      // 랜드마크 그리기 (선택 사항)
      // drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {color: '#FFFFFF', lineWidth: 5});
      // drawLandmarks(ctx, landmarks, {color: '#4CAF50', lineWidth: 2});

      const now = Date.now();
      // 1초 쿨타임 & 예측 중복 방지
      if (now - lastPredictionTime.current > 1000 && !isPredicting.current && currentTargetLabel) {
        lastPredictionTime.current = now;
        
        const coords = toXY(landmarks);
        const features = extractFeatures(coords);
        const modelKey = activeTab === 'numbers' ? 'digit' : 'hangul';
        
        predictSign(features, modelKey, currentTargetLabel);
      }
    }
    ctx.restore();
  };

  // --- 서버 예측 함수 (핵심 수정 적용됨) ---
  const predictSign = async (features, modelKey, expectedLabel) => {
    if (isPredicting.current) return;

    try {
      isPredicting.current = true;
      setPredictionMsg("분석 중... 🤔");

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_key: modelKey, features: features }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // [핵심 수정 사항] 
        // normalize("NFKC"): 초성(Jamo)과 호환용 자모(Compatibility Jamo)를 동일하게 맞춰줍니다.
        const predicted = String(data.label).trim().normalize("NFKC");
        const target = String(expectedLabel).trim().normalize("NFKC");

        console.log(`[판정] AI 예측: ${predicted} / 정답: ${target}`);

        if (predicted === target) {
          setPredictionMsg(`정확해요! 🎉 (${predicted})`);
          setIsCorrect(true);
        } else {
          setPredictionMsg(`다시 해보세요 (인식: ${predicted})`);
          setIsCorrect(false);
        }
      } else {
          setPredictionMsg("서버 오류 ⚠️");
      }
    } catch (error) {
      console.error(error);
      setPredictionMsg("연결 실패 ⚠️");
    } finally {
      isPredicting.current = false; 
    }
  };

  // --- 버튼 핸들러 ---
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentIndex(0);
    setIsCorrect(null);
    setPredictionMsg("손을 보여주세요 👋");
  };

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

      {/* 메인 컨텐츠 영역 */}
      <div className="study-content-wrapper">
        <button className="nav-btn prev" onClick={handlePrev}>◀</button>
        
        <div className="display-area">
          {/* 정답 이미지 카드 */}
          <div className="study-card">
             <div className="card-img-wrapper">
                {currentData[currentIndex] && (
                  <img src={currentData[currentIndex].img} alt="수어 예시" />
                )}
             </div>
             <div className="card-text">
                {/* 원본 라벨 그대로 표시 (예: 1 (하나)) */}
                {currentData[currentIndex] ? currentData[currentIndex].label : ""}
             </div>
          </div>

          {/* 웹캠 카드 */}
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
            {/* 결과 메시지: 정답이면 초록, 오답이면 빨강 */}
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