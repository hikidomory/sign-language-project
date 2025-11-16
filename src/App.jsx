import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Dictionary from './pages/Dictionary';
import Home from './pages/Home';
import Study from './pages/Study'; 
import Translator from './pages/Translator';
import Arcade from './pages/Arcade';
import CardGame from './pages/games/CardGame';
import Tree from './pages/Tree';
import RainGame from './pages/games/RainGame';
import SpeedGame from './pages/games/SpeedGame'; 

function App() {
  return (
    <Router>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dictionary" element={<Dictionary />} />
        <Route path="/study" element={<Study />} /> 
        <Route path="/translator" element={<Translator />} />
        <Route path="/arcade" element={<Arcade />} />
        <Route path="/arcade/card" element={<CardGame />} />
        <Route path="/arcade/rain" element={<RainGame />} />
        <Route path="/arcade/speed" element={<SpeedGame />} />
        <Route path="/tree" element={<Tree />} />
      </Routes>
      <Footer />
    </Router>
  );
}

export default App;