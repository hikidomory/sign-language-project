import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

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
  const [isCorrect, setIsCorrect] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  const lastPredictionTime = useRef(0);
  const isPredicting = useRef(false);

  // 🛠️ [핵심 1] Stale Closure 방지용 Ref (최신 정답 참조)
  const targetLabelRef = useRef(null);

  // 🌟 탭 데이터 설정
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

  // 🎯 현재 정답 라벨 계산
  const currentTargetLabel = useMemo(() => {
    if (!currentData[currentIndex]) return null;
    const label = currentData[currentIndex].label;
    return label.includes('(') ? label.split('(')[0].trim() : label.trim();
  }, [currentData, currentIndex]);

  // 정답이 바뀌면 Ref 업데이트
  useEffect(() => {
    targetLabelRef.current = currentTargetLabel;
  }, [currentTargetLabel]);

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
      setPredictionMsg("AI 모델 준비 중...");
      setIsCorrect(null);
    }

    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
        cameraRef.current = null;
      }
      if (hands) hands.close();
    };
  }, [isCamOn]);

  // --- 결과 처리 ---
  const onResults = (results) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    
    ctx.save();
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      
      // 정답을 맞췄다면 API 호출 중단 (화면 갱신은 계속)
      if (isCorrect) {
        ctx.restore();
        return; 
      }

      const now = Date.now();
      // targetLabelRef.current를 사용하여 항상 최신 정답 확인
      if (now - lastPredictionTime.current > 1000 && !isPredicting.current && targetLabelRef.current) {
        lastPredictionTime.current = now;
        
        const coords = toXY(landmarks);
        const features = extractFeatures(coords);
        const modelKey = activeTab === 'numbers' ? 'digit' : 'hangul';
        
        predictSign(features, modelKey, targetLabelRef.current);
      }
    }
    ctx.restore();
  };

  // --- 서버 예측 함수 (수정됨) ---
  const predictSign = async (features, modelKey, expectedLabel) => {
    if (isPredicting.current) return;

    try {
      isPredicting.current = true;
      
      // 🗑️ [삭제됨] "분석 중..." 메시지 설정을 제거하여 깜빡임 방지
      // setPredictionMsg("분석 중... 🤔"); 

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_key: modelKey, features: features }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // NFKC 정규화
        const predicted = String(data.label).trim().normalize("NFKC");
        const target = String(expectedLabel).trim().normalize("NFKC");

        console.log(`[판정] AI: ${predicted} vs 정답: ${target}`);

        if (predicted === target) {
          setPredictionMsg(`정확해요! 🎉 (${predicted})`);
          setIsCorrect(true);
        } else {
          setPredictionMsg(`다시 해보세요 (인식: ${predicted})`);
          setIsCorrect(false);
        }
      }
    } catch (error) {
      console.error(error);
      // 에러 시에만 메시지 표시 (선택 사항)
      // setPredictionMsg("연결 실패 ⚠️"); 
    } finally {
      isPredicting.current = false; 
    }
  };

  // --- 네비게이션 ---
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