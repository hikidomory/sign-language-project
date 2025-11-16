import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { quizData } from '../../data/quizData';
import './SpeedGame.css';

const SpeedGame = () => {
  const TOTAL_QUESTIONS = 10;
  
  const [gameState, setGameState] = useState('start'); // 'start', 'playing', 'end'
  const [quizList, setQuizList] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timer, setTimer] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [isShaking, setIsShaking] = useState(false); // 오답 시 흔들림 효과

  const timerRef = useRef(null);

  // 게임 초기화
  const startGame = () => {
    // 1. 단일 이미지 문제만 필터링 (빠른 진행을 위해)
    const keys = Object.keys(quizData).filter(k => !Array.isArray(quizData[k].image));
    // 2. 10문제 랜덤 추출
    const shuffled = keys.sort(() => 0.5 - Math.random()).slice(0, TOTAL_QUESTIONS);
    const questions = shuffled.map(key => quizData[key]);

    setQuizList(questions);
    setCurrentIndex(0);
    setTimer(0);
    setWrongCount(0);
    setUserInput("");
    setGameState('playing');
  };

  // 타이머
  useEffect(() => {
    if (gameState === 'playing') {
      timerRef.current = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [gameState]);

  // 정답 제출
  const checkAnswer = () => {
    const currentQuiz = quizList[currentIndex];
    
    if (userInput.trim() === currentQuiz.answer) {
      // 정답
      if (currentIndex + 1 >= TOTAL_QUESTIONS) {
        setGameState('end');
      } else {
        setCurrentIndex(prev => prev + 1);
        setUserInput("");
      }
    } else {
      // 오답
      setWrongCount(prev => prev + 1);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 400);
      setUserInput("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') checkAnswer();
  };

  // 최종 점수 계산 (1000점 만점 - 시간 - 오답감점)
  const finalScore = Math.max(0, 1000 - (timer * 5) - (wrongCount * 50));

  return (
    <div className="speed-game-container">
      {/* --- 시작 화면 --- */}
      {gameState === 'start' && (
        <div className="intro-box">
          <div className="icon">⚡️</div>
          <h1>스피드 퀴즈</h1>
          <p>10문제를 가장 빠르게 맞춰보세요!</p>
          <div className="rules">
            <p>🎯 총 10문제</p>
            <p>⏳ 시간이 흐를수록 점수 차감</p>
            <p>❌ 틀리면 감점 & 시간 낭비!</p>
          </div>
          <button className="action-btn" onClick={startGame}>도전 시작!</button>
        </div>
      )}

      {/* --- 게임 화면 --- */}
      {gameState === 'playing' && quizList.length > 0 && (
        <div className="game-screen">
          <div className="top-bar">
            <div className="progress">문제 <span>{currentIndex + 1}</span> / {TOTAL_QUESTIONS}</div>
            <div className="timer-box">⏱️ {timer}초</div>
          </div>

          <div className="quiz-card">
            <div className="img-wrapper">
              <img src={quizList[currentIndex].image} alt="퀴즈" />
            </div>

            <div className="input-wrapper">
              <input 
                type="text" 
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="정답 입력"
                className={isShaking ? 'shake' : ''}
                autoFocus
              />
              <button onClick={checkAnswer}>확인</button>
            </div>
          </div>
        </div>
      )}

      {/* --- 결과 화면 --- */}
      {gameState === 'end' && (
        <div className="result-box">
          <h2>🎉 게임 종료! 🎉</h2>
          <div className="score-display">
            <span className="score-label">최종 점수</span>
            <span className="final-score">{finalScore}점</span>
          </div>
          
          <div className="stats-grid">
            <div className="stat-item">
              <span>⏱️ 소요 시간</span>
              <span>{timer}초</span>
            </div>
            <div className="stat-item">
              <span>❌ 틀린 횟수</span>
              <span>{wrongCount}회</span>
            </div>
          </div>

          <div className="btn-group">
            <button className="action-btn" onClick={startGame}>다시 도전</button>
            <Link to="/arcade" className="action-btn secondary">나가기</Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpeedGame;