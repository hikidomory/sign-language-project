import React, { useRef } from 'react'; // ✅ useRef 추가
import Slider from 'react-slick';
import { Link } from 'react-router-dom';
import { bookData } from '../data/bookData';
import './BookSlider.css';

import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

const BookSlider = () => {
  // ✅ 슬라이더를 제어하기 위한 Ref 생성
  const sliderRef = useRef(null);

  const settings = {
    dots: false,
    infinite: true,
    speed: 500,
    slidesToShow: 4,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 3000,
    arrows: false, // ✅ 슬라이더 자체 화살표는 숨김 (커스텀 화살표 사용)
    responsive: [
      { breakpoint: 1024, settings: { slidesToShow: 3 } },
      { breakpoint: 768, settings: { slidesToShow: 2 } },
      { breakpoint: 480, settings: { slidesToShow: 1 } }
    ]
  };

  return (
    <div className="book-section-wrapper">
      <div className="book-container">
        
        {/* 왼쪽 패널 */}
        <div className="book-info-panel">
          <h3>수어 교재 추천</h3>
          <h1>
            초보자를 위한<br />
            맞춤형 수어 가이드,<br />
            함께 시작해볼까요?
          </h1>
          <div className="page-indicator">
             <span>Slide</span>
             <div className="arrows">
               {/* ✅ 클릭 이벤트 연결 */}
               <span onClick={() => sliderRef.current.slickPrev()}>&lt;</span> 
               <span onClick={() => sliderRef.current.slickNext()}>&gt;</span>
             </div>
          </div>
        </div>

        {/* 오른쪽 슬라이더 */}
        <div className="book-slider-area">
          {/* ✅ ref 연결 */}
          <Slider ref={sliderRef} {...settings}>
            {bookData.map((book) => (
              <div key={book.id} className="book-card-wrapper">
                <div className="book-card">
                  <div className="book-img-box">
                    <img src={book.img} alt={book.title} />
                    <div className="book-overlay">
                      <p>{book.desc}</p>
                    </div>
                  </div>
                  <div className="book-meta">
                    <h4>{book.title}</h4>
                    <Link to="/study" className="start-btn">
                      학습 시작 <span className="dot">●</span>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </Slider>
        </div>

      </div>
    </div>
  );
};

export default BookSlider;