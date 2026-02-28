import { HashRouter as Router, Route, Routes } from 'react-router-dom';
import Hub from './hub/Hub.js';
import Visualizer from './visualizer/Visualizer.js';

function App() {
    //TODO: The artifacts route will eventually need to be changed/replaced once we create a unique identifier for resources that can be used across CalmHubs.
    //When this happens the logic to handle params in TreeNavigation will also have to be updated.
    //Currently the format of the route allows deeplinks to only be used within a single CalmHub.
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Hub />} />
                <Route path="/artifacts/:namespace?/:type?/:id?/:version?" element={<Hub />} />
                <Route path="/visualizer" element={<Visualizer />} />
            </Routes>
        </Router>
    );
}

export default App;
