import React from 'react';
import { siteData } from '../data/siteData';
import './RelatedSites.css';

const RelatedSites = () => {
  return (
    <section className="sites-section">
      <div className="sites-container">
        <div className="sites-title">
          <h2>더 넓은 수어의 세상으로</h2>
          <p>도움이 되는 다양한 사이트를 확인해보세요.</p>
        </div>

        <div className="sites-grid">
          {siteData.map((group, index) => (
            <div key={index} className="site-group-card">
              <h3>{group.category}</h3>
              <ul className="site-list">
                {group.links.map((site, idx) => (
                  <li key={idx}>
                    <a href={site.url} target="_blank" rel="noopener noreferrer" className="site-link">
                      <span className="site-name">{site.name}</span>
                      <span className="site-desc">{site.desc}</span>
                      <span className="arrow">↗</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default RelatedSites;