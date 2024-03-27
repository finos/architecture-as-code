import { visualize } from 'calm-visualizer';
import * as fs from 'fs';

export default async function({input, output}: {input: string, output: string}) {
    const calm = fs.readFileSync(input, 'utf-8');
    const svg = await visualize(calm); 
    fs.writeFileSync(output, svg);
}