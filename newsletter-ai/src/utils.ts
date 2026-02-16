export function extractMkly(text: string): string {
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/^```(?:mkly)?\s*\n([\s\S]*?)\n```\s*$/);
  if (fenceMatch) cleaned = fenceMatch[1];
  const metaIndex = cleaned.indexOf('--- meta');
  if (metaIndex > 0) cleaned = cleaned.slice(metaIndex);
  return cleaned.trim();
}
