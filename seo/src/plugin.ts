import type { CompileContext } from '@mklyml/core';
import { definePlugin, escapeHtml } from '@mklyml/core';
import { buildStandardMeta, buildOpenGraphMeta, buildTwitterMeta } from './meta';
import { buildJsonLd } from './json-ld';
import type { JsonLdType } from './json-ld';

export interface SeoPluginOptions {
  siteName?: string;
  siteUrl?: string;
  defaultImage?: string;
  defaultDescription?: string;
  twitterHandle?: string;
  locale?: string;
  jsonLd?: boolean;
  jsonLdType?: JsonLdType;
  customJsonLd?: Record<string, unknown>;
  extraMeta?: string[];
}

function wrapSeoOutput(
  options: SeoPluginOptions,
  content: string,
  meta: Record<string, string>,
  _ctx: CompileContext,
  maxWidth: number,
): string {
  const title = meta.title;
  const lang = meta.lang ?? 'en';
  const fullTitle = title && options.siteName
    ? `${title} — ${options.siteName}`
    : title ?? options.siteName ?? '';

  const metaInput = {
    title: meta.title,
    description: meta.description,
    image: meta.image,
    url: meta.canonical ?? options.siteUrl,
    author: meta.author,
    keywords: meta.keywords,
    lang: meta.lang,
    type: meta.type,
    publishedDate: meta.publishedDate,
    modifiedDate: meta.modifiedDate,
    canonical: meta.canonical,
    siteName: options.siteName,
    locale: options.locale,
    twitterHandle: options.twitterHandle,
    defaultImage: options.defaultImage,
    defaultDescription: options.defaultDescription,
  };

  const standardMeta = buildStandardMeta(metaInput);
  const ogMeta = buildOpenGraphMeta(metaInput);
  const twitterMeta = buildTwitterMeta(metaInput);
  const extraMeta = options.extraMeta ?? [];

  const jsonLdScript = options.jsonLd !== false
    ? buildJsonLd({
        type: options.jsonLdType ?? 'Article',
        title: meta.title,
        description: meta.description,
        image: meta.image ?? options.defaultImage,
        url: meta.canonical ?? options.siteUrl,
        author: meta.author,
        publishedDate: meta.publishedDate,
        modifiedDate: meta.modifiedDate,
        siteName: options.siteName,
        custom: options.customJsonLd,
      })
    : '';

  return [
    '<!DOCTYPE html>',
    `<html lang="${escapeHtml(lang)}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1.0">',
    `<title>${escapeHtml(fullTitle)}</title>`,
    ...standardMeta,
    '',
    '<!-- Open Graph -->',
    ...ogMeta,
    '',
    '<!-- Twitter Card -->',
    ...twitterMeta,
    ...extraMeta,
    '</head>',
    '<body>',
    `<main class="mkly-document" style="max-width:${maxWidth}px;margin:0 auto;">`,
    content,
    '</main>',
    jsonLdScript,
    '</body>',
    '</html>',
  ].filter(Boolean).join('\n');
}

export function seoPlugin(options: SeoPluginOptions = {}) {
  return definePlugin({
    name: 'seo',
    wrapOutput: (content, meta, ctx, maxWidth) =>
      wrapSeoOutput(options, content, meta, ctx, maxWidth),
  });
}
