export { createProvider } from './provider';
export { generateTemplate } from './generate-template';
export { generateContent } from './generate-content';
export { generateNotes } from './generate-notes';
export { extractManifest } from './manifest';
export { generateFallbackTemplate, generateFallbackContent } from './fallback';
export { importNewsletter } from './import';
export { buildPrompt, replaceVariables } from './prompt-builder';

export type {
  AIProvider,
  AIProviderConfig,
  GenerateParams,
  GenerateResult,
  ContentItem,
  NewsletterTone,
  TemplateArchetype,
  TemplateBrandIdentity,
  TemplatePreferences,
  StyleContext,
  GenerateTemplateOptions,
  GenerateTemplateResult,
  GenerateContentOptions,
  GenerateContentResult,
  GenerateNotesOptions,
  GenerateNotesResult,
  ItemNote,
  TemplateManifest,
  TemplateManifestSection,
  ImportNewsletterOptions,
  ImportNewsletterResult,
} from './types';
