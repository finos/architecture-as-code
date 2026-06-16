import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

const daysCollection = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/days' }),
});

export const collections = {
  days: daysCollection,
};
