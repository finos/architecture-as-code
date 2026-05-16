import { useState } from 'react';
import { Navbar } from '../components/navbar/Navbar.js';
import { CalmArchitectureSchema } from '@finos/calm-models/types';
import { diffArchitectures } from '../service/diff-service.js';
import type { DiffResult } from '../model/diff.js';
import './Diff.css';
import { DiffPanel } from './components/DiffPanel.js';
import { DiffGraphPanel } from './components/DiffGraphPanel.js';

export default function Diff() {
    const [archA, setArchA] = useState<CalmArchitectureSchema | null>(null);
    const [archB, setArchB] = useState<CalmArchitectureSchema | null>(null);
    const [diffResult, setDiffResult] = useState<DiffResult | null>(null);

    const handleFileLoad = (file: File, isFirst: boolean) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result as string) as CalmArchitectureSchema;
                if (isFirst) {
                    setArchA(data);
                } else {
                    setArchB(data);
                }

                // If both architectures are loaded, compute diff
                if ((isFirst && archB) || (!isFirst && archA)) {
                    const result = diffArchitectures(isFirst ? data : archA!, isFirst ? archB! : data);
                    setDiffResult(result);
                }
            } catch (error) {
                console.error('Error parsing CALM file:', error);
                alert('Error parsing CALM file. Please ensure it\'s valid JSON.');
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="h-screen flex flex-col">
            <Navbar />
            <div className="flex-1 flex">
                <DiffGraphPanel
                    archA={archA}
                    archB={archB}
                    diffResult={diffResult}
                    onFileLoad={handleFileLoad}
                />
                <DiffPanel diffResult={diffResult} />
            </div>
        </div>
    );
}