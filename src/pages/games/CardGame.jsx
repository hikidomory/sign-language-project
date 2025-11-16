import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { quizData } from '../../data/quizData'; // 데이터 불러오기
import './CardGame.css';

const CardGame = () => {
  const [cards, setCards] = useState([]);
  const [flippedCards, setFlippedCards] = useState([]); // 현재 뒤집힌 카드 2개
  const [matchedCount, setMatchedCount] = useState(0);
  const [isGameWon, setIsGameWon] = useState(false);
  const [lockBoard, setLockBoard] = useState(false); // 클릭 방지

  // 게임 초기화
  const initGame = () => {
    // 1. 데이터 중 이미지가 1개인 것만 필터링 (복잡한 단어 제외)
    const singleKeys = Object.keys(quizData).filter(key => !Array.isArray(quizData[key].image));
    
    // 2. 랜덤으로 8개 뽑기 (총 16장)
    const selectedKeys = singleKeys.sort(() => 0.5 - Math.random()).slice(0, 8);

    // 3. 카드 쌍 만들기 (이미지 카드 + 텍스트 카드)
    const gameCards = [];
    selectedKeys.forEach(key => {
      const item = quizData[key];
      // 이미지 카드
      gameCards.push({ id: `${key}-img`, key, type: 'img', content: item.image, isFlipped: false, isMatched: false });
      // 텍스트 카드
      gameCards.push({ id: `${key}-txt`, key, type: 'txt', content: item.answer, isFlipped: false, isMatched: false });
    });

    // 4. 섞기
    gameCards.sort(() => 0.5 - Math.random());
    
    setCards(gameCards);
    setFlippedCards([]);
    setMatchedCount(0);
    setIsGameWon(false);
    setLockBoard(false);

    // 5. (옵션) 시작 시 2초간 보여주기
    setLockBoard(true);
    const previewCards = gameCards.map(c => ({ ...c, isFlipped: true }));
    setCards(previewCards);

    setTimeout(() => {
      setCards(gameCards.map(c => ({ ...c, isFlipped: false })));
      setLockBoard(false);
    }, 2000);
  };

  useEffect(() => {
    initGame();
  }, []);

  // 카드 클릭 핸들러
  const handleCardClick = (index) => {
    if (lockBoard || cards[index].isFlipped || cards[index].isMatched) return;

    // 카드 뒤집기
    const newCards = [...cards];
    newCards[index].isFlipped = true;
    setCards(newCards);

    const newFlipped = [...flippedCards, { index, key: cards[index].key }];
    setFlippedCards(newFlipped);

    // 2장이 뒤집혔을 때 검사
    if (newFlipped.length === 2) {
      setLockBoard(true);
      checkForMatch(newFlipped, newCards);
    }
  };

  const checkForMatch = (flipped, currentCards) => {
    const [card1, card2] = flipped;
    const isMatch = card1.key === card2.key;

    if (isMatch) {
      // 매칭 성공
      const newCards = [...currentCards];
      newCards[card1.index].isMatched = true;
      newCards[card2.index].isMatched = true;
      setCards(newCards);
      setFlippedCards([]);
      setLockBoard(false);
      
      const newMatchedCount = matchedCount + 1;
      setMatchedCount(newMatchedCount);
      
      if (newMatchedCount === 8) { // 8쌍 모두 찾음
        setTimeout(() => setIsGameWon(true), 500);
      }
    } else {
      // 매칭 실패 -> 1초 후 다시 뒤집기
      setTimeout(() => {
        const newCards = [...currentCards];
        newCards[card1.index].isFlipped = false;
        newCards[card2.index].isFlipped = false;
        setCards(newCards);
        setFlippedCards([]);
        setLockBoard(false);
      }, 1000);
    }
  };

  return (
    <div className="card-game-container">
      <div className="game-header">
        <h2>🃏 카드 짝 맞추기</h2>
        <button className="reset-btn" onClick={initGame}>다시 시작</button>
      </div>

      {isGameWon ? (
        <div className="win-screen">
          <h1>🎉 성공! 🎉</h1>
          <p>모든 짝을 찾았습니다!</p>
          <button className="reset-btn big" onClick={initGame}>다시 도전</button>
          <Link to="/arcade" className="back-btn">나가기</Link>
        </div>
      ) : (
        <div className="card-grid">
          {cards.map((card, index) => (
            <div 
              key={card.id} 
              className={`card ${card.isFlipped || card.isMatched ? 'flipped' : ''} ${card.type}`}
              onClick={() => handleCardClick(index)}
            >
              <div className="face front">
                {card.type === 'img' ? <img src={card.content} alt="수어" /> : <span>{card.content}</span>}
              </div>
              <div className="face back">?</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CardGame;