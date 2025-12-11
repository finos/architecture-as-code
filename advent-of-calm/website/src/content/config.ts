import { defineCollection } from 'astro:content';

const daysCollection = defineCollection({
  type: 'content',
});

export const collections = {
  days: daysCollection,
};
