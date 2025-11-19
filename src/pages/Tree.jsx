import React, { useState, useEffect } from 'react';
import { quizData } from '../data/quizData'; // 퀴즈 데이터 재사용
import './Tree.css';

const Tree = () => {
  const [completedDays, setCompletedDays] = useState([]); // 완료된 날짜들
  const [currentDate, setCurrentDate] = useState({ year: 0, month: 0, day: 0 });
  
  // 모달 관련 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [quizInfo, setQuizInfo] = useState(null);

  // 1. 초기화: 날짜 확인 및 로컬스토리지 로드
  useEffect(() => {
    // 🌟 [수정 부분 1]: body 클래스 추가
    document.body.classList.add('tree-page-bg');

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth(); // 0 ~ 11
    const day = today.getDate();
    setCurrentDate({ year, month, day });

    // 로컬스토리지 키 (월별로 따로 저장)
    const storageKey = `completedDays_${year}_${month}`;
    const savedData = JSON.parse(localStorage.getItem(storageKey)) || [];
    setCompletedDays(savedData);
    
    return () => {
      // 🌟 [수정 부분 2]: 컴포넌트가 사라질 때 클래스 제거
      document.body.classList.remove('tree-page-bg');
    };
  }, []); // 텅 빈 배열은 마운트/언마운트 시에만 실행을 보장합니다.

  // 2. 사과(날짜) 클릭 핸들러
  const handleSpotClick = (day) => {
    // 이미 완료한 날짜면 패스
    if (completedDays.includes(day)) {
      alert(`[${day}일] 이미 수확한 사과입니다! 🍎`);
      return;
    }

    // 오늘 날짜가 아니면 클릭 불가 (테스트할 때는 이 조건을 잠시 주석 처리해도 됨)
    if (day !== currentDate.day) {
      alert(`[${currentDate.day}일]의 퀴즈만 풀 수 있습니다. (선택: ${day}일)`);
      return;
    }

    // 퀴즈 데이터 가져오기 (날짜를 키값으로 사용, 없으면 랜덤/기본값)
    // quizData의 키가 1~31까지 있다고 가정하거나, 순환시킴
    const quizKey = String(day);
    const quiz = quizData[quizKey] || quizData["1"]; // 데이터 없으면 1번 문제

    setSelectedDay(day);
    setQuizInfo(quiz);
    setUserAnswer("");
    setIsModalOpen(true);
  };

  // 3. 정답 제출 핸들러
  const handleSubmit = () => {
    if (!quizInfo) return;

    if (userAnswer.trim() === quizInfo.answer) {
      alert("정답입니다! 사과가 열렸습니다! 🍎");
      
      // 상태 업데이트 & 로컬스토리지 저장
      const newCompleted = [...completedDays, selectedDay];
      setCompletedDays(newCompleted);
      
      const storageKey = `completedDays_${currentDate.year}_${currentDate.month}`;
      localStorage.setItem(storageKey, JSON.stringify(newCompleted));

      setIsModalOpen(false);
    } else {
      alert("틀렸습니다. 다시 도전해보세요!");
      setUserAnswer("");
    }
  };

  // 엔터키 처리
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  // 4. 달성률 계산
  const totalDays = new Date(currentDate.year, currentDate.month + 1, 0).getDate(); // 이번달 마지막 날짜
  // (수확량 / 오늘날짜) * 100 으로 계산
  const harvestRate = currentDate.day === 0 ? 0 : Math.round((completedDays.length / currentDate.day) * 100); 

  // 1~31일 배열 생성
  const daysArray = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="tree-container">
      <h1>나의 학습 나무</h1>
      <p className="subtitle">매일 퀴즈를 풀고 사과를 모아 나무를 완성하세요!</p>

      <div className="content-layout">
        {/* 나무 영역 */}
        <div id="tree-wrapper">
          <img src="/images/tree.png" alt="학습 나무" id="tree-img" />
          
          {daysArray.map(day => {
            // 이번 달 날짜보다 크면 숨김 (예: 2월 30일)
            if (day > totalDays) return null;

            const isCompleted = completedDays.includes(day);

            return (
              <div 
                key={day}
                className={`spot ${isCompleted ? 'completed' : ''}`}
                data-day={day}
                onClick={() => handleSpotClick(day)}
              >
                {isCompleted ? (
                  <img src="/images/apple.png" alt="사과" />
                ) : (
                  <span>{day}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* 칠판 영역 */}
        <aside className="scoreboard">
          <h2>학습 현황</h2>
          <div className="score-item">
            <span className="label">이름</span>
            <span className="value">방문자</span>
          </div>
          <div className="score-item">
            <span className="label">오늘 날짜</span>
            <span className="value">{currentDate.month + 1}월 {currentDate.day}일</span>
          </div>
          <div className="score-item">
            <span className="label">이달의 사과</span>
            <span className="value">{completedDays.length}개</span>
          </div>
          <div className="score-item">
            <span className="label">현재 달성률</span>
            <span className="value">{harvestRate}%</span>
          </div>
        </aside>
      </div>

      {/* 퀴즈 모달 */}
      {isModalOpen && quizInfo && (
        <div className="quiz-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="quiz-modal" onClick={(e) => e.stopPropagation()}>
            <button className="quiz-close-btn" onClick={() => setIsModalOpen(false)}>&times;</button>
            <h2>Today's Quiz (Day {selectedDay})</h2>
            <p>{quizInfo.question}</p>
            
            <div className="quiz-imgs">
              {Array.isArray(quizInfo.image) ? (
                quizInfo.image.map((src, i) => <img key={i} src={src} alt="퀴즈" />)
              ) : (
                <img src={quizInfo.image} alt="퀴즈" />
              )}
            </div>

            <input 
              type="text" 
              className="quiz-input"
              placeholder="정답 입력"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <br />
            <button className="quiz-submit-btn" onClick={handleSubmit}>정답 확인</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tree;