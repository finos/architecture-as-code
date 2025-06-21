import { useEffect, useMemo, useState } from 'react';
import './Visualizer.css';
import { Drawer } from './components/drawer/Drawer.js';
import { Navbar } from '../components/navbar/Navbar.js';
import { Menu } from './components/menu/Menu.js';
import { useLocation } from 'react-router-dom';
import { CalmArchitectureSchema } from '@finos/calm-shared/src/types/core-types.js';

function Visualizer() {
    const [title, setTitle] = useState<string>('');
    const [instance, setCALMInstance] = useState<CalmArchitectureSchema | undefined>(undefined);
    const location = useLocation();
    const data = useMemo(() => location.state || {}, [location.state]);
    const [fileInstance, setFileInstance] = useState<string | undefined>(undefined);
    const [fileTitle, setFileTitle] = useState<string | undefined>(undefined);

    async function handleFile(instanceFile: File) {
        setFileTitle(instanceFile.name);
        const file = await instanceFile.text();
        setFileInstance(JSON.parse(file));
    }

    useEffect(() => {
        setTitle(fileTitle ?? data.name);
        setCALMInstance(fileInstance ?? data.data);
    }, [fileInstance, fileTitle, data]);

    return (
        <div className="h-screen flex flex-col">
            <Navbar />
            <Menu handleUpload={handleFile} />
            <Drawer calmInstance={instance} title={title} data={data} />
        </div>
    );
}

export default Visualizer;
