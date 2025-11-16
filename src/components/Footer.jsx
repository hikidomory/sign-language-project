import React from 'react';

const Footer = () => {
  const style = {
    position: 'fixed',
    left: 0,
    bottom: 0,
    width: '100%',
    color: 'black',
    textAlign: 'center',
    padding: '20px 0',
    zIndex: 100,
    borderTop: '1px solid black',
    backgroundColor: 'white'
  };

  return (
    <footer style={style}>
      <span className="footer_title">copyright@hikidomory</span>
    </footer>
  );
};

export default Footer;