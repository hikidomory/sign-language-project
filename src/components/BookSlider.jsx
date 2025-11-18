import React from 'react';
import Slider from 'react-slick';
import { Link } from 'react-router-dom';
import { bookData } from '../data/bookData';
import './BookSlider.css';

// react-slick CSS는 Home.jsx에서 이미 import 했으므로 생략 가능하지만, 
// 독립적인 컴포넌트 사용을 위해 넣어두어도 무방합니다.
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

const BookSlider = () => {
  const settings = {
    dots: false, // 하단 점 숨김
    infinite: true,
    speed: 500,
    slidesToShow: 4, // 한 번에 보여줄 책 개수 (화면 크기에 따라 조정됨)
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 3000,
    responsive: [
      {
        breakpoint: 1024,
        settings: { slidesToShow: 3 }
      },
      {
        breakpoint: 768,
        settings: { slidesToShow: 2 }
      },
      {
        breakpoint: 480,
        settings: { slidesToShow: 1 }
      }
    ]
  };

  return (
    <div className="book-section-wrapper">
      <div className="book-container">
        
        {/* 왼쪽: 타이틀 및 설명 영역 (파란색 박스) */}
        <div className="book-info-panel">
          <h3>수어 교재 추천</h3>
          <h1>
            초보자를 위한<br />
            맞춤형 수어 가이드,<br />
            함께 시작해볼까요?
          </h1>
          <div className="page-indicator">
             {/* 디자인 요소 (장식용) */}
             <span>1 / 2</span>
             <div className="arrows">
               <span>&lt;</span> <span>&gt;</span>
             </div>
          </div>
        </div>

        {/* 오른쪽: 슬라이더 영역 */}
        <div className="book-slider-area">
          <Slider {...settings}>
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