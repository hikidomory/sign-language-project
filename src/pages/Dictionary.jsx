import React from 'react';
import './Dictionary.css';
import { consonants, vowels, numbers } from '../data/dictionaryData';

// 작은 카드들을 뿌려주는 재사용 컴포넌트
const Section = ({ title, data }) => {
  return (
    <>
      <h2>{title}</h2>
      <div className="dictionary-grid">
        {data.map((item, index) => (
          <div className="dict-item" key={index}>
            {/* public 폴더의 이미지는 바로 경로 사용 가능 */}
            <img src={item.img} alt={item.label} />
            <p>{item.label}</p>
          </div>
        ))}
      </div>
    </>
  );
};

const Dictionary = () => {
  return (
    <div className="dictionary-wrap">
      <h1>수어 사전</h1>
      <p className="subtitle">기초부터 차근차근 배워보세요!</p>

      <Section title="☝️ 지문자 (자음)" data={consonants} />
      <Section title="☝️ 지문자 (모음)" data={vowels} />
      <Section title="🔢 지숫자" data={numbers} />
    </div>
  );
};

export default Dictionary;