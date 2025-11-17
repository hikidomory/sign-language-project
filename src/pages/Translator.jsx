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

  // [핵심 추가] 토큰을 음절(원본 글자) 단위로 묶어주는 함수
  const groupedTokens = useMemo(() => {
    const groups = [];
    let currentGroup = null;

    signTokens.forEach((token) => {
      // 공백 처리
      if (token.key === 'space') {
        // 공백은 별도 그룹으로 넣거나, 현재 그룹을 끊어주는 역할
        groups.push({ type: 'space' });
        currentGroup = null;
        return;
      }

      // 새로운 글자(raw)가 시작되면 그룹 생성
      if (!currentGroup || currentGroup.raw !== token.raw) {
        currentGroup = { 
          type: 'char', 
          raw: token.raw, 
          tokens: [] 
        };
        groups.push(currentGroup);
      }
      
      // 현재 그룹에 자모 토큰 추가
      currentGroup.tokens.push(token);
    });

    return groups;
  }, [signTokens]);

  // [핵심 추가] 이미지 경로 결정 함수 (숫자/문자 구분)
  const getImagePath = (key) => {
    const isNumeric = /^[0-9]+$/;
    if (isNumeric.test(key)) {
      return `/images/fingernumber/${key}.jpg`;
    }
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
      if (now - lastPredTime.current > 300) {
        lastPredTime.current = now;
        const features = extractFeatures(toXY(results.multiHandLandmarks[0]));
        predictAndProcess(features);
      }
    }
    ctx.restore();
  };

  const predictAndProcess = async (features) => {
    // ... (기존 AI 로직 유지) ...
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

      if (label === potentialLabel.current) {
        potentialCount.current++;
      } else {
        potentialLabel.current = label;
        potentialCount.current = 1;
        holdStartTime.current = 0;
      }

      if (potentialCount.current >= 3) {
        if (holdStartTime.current === 0) holdStartTime.current = Date.now();
        
        const holdDuration = Date.now() - holdStartTime.current;
        if (holdDuration > 1000 && label !== lastAddedLabel.current) {
          processInput(label);
          lastAddedLabel.current = label;
        }
      } else {
        if (potentialLabel.current !== label) holdStartTime.current = 0;
      }

    } catch (err) { console.error(err); }
  };

  const processInput = (label) => {
    // ... (기존 processInput 로직 유지) ...
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

      {/* --- 탭 1: 텍스트 -> 수어 (수정됨) --- */}
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

          {/* 여기서 groupedTokens를 순회하며 
             이전 방식(eomjeol_group)처럼 렌더링합니다. 
          */}
          <div className="output-box">
            {groupedTokens.map((group, groupIdx) => {
              // 공백 처리
              if (group.type === 'space') {
                return <div key={groupIdx} className="sign-space"></div>;
              }

              // 글자(음절) 처리
              return (
                <div key={groupIdx} className="eomjeol_group">
                  {/* 왼쪽: 한글 원본 (예: 안) */}
                  <div className="eomjeol_label">{group.raw}</div>
                  
                  {/* 오른쪽: 분해된 수어 이미지들 (예: ㅇ, ㅏ, ㄴ) */}
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

      {/* --- 탭 2: 웹캠 -> 텍스트 (기존 유지) --- */}
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