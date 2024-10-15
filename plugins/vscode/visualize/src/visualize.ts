import { calmToDot }  from './calmToDot.js';
import { instance } from '@viz-js/viz';

export async function visualize(instantiation: string): Promise<string | undefined> {
    try {
        const dot = calmToDot(JSON.parse(instantiation));
        return (await instance()).render(dot, { format: 'svg', engine: 'dot' }).output;
    } catch (error: unknown) {
        return 'Error creating SVG: Instantiation JSON is invalid';
    }
}