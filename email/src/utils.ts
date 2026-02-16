import type { CompileContext, MklyDocument, MklyBlock } from '@mklyml/core';
import { escapeHtml, isSafeUrl } from '@mklyml/core';

/**
 * Email variable key → theme variable aliases.
 * Email renderers use keys like `colorAccent`, but themes define `accent`.
 */
const EMAIL_ALIASES: Record<string, string[]> = {
  colorPrimary: ['accent', 'primary'],
  colorAccent: ['accent'],
  colorText: ['text'],
  colorBg: ['bg', 'background'],
};

export function v(ctx: CompileContext, key: string, fallback: string): string {
  if (ctx.variables[key] !== undefined) return ctx.variables[key];
  const aliases = EMAIL_ALIASES[key];
  if (aliases) {
    for (const alias of aliases) {
      if (ctx.variables[alias] !== undefined) return ctx.variables[alias];
    }
  }
  return fallback;
}

export function emailWrap(content: string, padding = '0 32px 16px'): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:${padding};">${content}</td></tr></table>`;
}

export function emailColumns(
  left: string,
  right: string,
  leftWidth = '60%',
  rightWidth = '40%',
  gap = '16px',
): string {
  return [
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>',
    `<td style="width:${leftWidth};vertical-align:top;">${left}</td>`,
    `<td style="width:${gap};"></td>`,
    `<td style="width:${rightWidth};vertical-align:top;">${right}</td>`,
    '</tr></table>',
  ].join('');
}

export function emailButton(
  url: string,
  label: string,
  ctx: CompileContext,
): string {
  const accent = v(ctx, 'colorAccent', '#666666');
  const radius = v(ctx, 'radius', '4px');
  const fontBody = v(ctx, 'fontBody', 'Helvetica, Arial, sans-serif');
  const safeHref = isSafeUrl(url) ? escapeHtml(url) : '';

  return [
    '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px auto;">',
    '<tr><td style="border-radius:',
    radius,
    ';background:',
    accent,
    ';">',
    '<a href="',
    trackUrl(safeHref, ctx),
    '" style="display:inline-block;padding:12px 24px;font-family:',
    fontBody,
    ';font-size:16px;color:#ffffff;text-decoration:none;">',
    escapeHtml(label),
    '</a></td></tr></table>',
  ].join('');
}

export function trackUrl(url: string, ctx: CompileContext): string {
  const prefix = ctx.variables.trackingPrefix;
  if (!prefix || !url) return url;
  return `${prefix}${encodeURIComponent(url)}`;
}

export const EMAIL_DEFAULTS = {
  fontHeading: 'Georgia, serif',
  fontBody: 'Helvetica, Arial, sans-serif',
  colorPrimary: '#333333',
  colorAccent: '#666666',
  colorBg: '#ffffff',
  colorText: '#333333',
  radius: '4px',
} as const;

const URL_PROPERTIES = new Set([
  'src', 'url', 'href', 'image', 'link', 'logo', 'icon',
]);

function replaceInString(text: string, urlMap: Record<string, string>): string {
  let result = text;
  for (const [from, to] of Object.entries(urlMap)) {
    if (result.includes(from)) {
      result = result.split(from).join(to);
    }
  }
  return result;
}

function replaceBlockUrls(block: MklyBlock, urlMap: Record<string, string>): MklyBlock {
  const properties = { ...block.properties };
  for (const key of Object.keys(properties)) {
    if (URL_PROPERTIES.has(key)) {
      const mapped = urlMap[properties[key]];
      if (mapped !== undefined) {
        properties[key] = mapped;
      }
    }
  }

  const content = replaceInString(block.content, urlMap);

  const children = block.children.map(child => replaceBlockUrls(child, urlMap));

  return { ...block, properties, content, children };
}

export function replaceUrls(
  doc: MklyDocument,
  urlMap: Record<string, string>,
): MklyDocument {
  if (Object.keys(urlMap).length === 0) return doc;
  return {
    ...doc,
    blocks: doc.blocks.map(block => replaceBlockUrls(block, urlMap)),
  };
}
