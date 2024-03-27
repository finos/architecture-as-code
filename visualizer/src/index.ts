import { CALMManifest } from './Types';
import { MermaidBuilder } from './MermaidBuilder.js';
import mermaid, { Mermaid } from 'mermaid';
import puppeteer, { Browser, Page } from 'puppeteer';
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
    const browser: Browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-web-security'],
    });

    try {
        const page: Page = await browser.newPage();
        try {
            page.on('console', (msg) => {
                console.log(msg.text());
            });

            const __dirname = url.fileURLToPath(new url.URL('.', import.meta.url));
            const mermaidHTMLPath = path.join(__dirname, '..', 'dist', 'index.html');
            await page.goto(url.pathToFileURL(mermaidHTMLPath).href);
            
            console.log('Rendering the Mermaid string to SVG');
            const svg = await page.$eval('#container', renderMermaid, mermaidString);

            return svg;
        } finally {
            await page.close();
        }
    } finally {
        await browser.close();
    }
}