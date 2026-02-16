import type { CompileContext, CompileResult } from '@mklyml/core';
import { definePlugin, escapeHtml } from '@mklyml/core';
import { v, trackUrl, EMAIL_DEFAULTS } from './utils';
import { cssToInline } from './css-inliner';

// ---------------------------------------------------------------------------
// Link tracking (post-process all <a href="..."> in the HTML)
// ---------------------------------------------------------------------------

function applyLinkTracking(html: string, ctx: CompileContext): string {
  const prefix = ctx.variables.trackingPrefix;
  if (!prefix) return html;

  return html.replace(/<a\s([^>]*?)href="([^"]*)"([^>]*)>/gi, (match, before, url, after) => {
    if (!url) return match;
    const tracked = trackUrl(url, ctx);
    return `<a ${before}href="${tracked}"${after}>`;
  });
}

// ---------------------------------------------------------------------------
// Email document wrapper
// ---------------------------------------------------------------------------

function escapeMetaContent(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function buildMklyMetaTags(meta: Record<string, string>, uses: string[]): string[] {
  const tags: string[] = [];
  for (const kitName of uses) {
    tags.push(`<meta name="mkly:use" content="${escapeMetaContent(kitName)}">`);
  }
  for (const [key, value] of Object.entries(meta)) {
    tags.push(`<meta name="mkly:${escapeMetaContent(key)}" content="${escapeMetaContent(value)}">`);
  }
  return tags;
}

function wrapEmailDocument(
  content: string,
  meta: Record<string, string>,
  ctx: CompileContext,
  maxWidth: number,
  documentStyles: Map<string, string>,
  uses: string[],
): string {
  const title = meta.subject ?? meta.title ?? '';
  const fontBody = documentStyles.get('font-family') ?? v(ctx, 'fontBody', EMAIL_DEFAULTS.fontBody);
  const colorText = documentStyles.get('color') ?? v(ctx, 'colorText', EMAIL_DEFAULTS.colorText);
  const colorBg = documentStyles.get('background-color') ?? documentStyles.get('background') ?? v(ctx, 'colorBg', EMAIL_DEFAULTS.colorBg);
  const mklyMeta = buildMklyMetaTags(meta, uses);
  return [
    '<!DOCTYPE html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1.0">',
    `<title>${escapeHtml(title)}</title>`,
    ...mklyMeta,
    '<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->',
    '</head>',
    `<body style="margin:0;padding:0;font-family:${fontBody};color:${colorText};background:${colorBg};">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${colorBg};">`,
    '<tr><td align="center">',
    `<table role="presentation" width="${maxWidth}" cellpadding="0" cellspacing="0" style="max-width:${maxWidth}px;width:100%;background:${colorBg};">`,
    '<tr><td>',
    content,
    '</td></tr>',
    '</table>',
    '</td></tr>',
    '</table>',
    '</body>',
    '</html>',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Extract metadata from the web HTML output
// ---------------------------------------------------------------------------

function extractMeta(html: string): { meta: Record<string, string>; uses: string[]; maxWidth: number } {
  const meta: Record<string, string> = {};
  const uses: string[] = [];
  let maxWidth = 600;

  // Extract mkly meta tags
  const metaRe = /<meta\s+name="mkly:([^"]*?)"\s+content="([^"]*?)"\s*>/gi;
  let m: RegExpExecArray | null;
  while ((m = metaRe.exec(html)) !== null) {
    const key = m[1];
    const value = m[2].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<');
    if (key === 'use') {
      uses.push(value);
    } else {
      meta[key] = value;
    }
  }

  // Extract max-width from <main> style
  const mainMatch = html.match(/<main[^>]*style="[^"]*max-width:\s*(\d+)px/);
  if (mainMatch) {
    maxWidth = parseInt(mainMatch[1], 10);
  }

  return { meta, uses, maxWidth };
}

// ---------------------------------------------------------------------------
// Plugin export
// ---------------------------------------------------------------------------

export function emailPlugin() {
  return definePlugin({
    name: 'email',

    // No custom renderers — use the same web renderers for visual parity.
    // No wrapOutput — let the web wrapper produce HTML + <style> CSS.

    afterCompile(result: CompileResult, ctx: CompileContext): CompileResult {
      const webHtml = result.html;

      // Extract metadata before CSS inlining strips it
      const { meta, uses, maxWidth } = extractMeta(webHtml);

      // Inline all CSS into style attributes
      const { contentHtml, documentStyles } = cssToInline(webHtml);

      // Apply link tracking
      const tracked = applyLinkTracking(contentHtml, ctx);

      // Wrap in email document structure
      const emailHtml = wrapEmailDocument(tracked, meta, ctx, maxWidth, documentStyles, uses);

      return { ...result, html: emailHtml };
    },
  });
}
