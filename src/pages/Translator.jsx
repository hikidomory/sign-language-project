import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { toXY, extractFeatures } from '../utils/handUtils';
import * as HE from '../utils/HangulEngine';
import './Translator.css';

const API_URL = "https://itzel-unaching-unexceptionally.ngrok-free.dev/predict";

const Translator = () => {
  const [activeTab, setActiveTab] = useState('text2sign'); 

  // --- 1. 텍스트 -> 수어 변수 ---
  const [inputText, setInputText] = useState("");
  const [signTokens, setSignTokens] = useState([]);

  // --- 2. 웹캠 -> 텍스트 변수 ---
  const [isCamOn, setIsCamOn] = useState(false);
  const [currentModel, setCurrentModel] = useState('hangul');
  const [sentence, setSentence] = useState(""); 
  const [syllable, setSyllable] = useState({ cho: null, jung: null, jong: null }); 
  const [predLabel, setPredLabel] = useState("준비됨");
  
  // 🚀 [추가] 입력 진행률 시각화용 상태
  const [progress, setProgress] = useState(0); 

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const lastPredTime = useRef(0);
  
  const potentialLabel = useRef(null);
  const potentialCount = useRef(0);
  const holdStartTime = useRef(0);
  const lastAddedLabel = useRef(null);

  // --- 탭 1 로직: 텍스트 입력 처리 ---
  const handleTextRender = () => {
    const tokens = HE.tokenize(inputText);
    setSignTokens(tokens);
  };

  // 토큰 음절 그룹화 함수 (이전과 동일)
  const groupedTokens = useMemo(() => {
    const groups = [];
    let currentGroup = null;
    signTokens.forEach((token) => {
      if (token.key === 'space') {
        groups.push({ type: 'space' });
        currentGroup = null;
        return;
      }
      if (!currentGroup || currentGroup.raw !== token.raw) {
        currentGroup = { type: 'char', raw: token.raw, tokens: [] };
        groups.push(currentGroup);
      }
      currentGroup.tokens.push(token);
    });
    return groups;
  }, [signTokens]);

  const getImagePath = (key) => {
    const isNumeric = /^[0-9]+$/;
    if (isNumeric.test(key)) return `/images/fingernumber/${key}.jpg`;
    return `/images/fingerspell/${key}.jpg`;
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

    let camera = null;
    if (videoRef.current) {
      camera = new Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current) await hands.send({ image: videoRef.current });
        },
        width: 640,
        height: 480,
      });
      camera.start();
    }

    return () => {
      if (camera) camera.stop();
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
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const now = Date.now();
      // 300ms 쿨타임 (너무 자주 요청하지 않도록)
      if (now - lastPredTime.current > 200) { // 반응속도를 위해 300 -> 200 단축
        lastPredTime.current = now;
        const features = extractFeatures(toXY(results.multiHandLandmarks[0]));
        predictAndProcess(features);
      }
    } else {
      // 🛠️ [핵심 수정 1] 손이 화면에서 사라지면 상태 완전 초기화
      // 이렇게 해야 손을 뺐다 다시 넣었을 때 같은 글자도 입력 가능해집니다.
      potentialLabel.current = null;
      potentialCount.current = 0;
      holdStartTime.current = 0;
      lastAddedLabel.current = null; 
      setPredLabel("손을 보여주세요");
      setProgress(0);
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
      const label = data.label; // AI가 인식한 라벨
      
      // 화면 표시용 업데이트
      setPredLabel(label);

      // --- 디바운싱 & 홀드 로직 개선 ---
      
      if (label === potentialLabel.current) {
        // 같은 라벨이 연속해서 들어옴
        potentialCount.current++;
        
        if (holdStartTime.current === 0) {
            holdStartTime.current = Date.now();
        }
        
        // 경과 시간 계산
        const elapsed = Date.now() - holdStartTime.current;
        const TARGET_TIME = 600; // 🛠️ [핵심 수정 2] 입력 대기 시간 단축 (1000ms -> 600ms)

        // 진행률 업데이트 (0 ~ 100%)
        const pct = Math.min(100, (elapsed / TARGET_TIME) * 100);
        setProgress(pct);

        // 입력 확정 조건 달성
        if (elapsed > TARGET_TIME) {
           // 이전에 입력한 것과 다른 글자이거나, 손을 뗐다 다시한 경우 입력 허용
           if (label !== lastAddedLabel.current) {
             processInput(label);
             lastAddedLabel.current = label;
             
             // 입력 후 피드백 (진동 등 가능하면 추가)
             console.log("입력 확정:", label);
             setProgress(0); 
             holdStartTime.current = 0; // 타이머 리셋
           }
        }

      } else {
        // 라벨이 바뀌거나 튀었을 때
        potentialLabel.current = label;
        potentialCount.current = 1;
        holdStartTime.current = 0; // 타이머 리셋
        setProgress(0);
      }

    } catch (err) { console.error(err); }
  };

  const processInput = (label) => {
    // ... 기존 로직 동일 ...
    if (label === 'conversion_model_1') {
      setCurrentModel(prev => {
        const next = prev === 'hangul' ? 'digit' : 'hangul';
        resetState(); 
        return next;
      });
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

    if (currentModel === 'hangul') {
      setSyllable(prev => HE.processJamoInput(label, prev, (char) => {
        setSentence(s => s + char);
      }));
    } else {
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
    setSyllable(curr => {
      if (curr.cho || curr.jung || curr.jong) {
        return { cho: null, jung: null, jong: null };
      } else {
        setSentence(s => s.slice(0, -1));
        return { cho: null, jung: null, jong: null };
      }
    });
  };

  const resetState = () => {
    setSyllable({ cho: null, jung: null, jong: null });
    potentialLabel.current = null;
    lastAddedLabel.current = null;
    setProgress(0);
  };

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

      {/* Text -> Sign Tab */}
      {activeTab === 'text2sign' && (
        <div className="panel text2sign">
          <div className="input-box">
            <textarea 
              placeholder="번역할 내용을 입력하세요 (예: 안녕 123)" 
              value={inputText}
              onChange={(e)=>setInputText(e.target.value)}
            />
            <button onClick={handleTextRender}>번역하기</button>
          </div>

          <div className="output-box">
            {groupedTokens.map((group, groupIdx) => {
              if (group.type === 'space') return <div key={groupIdx} className="sign-space"></div>;
              return (
                <div key={groupIdx} className="eomjeol_group">
                  <div className="eomjeol_label">{group.raw}</div>
                  <div className="eomjeol_signs">
                    {group.tokens.map((token, tokenIdx) => (
                      <div key={tokenIdx} className="sign-card">
                        <img 
                          src={getImagePath(token.key)} 
                          alt={token.raw}
                          onError={(e)=>{
                            e.target.style.display='none';
                            e.target.parentElement.innerText = token.label || token.key;
                          }} 
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cam -> Text Tab */}
      {activeTab === 'cam2text' && (
        <div className="panel cam2text">
          <div className="cam-wrapper">
             {!isCamOn && <div className="cam-placeholder">카메라가 꺼져있습니다</div>}
             <video ref={videoRef} style={{display:'none'}} autoPlay playsInline></video>
             <canvas ref={canvasRef} width={640} height={480} className={isCamOn?'':'hidden'}></canvas>
             
             {/* 🚀 [추가] 입력 진행률 표시 바 */}
             {isCamOn && progress > 0 && (
               <div style={{
                 position: 'absolute',
                 bottom: 0,
                 left: 0,
                 height: '10px',
                 backgroundColor: '#4caf50',
                 width: `${progress}%`,
                 transition: 'width 0.1s linear'
               }}></div>
             )}
          </div>
          
          <div className="control-panel">
             <button className="cam-btn" onClick={()=>setIsCamOn(!isCamOn)}>
               {isCamOn ? "카메라 끄기" : "카메라 켜기"}
             </button>
             <div className="mode-badge">현재 모드: {currentModel === 'hangul' ? '한글' : '숫자'}</div>
             <div className="status-text">
                인식된 동작: <span>{predLabel}</span>
             </div>
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