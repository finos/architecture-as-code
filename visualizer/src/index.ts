import { CALMManifest } from './Types';
import { MermaidBuilder } from './MermaidBuilder.js';
import mermaid, { Mermaid } from 'mermaid';
import { chromium } from 'playwright';
import path from 'path';
import url from 'url';

declare global {
    // eslint-disable-next-line no-var
    var mermaid: Mermaid;  
}

function getMermaidString(calm: CALMManifest): string {
    const mermaidBuilder: MermaidBuilder = new MermaidBuilder();

    calm.nodes.map(node => {
        mermaidBuilder.addNode(node);
    });

    calm.relationships.map(relationship => {
        mermaidBuilder.addRelationship(relationship);
    });

    return mermaidBuilder.getMermaid();
}

async function renderMermaid(container: Element, mermaidString: string) {
    const { mermaid } = (globalThis);

    mermaid.initialize({ startOnLoad: false });

    const { svg: svgText } = await mermaid.render('my-svg', mermaidString, container);
    return svgText;
}

export async function visualize(calmString: string): Promise<string> {
    console.log('Converting CALM Specification to Mermaid');
    const calm: CALMManifest = JSON.parse(calmString);
    const mermaidString = getMermaidString(calm);

    mermaid.initialize({ startOnLoad: false });

    console.debug('Launching headless browser to render Mermaid');
    
    // setup
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    // navigate to page with mermaid preloaded
    const __dirname = url.fileURLToPath(new url.URL('.', import.meta.url));
    const mermaidHTMLPath = path.join(__dirname, '..', 'dist', 'index.html');
    await page.goto(url.pathToFileURL(mermaidHTMLPath).href);

    const svg = await page.$eval('#container', renderMermaid, mermaidString);

    // teardown
    await context.close();
    await browser.close();

    return svg;
}