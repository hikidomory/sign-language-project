import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { quizData } from '../../data/quizData';
import './RainGame.css';

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
  
  // 🌟 [추가] 중복 방지를 위한 최근 나온 단어 저장소 (최대 5개 기억)
  const recentItemsRef = useRef([]); 

  // --- 게임 시작 ---
  const startGame = () => {
    setItems([]);
    itemsRef.current = [];
    setScore(0);
    scoreRef.current = 0;
    
    setLives(3);
    livesRef.current = 3;
    
    recentItemsRef.current = []; // 중복 기록 초기화
    
    setGameOver(false);
    setIsPlaying(true);
    setUserInput("");
  };

  // --- 🌟 [수정됨] 아이템 생성 (Spawn) ---
  const spawnItem = () => {
    const keys = Object.keys(quizData);
    const currentScore = scoreRef.current;

    // 1. 점수대별 난이도 설정 (필터링 조건)
    let minLen = 1;
    let maxLen = 10; // 제한 없음

    if (currentScore < 30) {
      // 초반: 1글자 짜리만 (이미지 1개)
      minLen = 1; 
      maxLen = 1;
    } else if (currentScore < 80) {
      // 중반: 1글자 ~ 2글자 (간단한 단어 섞임)
      minLen = 1; 
      maxLen = 2;
    } else {
      // 후반: 2글자 이상 (어려운 단어 위주)
      minLen = 2;
      maxLen = 10;
    }

    // 2. 조건에 맞는 후보군 추출
    let candidates = keys.filter(k => {
      const len = quizData[k].answer.length;
      return len >= minLen && len <= maxLen;
    });

    // (예외처리) 만약 조건에 맞는게 하나도 없으면 전체에서 뽑음
    if (candidates.length === 0) candidates = keys;

    // 3. 🌟 중복 방지 로직
    // 최근에 나왔던 단어들을 후보군에서 제외
    const nonDuplicateCandidates = candidates.filter(k => 
      !recentItemsRef.current.includes(quizData[k].answer)
    );

    // 제외했더니 남은게 있으면 거기서 뽑고, 없으면(다 최근에 나온거면) 그냥 뽑음
    const finalCandidates = nonDuplicateCandidates.length > 0 ? nonDuplicateCandidates : candidates;

    const randomKey = finalCandidates[Math.floor(Math.random() * finalCandidates.length)];
    const quiz = quizData[randomKey];
    
    // 4. 최근 목록 업데이트 (Queue 방식)
    recentItemsRef.current.push(quiz.answer);
    if (recentItemsRef.current.length > 5) { // 최근 5개까지만 기억
      recentItemsRef.current.shift();
    }

    const randomX = Math.floor(Math.random() * 80) + 5;

    const newItem = {
      id: Date.now(), 
      x: randomX,
      y: -10,
      answer: quiz.answer,
      image: Array.isArray(quiz.image) ? quiz.image : [quiz.image]
    };

    setItems(prev => {
      const newItems = [...prev, newItem];
      itemsRef.current = newItems;
      return newItems;
    });
  };

  // --- 게임 루프 ---
  useEffect(() => {
    if (isPlaying) {
      // 🌟 난이도가 올라갈수록 생성 속도도 조금씩 빨라지게 할 수 있음 (선택사항)
      // 현재는 고정 3초
      spawnLoopRef.current = setInterval(spawnItem, 3000);

      gameLoopRef.current = setInterval(() => {
        const currentItems = itemsRef.current;
        const survivingItems = [];
        let lifeLostCount = 0; 

        // 🌟 낙하 속도 공식 (점수가 높을수록 빨라짐)
        const dropSpeed = 1 + Math.floor(scoreRef.current / 50) * 0.2;

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

      }, 50);
    }

    return () => {
      clearInterval(spawnLoopRef.current);
      clearInterval(gameLoopRef.current);
    };
  }, [isPlaying]);

  // --- 정답 체크 (기존과 동일) ---
  const handleInput = (e) => {
    if (e.key === 'Enter') {
      const value = userInput.trim();
      if (!value) return;

      const currentItems = itemsRef.current;
      // 가장 아래에 있는(화면 y값이 큰) 아이템부터 우선순위로 제거하면 더 좋음
      // 여기서는 findIndex로 단순 검색
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
             <h2>수어 산성비</h2>
             <p>단어를 입력하여 산성비를 막아주세요!</p>
             <button onClick={startGame}>게임 시작</button>
          </div>
        )}

        {items.map(item => (
          <div 
            key={item.id} 
            className="drop-item" 
            style={{ left: `${item.x}%`, top: `${item.y}%` }}
          >
            {/* 이미지가 여러개일 경우 옆으로 나열되도록 스타일링 필요 */}
            <div className="images-row"> 
              {item.image.map((src, i) => <img key={i} src={src} alt="수어" />)}
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