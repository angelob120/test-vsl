import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Generator from './pages/Generator';
import LandingPage from './pages/LandingPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Generator />} />
      <Route path="/v/:slug" element={<LandingPage />} />
    </Routes>
  );
}

export default App;
