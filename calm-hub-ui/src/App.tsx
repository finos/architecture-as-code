import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Hub from './hub/Hub.js';
import Visualizer from './visualizer/Visualizer.js';
import React from 'react';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Hub />} />
                <Route path="/visualizer" element={<Visualizer />} />
            </Routes>
        </Router>
    );
}

export default App;