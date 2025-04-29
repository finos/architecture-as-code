import { HashRouter as Router, Route, Routes } from 'react-router-dom';
import Hub from './hub/Hub.js';
import Visualizer from './visualizer/Visualizer.js';
import { ControlPage } from './control-creator/ControlPage.js';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Hub />} />
                <Route path="/visualizer" element={<Visualizer />} />
                <Route path="/control-editor" element={<ControlPage />} />
            </Routes>
        </Router>
    );
}

export default App;
