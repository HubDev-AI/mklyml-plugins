import type { MklyDocument, MklyBlock } from '@mklyml/core';

// --- AI Provider ---

export interface AIProviderConfig {
  provider: 'gemini' | 'openai' | 'anthropic';
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateParams {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateResult {
  text: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface AIProvider {
  generate(params: GenerateParams): Promise<GenerateResult>;
}

// --- Content Items ---

export interface ContentItem {
  id: string;
  title: string;
  url?: string;
  description?: string;
  imageUrl?: string;
  source?: string;
  category?: string;
  author?: string;
  publishedAt?: string;
  curatorNote?: string;
  fullText?: string;
}

// --- Tone & Archetype ---

export type NewsletterTone = 'professional' | 'casual' | 'playful' | 'formal' | 'friendly';
export type TemplateArchetype = 'tech' | 'digest' | 'brand' | 'b2b' | 'personal' | 'educational';

// --- Brand Identity ---

export interface TemplateBrandIdentity {
  name?: string;
  tagline?: string;
  voiceDescription?: string;
  logoUrl?: string;
}

// --- Template Preferences ---

export interface TemplatePreferences {
  streamName: string;
  categories: string[];
  archetype?: TemplateArchetype;
  tone?: NewsletterTone;
  brandIdentity?: TemplateBrandIdentity;
  colors?: { primary?: string; accent?: string };
  customContext?: string;
}

// --- Style Context (from style learning system) ---

export interface StyleContext {
  fewShotExamples?: string;
  profileGuidance?: string;
  editPatternGuidance?: string;
  baselineGuidance?: string;
}

// --- Template Generation ---

export interface GenerateTemplateOptions {
  provider: AIProvider;
  preferences: TemplatePreferences;
  styleContext?: StyleContext;
}

export interface GenerateTemplateResult {
  source: string;
  manifest: TemplateManifest;
  retries: number;
}

// --- Content Generation ---

export interface GenerateContentOptions {
  provider?: AIProvider;
  templateSource: string;
  contentItems: ContentItem[];
  title?: string;
  tone?: NewsletterTone;
  brandIdentity?: TemplateBrandIdentity;
  colors?: { primary?: string; accent?: string };
  footerCta?: { url: string; text: string };
  styleContext?: StyleContext;
}

export interface GenerateContentResult {
  source: string;
  retries: number;
}

// --- Notes Generation ---

export interface GenerateNotesOptions {
  provider: AIProvider;
  contentItems: ContentItem[];
  streamName?: string;
  tone?: NewsletterTone;
}

export interface ItemNote {
  itemId: string;
  note: string;
}

export interface GenerateNotesResult {
  notes: ItemNote[];
}

// --- Template Manifest ---

export interface TemplateManifestSection {
  blockType: string;
  label?: string;
  properties: Record<string, string>;
  isContainer: boolean;
  children: TemplateManifestSection[];
}

export interface TemplateManifest {
  title?: string;
  subject?: string;
  kitsUsed: string[];
  styleVariables: Record<string, string>;
  sections: TemplateManifestSection[];
  warnings: string[];
}

// --- HTML Import ---

export interface ImportNewsletterOptions {
  html: string;
  detectOrigin?: boolean;
  preserveStyles?: boolean;
}

export interface ImportNewsletterResult {
  source: string;
  manifest: TemplateManifest;
  origin?: string;
  warnings: string[];
}
