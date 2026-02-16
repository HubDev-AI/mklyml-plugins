import type { GenerateNotesOptions, GenerateNotesResult, ItemNote, ContentItem } from './types';
import { buildPrompt } from './prompt-builder';

export async function generateNotes(
  options: GenerateNotesOptions,
): Promise<GenerateNotesResult> {
  const { provider, contentItems, streamName } = options;

  const itemsContext = formatItemsForNotes(contentItems);

  const system = `You are a senior newsletter editor. Generate editorial notes for content items. Return ONLY valid JSON.`;

  const user = buildPrompt('notes_generation', {
    streamName: streamName ?? 'Newsletter',
    itemsContext,
  });

  const result = await provider.generate({
    system,
    user,
    temperature: 0.8,
    maxTokens: 4096,
  });

  const notes = parseNotesResponse(result.text);
  return { notes };
}

function formatItemsForNotes(items: ContentItem[]): string {
  return items.map((item, i) => {
    const lines: string[] = [];
    lines.push(`--- ITEM ${i + 1} ---`);
    lines.push(`ID: ${item.id}`);
    lines.push(`Title: ${item.title}`);
    if (item.url) lines.push(`URL: ${item.url}`);
    if (item.source) lines.push(`Source: ${item.source}`);
    if (item.author) lines.push(`Author: ${item.author}`);
    if (item.publishedAt) lines.push(`Published: ${item.publishedAt}`);
    if (item.description) lines.push(`Description: ${item.description}`);
    if (item.fullText) {
      const truncated = item.fullText.slice(0, 5000);
      lines.push(`FULL ARTICLE TEXT:\n${truncated}`);
    }
    return lines.join('\n');
  }).join('\n\n');
}

function parseNotesResponse(text: string): ItemNote[] {
  let cleaned = text.trim();

  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/);
  if (fenceMatch) cleaned = fenceMatch[1];

  const arrayStart = cleaned.indexOf('[');
  const arrayEnd = cleaned.lastIndexOf(']');
  if (arrayStart !== -1 && arrayEnd !== -1) {
    cleaned = cleaned.slice(arrayStart, arrayEnd + 1);
  }

  try {
    const parsed = JSON.parse(cleaned) as Array<{ itemId?: string; note?: string }>;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is { itemId: string; note: string } =>
        typeof item.itemId === 'string' && typeof item.note === 'string'
      )
      .map(item => ({ itemId: item.itemId, note: item.note }));
  } catch (e) {
    if (e instanceof SyntaxError) {
      return [];
    }
    throw e;
  }
}
