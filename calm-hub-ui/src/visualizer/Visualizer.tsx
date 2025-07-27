import { useMemo } from 'react';
import './Visualizer.css';
import { Drawer } from './components/drawer/Drawer.js';
import { Navbar } from '../components/navbar/Navbar.js';
import { useLocation } from 'react-router-dom';

function Visualizer() {
    const location = useLocation();
    const data = useMemo(() => location.state || {}, [location.state]);

    return (
        <div className="h-screen flex flex-col">
            <Navbar />
            <Drawer data={data} />
        </div>
    );
}

export default Visualizer;
