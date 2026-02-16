import {
  importHtml,
  detectOrigin,
  reverseEmail,
  reverseWeb,
  htmlToMkly,
} from '@mklyml/core';
import { NEWSLETTER_KIT } from '@mklyml/kits/newsletter';
import type { ImportNewsletterOptions, ImportNewsletterResult } from './types';
import { extractManifest } from './manifest';

export function importNewsletter(options: ImportNewsletterOptions): ImportNewsletterResult {
  const { html, detectOrigin: shouldDetect = true } = options;
  const warnings: string[] = [];

  const origin = shouldDetect ? detectOrigin(html) : undefined;

  const kits = { newsletter: NEWSLETTER_KIT };
  let mklySource: string;

  try {
    mklySource = importHtml(html, { kits });
  } catch {
    warnings.push('Smart import failed, using generic HTML-to-mkly conversion');
    try {
      if (origin === 'mkly-email') {
        mklySource = reverseEmail(html, { kits });
      } else if (origin === 'mkly-web') {
        mklySource = reverseWeb(html, { kits });
      } else {
        mklySource = htmlToMkly(html, { kits });
      }
    } catch {
      warnings.push('Reverse compilation failed, using basic HTML-to-mkly');
      mklySource = htmlToMkly(html);
    }
  }

  if (!mklySource.includes('--- use: newsletter')) {
    mklySource = ensureNewsletterKit(mklySource);
  }

  mklySource = enhanceWithNewsletterBlocks(mklySource, warnings);

  const manifest = extractManifest(mklySource);

  return {
    source: mklySource,
    manifest,
    origin: origin ?? undefined,
    warnings,
  };
}

function ensureNewsletterKit(source: string): string {
  const metaEnd = source.indexOf('\n--- ', source.indexOf('--- meta'));
  if (metaEnd !== -1) {
    return source.slice(0, metaEnd) + '\n\n--- use: newsletter\n' + source.slice(metaEnd);
  }
  return '--- meta\nversion: 1\n\n--- use: newsletter\n\n' + source;
}

function enhanceWithNewsletterBlocks(source: string, warnings: string[]): string {
  let result = source;

  result = result.replace(
    /^(---\s+heading\n(?:.*\n)*?)(?=\n---\s)/m,
    (match) => {
      const levelMatch = match.match(/level:\s*1/);
      if (levelMatch) {
        warnings.push('Converted top-level heading to newsletter header');
        return match.replace('--- heading', '--- header').replace(/level:\s*\d+\n?/, '');
      }
      return match;
    }
  );

  const lines = result.split('\n');
  const enhanced: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^---\s+section\s+".*(?:sponsor|ad|partner|promoted).*"/i.test(line)) {
      enhanced.push(line.replace(/^---\s+section/, '--- sponsor'));
      warnings.push('Detected sponsored section, converted to sponsor block');
      continue;
    }

    if (/^---\s+section\s+".*(?:subscribe|share|forward|cta).*"/i.test(line)) {
      enhanced.push(line.replace(/^---\s+section/, '--- outro'));
      warnings.push('Detected CTA section, converted to outro block');
      continue;
    }

    enhanced.push(line);
  }

  return enhanced.join('\n');
}
