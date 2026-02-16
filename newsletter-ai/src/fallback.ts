import type { TemplatePreferences, GenerateContentOptions, ContentItem } from './types';
import { extractManifest } from './manifest';

export function generateFallbackTemplate(prefs: TemplatePreferences): string {
  const lines: string[] = [];
  const { streamName, categories, tone, brandIdentity } = prefs;

  const primary = prefs.colors?.primary ?? '#1a1a1a';
  const accent = prefs.colors?.accent ?? '#e2725b';
  const templateName = brandIdentity?.name ?? streamName;

  lines.push('--- meta');
  lines.push('version: 1');
  lines.push(`title: ${templateName}`);
  lines.push('');
  lines.push('--- use: newsletter');
  lines.push('');
  lines.push('--- style');
  lines.push(`accent: ${accent}`);
  lines.push(`colorPrimary: ${primary}`);
  if (tone === 'formal') {
    lines.push("fontBody: Georgia, 'Times New Roman', serif");
    lines.push("fontHeading: Georgia, 'Times New Roman', serif");
  } else {
    lines.push("fontBody: 'Helvetica Neue', Arial, sans-serif");
    lines.push("fontHeading: 'Helvetica Neue', Arial, sans-serif");
  }
  lines.push('');

  if (brandIdentity?.logoUrl) {
    lines.push('--- header');
    lines.push(`logo: ${brandIdentity.logoUrl}`);
    lines.push(`title: ${templateName}`);
    lines.push('');
  }

  lines.push('--- intro');
  lines.push('');
  lines.push(`[Welcome to ${templateName}! Here's what we have for you this week.]`);
  lines.push('');

  for (const cat of categories) {
    lines.push('--- category');
    lines.push(`title: ${cat}`);
    lines.push('');
    lines.push('--- item');
    lines.push(`source: [Source]`);
    lines.push(`link: https://example.com`);
    lines.push('');
    lines.push('[Item description and editorial commentary goes here.]');
    lines.push('');
    lines.push(`--- /category`);
    lines.push('');
  }

  lines.push('--- outro');
  lines.push('ctaUrl: https://example.com/subscribe');
  lines.push('ctaText: Share This Newsletter');
  lines.push('');
  lines.push('[Thanks for reading! See you next week.]');

  return lines.join('\n');
}

export function generateFallbackContent(options: GenerateContentOptions): string {
  const { templateSource, contentItems, title, brandIdentity } = options;

  if (contentItems.length === 0) return templateSource;

  const manifest = extractManifest(templateSource);
  const lines: string[] = [];

  lines.push('--- meta');
  lines.push('version: 1');
  lines.push(`title: ${title ?? manifest.title ?? 'Newsletter'}`);
  lines.push('');
  lines.push('--- use: newsletter');
  lines.push('');

  if (Object.keys(manifest.styleVariables).length > 0) {
    lines.push('--- style');
    for (const [key, value] of Object.entries(manifest.styleVariables)) {
      lines.push(`${key}: ${value}`);
    }
    lines.push('');
  }

  const itemsByCategory = new Map<string, ContentItem[]>();
  const uncategorized: ContentItem[] = [];

  for (const item of contentItems) {
    const cat = item.category ?? 'uncategorized';
    if (cat === 'uncategorized') {
      uncategorized.push(item);
    } else {
      const existing = itemsByCategory.get(cat) ?? [];
      existing.push(item);
      itemsByCategory.set(cat, existing);
    }
  }

  const usedItemIds = new Set<string>();

  for (const section of manifest.sections) {
    if (section.blockType === 'header') {
      lines.push('--- header');
      if (brandIdentity?.logoUrl) lines.push(`logo: ${brandIdentity.logoUrl}`);
      lines.push(`title: ${title ?? manifest.title ?? 'Newsletter'}`);
      lines.push('');
      continue;
    }

    if (section.blockType === 'intro') {
      lines.push('--- intro');
      lines.push('');
      lines.push(`Welcome to this edition of ${title ?? 'our newsletter'}.`);
      lines.push('');
      continue;
    }

    if (section.blockType === 'category') {
      const label = section.label ?? 'News';
      const categoryItems = itemsByCategory.get(label) ?? uncategorized;
      const availableItems = categoryItems.filter(i => !usedItemIds.has(i.id));

      if (availableItems.length === 0) continue;

      lines.push('--- category');
      lines.push(`title: ${label}`);
      lines.push('');

      for (const item of availableItems.slice(0, 5)) {
        usedItemIds.add(item.id);
        lines.push('--- item');
        if (item.source) lines.push(`source: ${item.source}`);
        if (item.url) lines.push(`link: ${item.url}`);
        if (item.imageUrl) lines.push(`image: ${item.imageUrl}`);
        lines.push('');
        const text = item.curatorNote ?? item.description ?? item.title;
        lines.push(text);
        lines.push('');
      }

      lines.push(`--- /category`);
      lines.push('');
      continue;
    }

    if (section.blockType === 'featured') {
      const item = contentItems.find(i => !usedItemIds.has(i.id));
      if (!item) continue;
      usedItemIds.add(item.id);

      lines.push('--- featured');
      if (item.imageUrl) lines.push(`image: ${item.imageUrl}`);
      if (item.url) lines.push(`link: ${item.url}`);
      if (item.source) lines.push(`source: ${item.source}`);
      if (item.author) lines.push(`author: ${item.author}`);
      lines.push('');
      lines.push(`**${item.title}**`);
      lines.push('');
      if (item.curatorNote) lines.push(item.curatorNote);
      else if (item.description) lines.push(item.description);
      lines.push('');
      continue;
    }

    if (section.blockType === 'quickHits') {
      const remaining = contentItems.filter(i => !usedItemIds.has(i.id));
      if (remaining.length === 0) continue;

      lines.push('--- quickHits');
      lines.push('');
      for (const item of remaining.slice(0, 5)) {
        usedItemIds.add(item.id);
        const link = item.url ? `[${item.title}](${item.url})` : item.title;
        lines.push(`- **${link}** — ${item.description ?? item.title}`);
      }
      lines.push('');
      continue;
    }

    if (section.blockType === 'outro') {
      lines.push('--- outro');
      for (const [key, value] of Object.entries(section.properties)) {
        lines.push(`${key}: ${value}`);
      }
      lines.push('');
      lines.push('Thanks for reading! See you next time.');
      lines.push('');
      continue;
    }

    lines.push(`--- ${section.blockType}`);
    if (section.label) {
      lines.push(`title: ${section.label}`);
    }
    for (const [key, value] of Object.entries(section.properties)) {
      lines.push(`${key}: ${value}`);
    }
    lines.push('');
    if (section.isContainer) {
      lines.push(`--- /${section.blockType}`);
      lines.push('');
    }
  }

  const remaining = contentItems.filter(i => !usedItemIds.has(i.id));
  if (remaining.length > 0) {
    lines.push('--- category');
    lines.push('title: More Stories');
    lines.push('');
    for (const item of remaining) {
      lines.push('--- item');
      if (item.source) lines.push(`source: ${item.source}`);
      if (item.url) lines.push(`link: ${item.url}`);
      if (item.imageUrl) lines.push(`image: ${item.imageUrl}`);
      lines.push('');
      lines.push(item.curatorNote ?? item.description ?? item.title);
      lines.push('');
    }
    lines.push('--- /category');
  }

  return lines.join('\n');
}
