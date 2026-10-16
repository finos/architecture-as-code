// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { LESSONS } from './index';

// The docs site adds a "Try in Learning Lab" chip and card to each tutorial in this map.
const PLUGIN = new URL('../../../docs/src/plugins/remark-section-callouts.js', import.meta.url).href;
const TUTORIALS = 'https://calm.finos.org/tutorials/';

async function docsLabLessons(): Promise<Record<string, string>> {
    const plugin = (await import(/* @vite-ignore */ PLUGIN)) as { LAB_LESSONS: Record<string, string> };
    return plugin.LAB_LESSONS;
}

/** `https://calm.finos.org/tutorials/beginner/02-first-node/` -> `tutorials/beginner/02-first-node.md` */
function docPath(url: string): string {
    return `tutorials/${url.slice(TUTORIALS.length).replace(/\/$/, '')}.md`;
}

describe('docs links to the lab', () => {
    it('link every registered lesson from the tutorial it follows', async () => {
        const docs = await docsLabLessons();
        for (const lesson of LESSONS) {
            expect(docs[docPath(lesson.tutorial!.url)], lesson.id).toBe(lesson.id);
        }
    });

    it('link only lessons the lab registers', async () => {
        const ids = new Set(LESSONS.map((lesson) => lesson.id));
        for (const [page, lessonId] of Object.entries(await docsLabLessons())) {
            expect(ids.has(lessonId), `${page} -> ${lessonId}`).toBe(true);
        }
    });
});
