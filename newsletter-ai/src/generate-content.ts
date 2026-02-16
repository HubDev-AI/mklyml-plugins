import { buildBlockReference, validateMkly } from '@mklyml/core';
import { NEWSLETTER_KIT } from '@mklyml/kits/newsletter';
import type { GenerateContentOptions, GenerateContentResult, ContentItem, StyleContext } from './types';
import { buildPrompt } from './prompt-builder';
import { generateFallbackContent } from './fallback';
import { extractMkly } from './utils';

const MAX_RETRIES = 1;

export async function generateContent(
  options: GenerateContentOptions,
): Promise<GenerateContentResult> {
  const { provider, templateSource, contentItems, title, tone, brandIdentity, colors, footerCta, styleContext } = options;

  if (!provider) {
    return {
      source: generateFallbackContent(options),
      retries: 0,
    };
  }

  const blockRef = buildBlockReference({ kits: [NEWSLETTER_KIT] });
  const system = buildPrompt('system', { blockReference: blockRef });

  const toneKey = `tone_${tone ?? 'professional'}`;
  let toneGuidance = '';
  try {
    toneGuidance = buildPrompt(toneKey, {});
  } catch {
    toneGuidance = buildPrompt('tone_professional', {});
  }

  const writingRules = buildPrompt('writing_rules', {});

  const contentContext = formatContentItems(contentItems);

  const brandLines: string[] = [];
  if (brandIdentity?.tagline) brandLines.push(`- Tagline: "${brandIdentity.tagline}"`);
  if (brandIdentity?.voiceDescription) brandLines.push(`- Voice: ${brandIdentity.voiceDescription}`);
  const brandSection = brandLines.length > 0 ? brandLines.join('\n') : '';

  const logoInstruction = brandIdentity?.logoUrl
    ? `Include the logo in the header block: logo: ${brandIdentity.logoUrl}`
    : '';

  const footerCTA = footerCta
    ? `The outro section should have: ctaUrl: ${footerCta.url} and ctaText: ${footerCta.text}`
    : '';

  const itemLimits = `You have ${contentItems.length} content items. Use each exactly once.`;

  const styleCtx = buildStyleContext(styleContext);

  const user = buildPrompt('content_generation', {
    streamName: title ?? 'Newsletter',
    title: title ?? 'Newsletter',
    tone: tone ?? 'professional',
    primaryColor: colors?.primary ?? '#1a1a1a',
    accentColor: colors?.accent ?? '#e2725b',
    brandSection,
    logoInstruction,
    footerCTA,
    itemLimits,
    templateSource,
    contentContext,
    toneGuidance,
    writingRules,
    styleContext: styleCtx,
    itemCount: String(contentItems.length),
  });

  let retries = 0;
  let lastFeedback = '';

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const prompt = attempt === 0
      ? user
      : `${user}\n\nPREVIOUS ATTEMPT HAD ERRORS:\n${lastFeedback}\n\nFix these errors and try again.`;

    const result = await provider.generate({
      system,
      user: prompt,
      temperature: 0.8,
      maxTokens: 8192,
    });

    const source = extractMkly(result.text);

    const validation = validateMkly(source, {
      kits: { newsletter: NEWSLETTER_KIT },
    });

    if (validation.valid) {
      return { source, retries };
    }

    retries++;
    lastFeedback = validation.feedback;
  }

  return {
    source: generateFallbackContent(options),
    retries,
  };
}

function formatContentItems(items: ContentItem[]): string {
  return items.map((item, i) => {
    const lines: string[] = [];
    lines.push(`${i + 1}. [${item.category ?? 'uncategorized'}] "${item.title}"`);
    if (item.url) lines.push(`   URL: ${item.url}`);
    if (item.source) lines.push(`   Source: ${item.source}`);
    if (item.author) lines.push(`   Author: ${item.author}`);
    if (item.publishedAt) lines.push(`   Published: ${item.publishedAt}`);
    if (item.imageUrl) lines.push(`   Image: ${item.imageUrl}`);
    if (item.description) lines.push(`   Description: ${item.description}`);
    if (item.curatorNote) lines.push(`   CURATOR NOTE: ${item.curatorNote}`);
    if (item.fullText) {
      const truncated = item.fullText.slice(0, 5000);
      lines.push(`   FULL ARTICLE TEXT:\n   ${truncated}`);
    }
    return lines.join('\n');
  }).join('\n\n');
}

function buildStyleContext(ctx?: StyleContext): string {
  if (!ctx) return '';
  const parts: string[] = [];
  if (ctx.fewShotExamples) parts.push(`STYLE EXAMPLES:\n${ctx.fewShotExamples}`);
  if (ctx.profileGuidance) parts.push(`STYLE PROFILE:\n${ctx.profileGuidance}`);
  if (ctx.editPatternGuidance) parts.push(`EDIT PATTERNS:\n${ctx.editPatternGuidance}`);
  if (ctx.baselineGuidance) parts.push(`WRITING BASELINE:\n${ctx.baselineGuidance}`);
  return parts.join('\n\n');
}

