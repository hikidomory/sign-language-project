import React from 'react';
import { Link } from 'react-router-dom';
import './Arcade.css';

const Arcade = () => {
  return (
    <div className="arcade-container">
      <div className="page-title">
        <h1>수어 오락실</h1>
        <p className="subtitle">게임을 통해 즐겁게 수어를 익혀보세요! 🕹️</p>
      </div>

      <div className="game-list">
        {/* 1. 카드 짝 맞추기 */}
        <Link to="/arcade/card" className="game-card">
          <div className="card-icon">
             <span>🃏</span>
          </div>
          <div className="card-info">
            <h3>카드 짝 맞추기</h3>
            <p>같은 그림과 글자를 찾아보세요!</p>
            <span className="play-btn">PLAY</span>
          </div>
        </Link>

        {/* 2. 수어 산성비 */}
        <Link to="/arcade/rain" className="game-card">
          <div className="card-icon">
             <span>⚡</span>
          </div>
          <div className="card-info">
            <h3>수어 산성비</h3>
            <p>내려오는 수어를 맞춰 점수를 획득하세요!</p>
            <span className="play-btn">PLAY</span>
          </div>
        </Link>

        {/* 3. 스피드 퀴즈 */}
        <Link to="/arcade/speed" className="game-card">
          <div className="card-icon">
             <span>🧩</span>
          </div>
          <div className="card-info">
            <h3>스피드 퀴즈</h3>
            <p>제한 시간 내에 최대한 많이 맞히세요!</p>
            <span className="play-btn">PLAY</span>
          </div>
        </Link>

        {/* ✅ 4. 준비 중인 게임 (추가됨) */}
        <div className="game-card locked" onClick={() => alert("현재 개발 중인 게임입니다! 조금만 기다려주세요 🚧")}>
          <div className="card-icon">
             <span>🔒</span>
          </div>
          <div className="card-info">
            <h3>준비 중</h3>
            <p>더 재미있는 게임이 찾아옵니다.</p>
            <span className="play-btn">LOCKED</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Arcade;