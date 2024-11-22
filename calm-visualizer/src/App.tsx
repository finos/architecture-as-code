import './App.css'
import Drawer from './components/drawer/Drawer'
import CytoscapeRenderer from "./components/cytoscape-renderer/CytoscapeRenderer.tsx";

function App() {
    const nodes = [
        {data:  {id: '1', label: 'Trader X'}},
        {data:  {id: '2', label: 'Google'}},
    ];

    const edges = [
        {data: {source: '1', target: '2', label: 'Interacts with'}}
    ];

    return (
        <>
            <Drawer />
            <CytoscapeRenderer nodes={nodes} edges={edges} />
        </>
    )
}

export default App
