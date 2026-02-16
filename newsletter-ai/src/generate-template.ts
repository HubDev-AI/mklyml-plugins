import { buildBlockReference, validateMkly } from '@mklyml/core';
import { NEWSLETTER_KIT } from '@mklyml/kits/newsletter';
import type { GenerateTemplateOptions, GenerateTemplateResult } from './types';
import { buildPrompt } from './prompt-builder';
import { extractManifest } from './manifest';
import { generateFallbackTemplate } from './fallback';
import { extractMkly } from './utils';

const MAX_RETRIES = 1;

export async function generateTemplate(
  options: GenerateTemplateOptions,
): Promise<GenerateTemplateResult> {
  const { provider, preferences } = options;
  const { archetype, categories } = preferences;

  const blockRef = buildBlockReference({ kits: [NEWSLETTER_KIT] });

  const system = buildPrompt('system', { blockReference: blockRef });

  const archetypeKey = archetype ? `archetypes_${archetype}` : 'archetypes_digest';
  const archetypeGuidance = buildPrompt(archetypeKey, {});

  const user = buildPrompt('template_generation', {
    streamName: preferences.streamName,
    categories: categories.join(', '),
    customContext: preferences.customContext ?? '',
    archetypeGuidance,
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
      maxTokens: 4096,
    });

    const source = extractMkly(result.text);

    const validation = validateMkly(source, {
      kits: { newsletter: NEWSLETTER_KIT },
    });

    if (validation.valid) {
      return {
        source,
        manifest: extractManifest(source),
        retries,
      };
    }

    retries++;
    lastFeedback = validation.feedback;
  }

  const source = generateFallbackTemplate(preferences);
  return {
    source,
    manifest: extractManifest(source),
    retries,
  };
}

