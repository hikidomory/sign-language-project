import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { quizData } from '../../data/quizData';
import './RainGame.css';

const RainGame = () => {
  // --- 상태 변수 ---
  const [items, setItems] = useState([]); 
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3); // 화면 표시용 State
  const [isPlaying, setIsPlaying] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [gameOver, setGameOver] = useState(false);

  // --- Refs (게임 루프용 실시간 값) ---
  const gameLoopRef = useRef(null);
  const spawnLoopRef = useRef(null);
  const itemsRef = useRef([]); 
  const scoreRef = useRef(0);
  const livesRef = useRef(3); // 🌟 핵심: 실시간 목숨 추적용 Ref 추가

  // --- 게임 시작 ---
  const startGame = () => {
    setItems([]);
    itemsRef.current = [];
    setScore(0);
    scoreRef.current = 0;
    
    setLives(3);
    livesRef.current = 3; // Ref도 초기화
    
    setGameOver(false);
    setIsPlaying(true);
    setUserInput("");
  };

  // --- 아이템 생성 (Spawn) ---
  const spawnItem = () => {
    const keys = Object.keys(quizData);
    
    let candidates = [];
    if (scoreRef.current < 50) {
      candidates = keys.filter(k => quizData[k].answer.length === 1);
    } else {
      candidates = keys.filter(k => quizData[k].answer.length >= 2);
    }
    if (candidates.length === 0) candidates = keys;

    const randomKey = candidates[Math.floor(Math.random() * candidates.length)];
    const quiz = quizData[randomKey];
    const randomX = Math.floor(Math.random() * 80) + 5;

    const newItem = {
      id: Date.now(), // 고유 ID
      x: randomX,
      y: -10,
      answer: quiz.answer,
      image: Array.isArray(quiz.image) ? quiz.image : [quiz.image]
    };

    // 상태와 Ref 동시 업데이트
    setItems(prev => {
      const newItems = [...prev, newItem];
      itemsRef.current = newItems;
      return newItems;
    });
  };

  // --- 게임 루프 (핵심 수정) ---
  useEffect(() => {
    if (isPlaying) {
      spawnLoopRef.current = setInterval(spawnItem, 3000);

      gameLoopRef.current = setInterval(() => {
        // Ref를 기준으로 연산 (상태 의존성 제거)
        const currentItems = itemsRef.current;
        const survivingItems = [];
        let lifeLostCount = 0; // 이번 프레임에서 잃은 목숨 수

        const updatedItems = currentItems.map(item => ({
          ...item,
          y: item.y + (1 + Math.floor(scoreRef.current / 50) * 0.2)
        }));

        updatedItems.forEach(item => {
          if (item.y > 95) { // 바닥(95%)에 닿음
            lifeLostCount++; // 카운트 증가
            // survivingItems에 넣지 않음 -> 삭제됨
          } else {
            survivingItems.push(item);
          }
        });

        // 아이템 목록 업데이트 (Ref & State)
        itemsRef.current = survivingItems;
        setItems(survivingItems);

        // 🌟 목숨 차감 로직 (Ref 사용으로 중복 차감 방지)
        if (lifeLostCount > 0) {
          livesRef.current -= lifeLostCount; 
          
          // 화면용 State 업데이트 (음수 방지)
          setLives(Math.max(0, livesRef.current));

          // 게임 오버 체크
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

  // --- 정답 체크 ---
  const handleInput = (e) => {
    if (e.key === 'Enter') {
      const value = userInput.trim();
      if (!value) return;

      // 현재 화면에 있는 아이템 중에서 찾기 (itemsRef 사용)
      const currentItems = itemsRef.current;
      const hitIndex = currentItems.findIndex(item => item.answer === value);

      if (hitIndex !== -1) {
        // 정답!
        const newItems = [...currentItems];
        newItems.splice(hitIndex, 1);
        
        // 즉시 반영
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
        {/* 🌟 수정: 음수가 들어가는 것을 방지하기 위해 Math.max 사용 */}
        <div className="life-board">{'❤'.repeat(Math.max(0, lives))}</div>
      </div>

      <div className="sky-area">
        {!isPlaying && !gameOver && (
          <div className="start-msg">
             <h2>수어 산성비</h2>
             <button onClick={startGame}>게임 시작</button>
          </div>
        )}

        {items.map(item => (
          <div 
            key={item.id} 
            className="drop-item" 
            style={{ left: `${item.x}%`, top: `${item.y}%` }}
          >
            {item.image.map((src, i) => <img key={i} src={src} alt="수어" />)}
          </div>
        ))}
      </div>

      <div className="input-area">
        <input 
          type="text" 
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={handleInput}
          placeholder={isPlaying ? "정답을 입력하고 엔터!" : "게임 시작을 눌러주세요"}
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