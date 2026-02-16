import { escapeHtml } from '@mklyml/core';

function attr(value: string): string {
  return escapeHtml(value);
}

export interface MetaInput {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  author?: string;
  keywords?: string;
  lang?: string;
  type?: string;
  publishedDate?: string;
  modifiedDate?: string;
  canonical?: string;
  siteName?: string;
  locale?: string;
  twitterHandle?: string;
  defaultImage?: string;
  defaultDescription?: string;
}

export function buildStandardMeta(input: MetaInput): string[] {
  const tags: string[] = [];

  const description = input.description ?? input.defaultDescription;
  if (description) {
    tags.push(`<meta name="description" content="${attr(description)}">`);
  }

  if (input.keywords) {
    tags.push(`<meta name="keywords" content="${attr(input.keywords)}">`);
  }

  if (input.author) {
    tags.push(`<meta name="author" content="${attr(input.author)}">`);
  }

  const canonical = input.canonical ?? input.url;
  if (canonical) {
    tags.push(`<link rel="canonical" href="${attr(canonical)}">`);
  }

  return tags;
}

export function buildOpenGraphMeta(input: MetaInput): string[] {
  const tags: string[] = [];

  const ogType = input.type ?? 'article';
  tags.push(`<meta property="og:type" content="${attr(ogType)}">`);

  if (input.title) {
    tags.push(`<meta property="og:title" content="${attr(input.title)}">`);
  }

  const description = input.description ?? input.defaultDescription;
  if (description) {
    tags.push(`<meta property="og:description" content="${attr(description)}">`);
  }

  const image = input.image ?? input.defaultImage;
  if (image) {
    tags.push(`<meta property="og:image" content="${attr(image)}">`);
  }

  const url = input.canonical ?? input.url;
  if (url) {
    tags.push(`<meta property="og:url" content="${attr(url)}">`);
  }

  if (input.siteName) {
    tags.push(`<meta property="og:site_name" content="${attr(input.siteName)}">`);
  }

  if (input.locale) {
    tags.push(`<meta property="og:locale" content="${attr(input.locale)}">`);
  }

  if (input.publishedDate) {
    tags.push(`<meta property="article:published_time" content="${attr(input.publishedDate)}">`);
  }

  if (input.modifiedDate) {
    tags.push(`<meta property="article:modified_time" content="${attr(input.modifiedDate)}">`);
  }

  if (input.author) {
    tags.push(`<meta property="article:author" content="${attr(input.author)}">`);
  }

  return tags;
}

export function buildTwitterMeta(input: MetaInput): string[] {
  const tags: string[] = [];

  const image = input.image ?? input.defaultImage;
  const card = image ? 'summary_large_image' : 'summary';
  tags.push(`<meta name="twitter:card" content="${card}">`);

  if (input.title) {
    tags.push(`<meta name="twitter:title" content="${attr(input.title)}">`);
  }

  const description = input.description ?? input.defaultDescription;
  if (description) {
    tags.push(`<meta name="twitter:description" content="${attr(description)}">`);
  }

  if (image) {
    tags.push(`<meta name="twitter:image" content="${attr(image)}">`);
  }

  if (input.twitterHandle) {
    tags.push(`<meta name="twitter:site" content="${attr(input.twitterHandle)}">`);
  }

  return tags;
}
