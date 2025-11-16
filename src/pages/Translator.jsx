import React, { useState, useEffect, useRef } from 'react';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { toXY, extractFeatures } from '../utils/handUtils';
import * as HE from '../utils/HangulEngine'; // 방금 만든 엔진 불러오기
import './Translator.css';

const API_URL = "http://127.0.0.1:8000/predict";

const Translator = () => {
  const [activeTab, setActiveTab] = useState('text2sign'); // 'text2sign' or 'cam2text'

  // --- 1. 텍스트 -> 수어 변수 ---
  const [inputText, setInputText] = useState("");
  const [signTokens, setSignTokens] = useState([]);

  // --- 2. 웹캠 -> 텍스트 변수 ---
  const [isCamOn, setIsCamOn] = useState(false);
  const [currentModel, setCurrentModel] = useState('hangul');
  const [sentence, setSentence] = useState(""); // 확정된 문장
  const [syllable, setSyllable] = useState({ cho: null, jung: null, jong: null }); // 조합 중인 글자
  const [predLabel, setPredLabel] = useState("준비됨");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const lastPredTime = useRef(0);
  
  // 인식 안정화를 위한 변수들 (Ref 사용)
  const potentialLabel = useRef(null);
  const potentialCount = useRef(0);
  const confidentLabel = useRef(null);
  const holdStartTime = useRef(0);
  const lastAddedLabel = useRef(null);

  // --- 탭 1 로직: 텍스트 입력 처리 ---
  const handleTextRender = () => {
    const tokens = HE.tokenize(inputText);
    setSignTokens(tokens);
  };

  // --- 탭 2 로직: MediaPipe & AI ---
  useEffect(() => {
    if (activeTab !== 'cam2text' || !isCamOn) return;

    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    hands.onResults(onResults);

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        if (videoRef.current) await hands.send({ image: videoRef.current });
      },
      width: 640,
      height: 480,
    });
    camera.start();

    return () => {
      camera.stop();
      hands.close();
    };
  }, [activeTab, isCamOn, currentModel]);

  const onResults = (results) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.save();
    ctx.clearRect(0, 0, 640, 480);
    ctx.translate(640, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(results.image, 0, 0, 640, 480);
    
    if (results.multiHandLandmarks?.length > 0) {
      const now = Date.now();
      if (now - lastPredTime.current > 300) {
        lastPredTime.current = now;
        const features = extractFeatures(toXY(results.multiHandLandmarks[0]));
        predictAndProcess(features);
      }
    }
    ctx.restore();
  };

  const predictAndProcess = async (features) => {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_key: currentModel, features }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const label = data.label;
      setPredLabel(label);

      // 떨림 보정 및 1초 유지 로직
      if (label === potentialLabel.current) {
        potentialCount.current++;
      } else {
        potentialLabel.current = label;
        potentialCount.current = 1;
        holdStartTime.current = 0; // 리셋
      }

      if (potentialCount.current >= 3) {
        // 같은 라벨이 3프레임 이상 지속됨
        if (holdStartTime.current === 0) holdStartTime.current = Date.now();
        
        const holdDuration = Date.now() - holdStartTime.current;
        if (holdDuration > 1000 && label !== lastAddedLabel.current) {
          // 1초 이상 유지됨 -> 입력 처리!
          processInput(label);
          lastAddedLabel.current = label; // 중복 입력 방지
        }
      } else {
        // 라벨이 바뀌면 홀드 타임 리셋
        if (potentialLabel.current !== label) holdStartTime.current = 0;
      }

    } catch (err) { console.error(err); }
  };

  // ★ 입력 처리기 (한글 조합 엔진 사용)
  const processInput = (label) => {
    // 1. 특수 키 처리
    if (label === 'conversion_model_1') {
      setCurrentModel(prev => prev === 'hangul' ? 'digit' : 'hangul');
      resetState();
      return;
    }
    if (label === 'space') {
      commitSyllable();
      setSentence(prev => prev + " ");
      resetState();
      return;
    }
    if (label === 'back_space') {
      handleBackspace();
      return;
    }

    // 2. 한글 모드
    if (currentModel === 'hangul') {
      setSyllable(prev => HE.processJamoInput(label, prev, (char) => {
        setSentence(s => s + char);
      }));
    } 
    // 3. 숫자 모드
    else {
       setSentence(prev => prev + label);
    }
  };

  const commitSyllable = () => {
    setSyllable(curr => {
      const char = HE.composeHangul(curr.cho, curr.jung, curr.jong);
      if (char) setSentence(s => s + char);
      else setSentence(s => s + (curr.cho||"") + (curr.jung||"") + (curr.jong||""));
      return { cho: null, jung: null, jong: null };
    });
  };

  const handleBackspace = () => {
    // 현재 조합 중인 게 있으면 하나 지우기 (단순화: 그냥 초기화하거나, 엔진 역분해 로직 필요)
    // 여기서는 간단히 조합 초기화 -> 문장 마지막 글자 삭제 로직으로 구현
    setSyllable(curr => {
      if (curr.cho || curr.jung || curr.jong) {
        return { cho: null, jung: null, jong: null }; // 조합 중인거 날림
      } else {
        setSentence(s => s.slice(0, -1)); // 문장 한 글자 삭제
        return { cho: null, jung: null, jong: null };
      }
    });
  };

  const resetState = () => {
    setSyllable({ cho: null, jung: null, jong: null });
    potentialLabel.current = null;
    lastAddedLabel.current = null;
  };

  // 현재 조합 중인 글자 미리보기
  const composingChar = HE.composeHangul(syllable.cho, syllable.jung, syllable.jong) 
    || (syllable.cho || "") + (syllable.jung || "") + (syllable.jong || "");

  return (
    <div className="translator-container">
      <h1 className="page-title">수어 번역기</h1>
      
      <div className="tabs">
        <button className={`tab ${activeTab==='text2sign'?'active':''}`} onClick={()=>setActiveTab('text2sign')}>
          텍스트 → 손모양
        </button>
        <button className={`tab ${activeTab==='cam2text'?'active':''}`} onClick={()=>setActiveTab('cam2text')}>
          웹캠 손모양 → 텍스트
        </button>
      </div>

      {/* --- 탭 1: 텍스트 to 수어 --- */}
      {activeTab === 'text2sign' && (
        <div className="panel text2sign">
          <div className="input-box">
            <textarea 
              placeholder="번역할 내용을 입력하세요 (예: 안녕)" 
              value={inputText}
              onChange={(e)=>setInputText(e.target.value)}
            />
            <button onClick={handleTextRender}>번역하기</button>
          </div>
          <div className="output-box">
            {signTokens.map((token, idx) => (
              <div key={idx} className="sign-card">
                {token.key === 'space' ? (
                  <div className="space"></div>
                ) : (
                  <>
                    <img 
                      src={`/images/fingerspell/${token.key}.jpg`} 
                      onError={(e)=>{e.target.style.display='none'}} // 이미지 없으면 숨김
                      alt={token.key} 
                    />
                    <span>{token.raw}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- 탭 2: 웹캠 to 텍스트 --- */}
      {activeTab === 'cam2text' && (
        <div className="panel cam2text">
          <div className="cam-wrapper">
             {!isCamOn && <div className="cam-placeholder">카메라가 꺼져있습니다</div>}
             <video ref={videoRef} style={{display:'none'}} autoPlay playsInline></video>
             <canvas ref={canvasRef} width={640} height={480} className={isCamOn?'':'hidden'}></canvas>
          </div>
          
          <div className="control-panel">
             <button className="cam-btn" onClick={()=>setIsCamOn(!isCamOn)}>
               {isCamOn ? "카메라 끄기" : "카메라 켜기"}
             </button>
             <div className="mode-badge">현재 모드: {currentModel === 'hangul' ? '한글' : '숫자'}</div>
             <div className="status-text">인식된 동작: <span>{predLabel}</span></div>
          </div>

          <div className="sentence-box">
             <h3>완성된 문장</h3>
             <div className="result-text">
               {sentence}<span className="composing">{composingChar}</span><span className="cursor">|</span>
             </div>
          </div>
          
          <div className="manual-controls">
             <button onClick={()=>processInput('space')}>띄어쓰기</button>
             <button onClick={()=>processInput('back_space')}>지우기</button>
             <button onClick={()=>processInput('conversion_model_1')}>모드 전환</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Translator;