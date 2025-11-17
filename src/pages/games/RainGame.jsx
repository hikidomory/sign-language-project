import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
// quizData import 제거됨
import './RainGame.css';

// --- 1. 자모 데이터 정의 (이미지 파일명과 매칭) ---
const CHOSUNG = ["ㄱ","ㄴ","ㄷ","ㄹ","ㅁ","ㅂ","ㅅ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const JUNGSUNG = ["ㅏ","ㅑ","ㅓ","ㅕ","ㅗ","ㅛ","ㅜ","ㅠ","ㅡ","ㅣ","ㅐ","ㅔ"]; // 복합모음 제외하고 기본 모음 위주
const JONGSUNG = ["","ㄱ","ㄴ","ㄷ","ㄹ","ㅁ","ㅂ","ㅅ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"]; // 빈 문자열 포함(받침 없는 경우)

const RainGame = () => {
  // --- 상태 변수 ---
  const [items, setItems] = useState([]); 
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3); 
  const [isPlaying, setIsPlaying] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [gameOver, setGameOver] = useState(false);

  // --- Refs ---
  const gameLoopRef = useRef(null);
  const spawnLoopRef = useRef(null);
  const itemsRef = useRef([]); 
  const scoreRef = useRef(0);
  const livesRef = useRef(3); 
  const recentItemsRef = useRef([]); // 중복 방지용

  // --- 유틸리티: 한글 한 글자 생성기 ---
  const createRandomHangulChar = (hasJongsung = false) => {
    const choIdx = Math.floor(Math.random() * CHOSUNG.length);
    const jungIdx = Math.floor(Math.random() * JUNGSUNG.length);
    
    // 받침 여부에 따라 종성 선택
    let jongIdx = 0;
    if (hasJongsung) {
      // 0번(없음)을 제외하고 랜덤 선택
      jongIdx = Math.floor(Math.random() * (JONGSUNG.length - 1)) + 1;
    }

    const cho = CHOSUNG[choIdx];
    const jung = JUNGSUNG[jungIdx];
    const jong = JONGSUNG[jongIdx];

    // 유니코드 조합 공식
    const code = 44032 + (choIdx * 588) + (jungIdx * 28) + jongIdx;
    const char = String.fromCharCode(code);

    // 이미지 구성을 위한 자모 배열 반환
    const parts = [cho, jung];
    if (jong) parts.push(jong);

    return { char, parts };
  };

  // --- 게임 시작 ---
  const startGame = () => {
    setItems([]);
    itemsRef.current = [];
    setScore(0);
    scoreRef.current = 0;
    setLives(3);
    livesRef.current = 3;
    recentItemsRef.current = []; 
    setGameOver(false);
    setIsPlaying(true);
    setUserInput("");
  };

  // --- 🌟 핵심: 랜덤 아이템 생성 함수 ---
  const generateGameItem = () => {
    const currentScore = scoreRef.current;
    let answerText = "";
    let imagePaths = [];

    // 난이도 로직
    const rand = Math.random(); // 글자 vs 숫자 확률 결정

    // [Level 1: 0~30점] 쉬움
    if (currentScore < 30) {
      if (rand > 0.3) { 
        // 70% 확률: 받침 없는 한글 1글자 (예: 가, 나, 도)
        const { char, parts } = createRandomHangulChar(false);
        answerText = char;
        imagePaths = parts.map(p => `/images/fingerspell/${p}.jpg`);
      } else {
        // 30% 확률: 1자리 숫자 (0~9)
        const num = Math.floor(Math.random() * 10);
        answerText = String(num);
        imagePaths = [`/images/fingernumber/${num}.jpg`];
      }
    } 
    // [Level 2: 30~80점] 보통
    else if (currentScore < 80) {
      if (rand > 0.4) {
        // 60% 확률: 받침 있는 한글 1글자 (예: 강, 달, 별)
        const { char, parts } = createRandomHangulChar(true);
        answerText = char;
        imagePaths = parts.map(p => `/images/fingerspell/${p}.jpg`);
      } else {
        // 40% 확률: 2자리 숫자 (10~99)
        const num = Math.floor(Math.random() * 90) + 10;
        answerText = String(num);
        // 숫자를 쪼개서 이미지로 (예: 15 -> 1, 5)
        imagePaths = answerText.split('').map(n => `/images/fingernumber/${n}.jpg`);
      }
    } 
    // [Level 3: 80점 이상] 어려움
    else {
      if (rand > 0.5) {
        // 50% 확률: 한글 2글자 단어 (랜덤 조합, 예: 구름, 하늘)
        // 첫 글자(받침 랜덤) + 두 번째 글자(받침 랜덤)
        const char1 = createRandomHangulChar(Math.random() > 0.5);
        const char2 = createRandomHangulChar(Math.random() > 0.5);
        
        answerText = char1.char + char2.char;
        imagePaths = [
          ...char1.parts.map(p => `/images/fingerspell/${p}.jpg`),
          ...char2.parts.map(p => `/images/fingerspell/${p}.jpg`)
        ];
      } else {
        // 50% 확률: 3자리 숫자 (100~999)
        const num = Math.floor(Math.random() * 900) + 100;
        answerText = String(num);
        imagePaths = answerText.split('').map(n => `/images/fingernumber/${n}.jpg`);
      }
    }

    return { answer: answerText, image: imagePaths };
  };

  // --- 아이템 스폰 루프 ---
  const spawnItem = () => {
    // 중복 방지 (최대 5번 시도)
    let newItemData = null;
    for (let i = 0; i < 5; i++) {
      const candidate = generateGameItem();
      if (!recentItemsRef.current.includes(candidate.answer)) {
        newItemData = candidate;
        break;
      }
    }
    // 5번 시도해도 중복이면 그냥 사용 (무한루프 방지)
    if (!newItemData) newItemData = generateGameItem();

    // 최근 목록 업데이트
    recentItemsRef.current.push(newItemData.answer);
    if (recentItemsRef.current.length > 5) recentItemsRef.current.shift();

    const randomX = Math.floor(Math.random() * 80) + 5;
    
    const newItem = {
      id: Date.now(),
      x: randomX,
      y: -15,
      answer: newItemData.answer,
      image: newItemData.image
    };

    setItems(prev => {
      const newItems = [...prev, newItem];
      itemsRef.current = newItems;
      return newItems;
    });
  };

  // --- 게임 루프 (낙하 및 충돌 처리) ---
  useEffect(() => {
    if (isPlaying) {
      // 스폰 속도: 점수가 높을수록 약간 빨라짐 (최소 1.5초)
      const spawnRate = Math.max(1500, 3000 - (scoreRef.current * 10));
      spawnLoopRef.current = setInterval(spawnItem, spawnRate);

      gameLoopRef.current = setInterval(() => {
        const currentItems = itemsRef.current;
        const survivingItems = [];
        let lifeLostCount = 0;

        // 낙하 속도: 점수가 높을수록 빨라짐
        const dropSpeed = 0.8 + (scoreRef.current / 100) * 0.5;

        const updatedItems = currentItems.map(item => ({
          ...item,
          y: item.y + dropSpeed
        }));

        updatedItems.forEach(item => {
          if (item.y > 95) {
            lifeLostCount++;
          } else {
            survivingItems.push(item);
          }
        });

        itemsRef.current = survivingItems;
        setItems(survivingItems);

        if (lifeLostCount > 0) {
          livesRef.current -= lifeLostCount;
          setLives(Math.max(0, livesRef.current));

          if (livesRef.current <= 0) {
            clearInterval(spawnLoopRef.current);
            clearInterval(gameLoopRef.current);
            setIsPlaying(false);
            setGameOver(true);
          }
        }
      }, 30); // 30ms 부드러운 프레임
    }

    return () => {
      clearInterval(spawnLoopRef.current);
      clearInterval(gameLoopRef.current);
    };
  }, [isPlaying]);

  // --- 정답 체크 ---
  const handleInput = (e) => {
    if (e.key === 'Enter') {
      const value = userInput.trim();
      if (!value) return;

      const currentItems = itemsRef.current;
      // 화면 아래쪽(y가 큰) 아이템부터 검색하여 우선 제거
      // sort를 쓰면 원본에 영향주므로 복사해서 찾거나 역순 탐색
      // 여기서는 간단히 findIndex 사용
      const hitIndex = currentItems.findIndex(item => item.answer === value);

      if (hitIndex !== -1) {
        const newItems = [...currentItems];
        newItems.splice(hitIndex, 1);
        
        itemsRef.current = newItems;
        setItems(newItems);
        
        const newScore = scoreRef.current + 10;
        scoreRef.current = newScore;
        setScore(newScore);
        setUserInput("");
      } else {
        setUserInput(""); 
      }
    }
  };

  return (
    <div className="rain-game-container">
      <div className="game-header">
        <div className="score-board">점수 : {score}</div>
        <div className="life-board">{'❤'.repeat(Math.max(0, lives))}</div>
      </div>

      <div className="sky-area">
        {!isPlaying && !gameOver && (
          <div className="start-msg">
             <h2>수어 산성비 (무한 모드)</h2>
             <p>랜덤으로 생성되는 수어 단어를 맞춰보세요!</p>
             <button onClick={startGame}>게임 시작</button>
          </div>
        )}

        {items.map(item => (
          <div 
            key={item.id} 
            className="drop-item" 
            style={{ left: `${item.x}%`, top: `${item.y}%` }}
          >
            <div className="images-row">
              {item.image.map((src, i) => (
                <img 
                  key={i} 
                  src={src} 
                  alt="수어" 
                  onError={(e) => e.target.style.display = 'none'} // 이미지 없으면 숨김
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="input-area">
        <input 
          type="text" 
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={handleInput}
          placeholder={isPlaying ? "정답 입력" : "게임 시작을 눌러주세요"}
          disabled={!isPlaying}
          autoFocus
        />
      </div>

      {gameOver && (
        <div className="game-over-modal">
          <div className="modal-content">
            <h2>GAME OVER</h2>
            <p>최종 점수: {score}점</p>
            <button onClick={startGame}>다시 하기</button>
            <Link to="/arcade" className="exit-btn">나가기</Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default RainGame;