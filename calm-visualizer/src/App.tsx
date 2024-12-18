import { useState } from 'react';
import './App.css';
import Drawer from './components/drawer/Drawer';
import Menu from './components/menu/Menu';
import { CALMInstantiation } from '../../shared/src/types';
import Navbar from './components/navbar/Navbar';

function App() {
    const [title, setTitle] = useState<string | undefined>(undefined);
    const [instance, setCALMInstance] = useState<CALMInstantiation | undefined>(undefined);

    async function handleFile(instanceFile: File) {
        const title = instanceFile.name;
        const file = await instanceFile.text();
        const instance = JSON.parse(file);

        setTitle(title);
        setCALMInstance(instance);
    }

    return (
        <div className="h-screen flex flex-col">
            <Navbar />
            <Menu callback={handleFile} />
            <Drawer calmInstance={instance} title={title} />
        </div>
    );
}

export default App;
