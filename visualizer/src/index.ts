import { CALMManifest } from './Types';
import { MermaidBuilder } from './MermaidBuilder.js';
import mermaid, { Mermaid } from 'mermaid';
import { chromium } from 'playwright';
import path from 'path';
import url from 'url';
import * as winston from 'winston';

let logger: winston.Logger; // defined later at startup

declare global {
    // eslint-disable-next-line no-var
    var mermaid: Mermaid;  
}

function getMermaidString(calm: CALMManifest): string {
    logger.debug('Building Mermaid string from this object:');
    logger.debug(JSON.stringify(calm));

    const mermaidBuilder: MermaidBuilder = new MermaidBuilder();

    logger.debug('Creating nodes...');
    calm.nodes.map(node => {
        mermaidBuilder.addNode(node);
    });

    logger.debug('Creating relationships...');
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

export async function visualize(calmString: string, debug?: boolean): Promise<string> {
    const level = debug ? 'debug' : 'info';
    logger = winston.createLogger({
        transports: [
            new winston.transports.Console()
        ],
        level: level,
        format: winston.format.cli()
    });

    logger.info('Converting CALM Specification to Mermaid');
    const calm: CALMManifest = JSON.parse(calmString);
    const mermaidString = getMermaidString(calm);

    mermaid.initialize({ startOnLoad: false });

    logger.debug('Launching headless browser to render Mermaid');
    
    // setup
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    // navigate to page with mermaid preloaded
    const __dirname = url.fileURLToPath(new url.URL('.', import.meta.url));
    const mermaidHTMLPath = path.join(__dirname, '..', 'dist', 'index.html');
    await page.goto(url.pathToFileURL(mermaidHTMLPath).href);

    logger.debug('Converting Mermaid string into an SVG within the browser context');
    const svg = await page.$eval('#container', renderMermaid, mermaidString);

    // teardown
    await context.close();
    await browser.close();

    logger.debug('Browser has been successfully shut down');
    return svg;
}