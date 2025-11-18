// src/pages/Home.jsx
import React from 'react';
import Slider from 'react-slick';
import { Link } from 'react-router-dom';

// 슬라이더 라이브러리 필수 CSS (import 순서 중요)
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import './Home.css';

const Home = () => {
  // 슬라이더 설정 (기존 index.js 설정 이식)
  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 3000,
    fade: true, // 부드럽게 전환되는 페이드 효과
    cssEase: "linear",
    arrows: false, // 화살표 숨김 (기존 디자인 따름)
  };

  return (
    <div className="home-container">
      {/* 1. 메인 슬라이더 섹션 */}
      <div className="main-slider-wrapper">
        <Slider {...settings}>
          <div className="slide-item">
            <img src="/images/main1.png" alt="배너 1" className="main-img" />
          </div>
          <div className="slide-item">
            <img src="/images/test2.jpg" alt="배너 2" className="main-img" />
          </div>
          <div className="slide-item">
            <img src="/images/test3.jpg" alt="배너 3" className="main-img" />
          </div>
        </Slider>
      </div>

      {/* 2. 학습 바로가기 섹션 (분홍색 배경) */}
      <div className="main-studyroom">
        <div id="studyroom_title">
          <div>수어 연습</div>
          <div>기초부터 탄탄하게!</div>
        </div>

        <div id="studyroom_list">
          <Link to="/study" className="studyroom_content">자음 연습</Link>
          <Link to="/study" className="studyroom_content">모음 연습</Link>
          <Link to="/study" className="studyroom_content">숫자 연습</Link>
          <Link to="/study" className="studyroom_content">전체 연습</Link>
          {/* 아래 항목들도 학습 페이지로 연결 (추후 기능 확장에 맞춰 수정 가능) */}
          <Link to="/study" className="studyroom_content">짧은 단어 연습</Link>
          <Link to="/study" className="studyroom_content">긴 단어 연습</Link>
        </div>
      </div>
    </div>
  );
};

export default Home;