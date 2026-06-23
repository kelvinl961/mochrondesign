import { defineCollection, z } from 'astro:content';

const projects = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    location: z.string(),
    image: z.string(),
    propertyType: z.string().optional(),
    projectTab: z.enum(['completed', 'visualization']).default('completed'),
    designConcept: z.string().optional(),
    designer: z.string().optional(),
    description: z.string().optional(),
    gallery: z
      .array(z.union([z.string(), z.object({ image: z.string() })]))
      .optional(),
  }),
});

export const collections = { projects };
