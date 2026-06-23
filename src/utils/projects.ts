import type { CollectionEntry } from 'astro:content';

export type ProjectEntry = CollectionEntry<'projects'>;

export type ProjectTab = 'completed' | 'visualization';

export function getGalleryImages(project: ProjectEntry): string[] {
  const items = project.data.gallery ?? [];
  const urls = items.map((item) =>
    typeof item === 'string' ? item : item.image,
  );
  return urls.length > 0 ? urls : [project.data.image];
}

export function formatProjectCaption(project: ProjectEntry) {
  const type = project.data.propertyType?.toLowerCase().trim();
  const location = project.data.location.toLowerCase().trim();
  const subtitle = [type, location].filter(Boolean).join(', ');
  return {
    title: `- ${project.data.title} -`,
    subtitle,
  };
}

export function projectUrl(project: ProjectEntry) {
  return `/projects/${project.id}`;
}
