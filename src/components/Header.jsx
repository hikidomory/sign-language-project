import React from 'react';
import { Link } from 'react-router-dom';
import './Header.css'; // 스타일 파일은 잠시 후에 만듦

const Header = () => {
  return (
    <nav className="header_nav">
      <Link to="/">
        <img src="/images/icon4.png" alt="메인 로고" id="main_icon" />
      </Link>
      <div>
        <span className="nav_content"><Link to="/study">수어 배움터</Link></span>
        <span className="nav_content"><Link to="/dictionary">수어 사전</Link></span>
        <span className="nav_content"><Link to="/translator">수어 번역기</Link></span>
        <span className="nav_content"><Link to="/arcade">오락실</Link></span>
        <span className="nav_content"><Link to="/tree">나무 키우기</Link></span>
      </div>
      <img src="/images/menu3.png" alt="메뉴" id="nav_menu" />
    </nav>
  );
};

export default Header;