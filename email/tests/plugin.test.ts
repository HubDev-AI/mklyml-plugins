import { describe, test, expect } from 'bun:test';
import { parse, compile, createRegistry, CORE_KIT } from '@mklyml/core';
import { NEWSLETTER_KIT } from '@mklyml/kits/newsletter';
import { emailPlugin, trackUrl, EMAIL_DEFAULTS } from '../src/index';
import { cssToInline, extractStyleContent, unwrapLayers, parseRules, collectCustomProperties, resolveVarReferences, inlineStyles } from '../src/css-inliner';
import type { CompileContext } from '@mklyml/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ctx(variables: Record<string, string> = {}): CompileContext {
  return { variables, errors: [], extraStyles: new Set() };
}

function compileEmail(source: string, variables: Record<string, string> = {}): string {
  const fullSource = `--- use: core\n--- use: newsletter\n\n--- meta\nversion: 1\n\n${source}`;
  const doc = parse(fullSource);
  const registry = createRegistry();
  return compile(doc, registry, {
    plugins: [emailPlugin()],
    variables,
    kits: { core: CORE_KIT, newsletter: NEWSLETTER_KIT },
  }).html;
}

function compileWeb(source: string, variables: Record<string, string> = {}): string {
  const fullSource = `--- use: core\n--- use: newsletter\n\n--- meta\nversion: 1\n\n${source}`;
  const doc = parse(fullSource);
  const registry = createRegistry();
  return compile(doc, registry, {
    variables,
    kits: { core: CORE_KIT, newsletter: NEWSLETTER_KIT },
  }).html;
}

// ---------------------------------------------------------------------------
// CSS Inliner unit tests
// ---------------------------------------------------------------------------

describe('CSS inliner: extractStyleContent', () => {
  test('extracts style tag content', () => {
    const { css, htmlWithoutStyle } = extractStyleContent('<style>body{color:red}</style><div>hello</div>');
    expect(css).toContain('body{color:red}');
    expect(htmlWithoutStyle).not.toContain('<style>');
    expect(htmlWithoutStyle).toContain('<div>hello</div>');
  });

  test('handles multiple style tags', () => {
    const { css } = extractStyleContent('<style>a{}</style><style>b{}</style>');
    expect(css).toContain('a{}');
    expect(css).toContain('b{}');
  });
});

describe('CSS inliner: unwrapLayers', () => {
  test('removes @layer declaration', () => {
    const result = unwrapLayers('@layer kit, theme, preset, user;\n.foo { color: red; }');
    expect(result).not.toContain('@layer');
    expect(result).toContain('.foo { color: red; }');
  });

  test('unwraps @layer blocks', () => {
    const result = unwrapLayers('@layer kit {\n.foo { color: red; }\n}');
    expect(result).toContain('.foo { color: red; }');
    expect(result).not.toContain('@layer');
  });

  test('removes @keyframes', () => {
    const result = unwrapLayers('@keyframes fade {\nfrom{opacity:0}\nto{opacity:1}\n}\n.foo{color:red}');
    expect(result).not.toContain('@keyframes');
    expect(result).toContain('.foo{color:red}');
  });
});

describe('CSS inliner: parseRules', () => {
  test('parses simple rules', () => {
    const rules = parseRules('.foo { color: red; font-size: 16px; }');
    expect(rules).toHaveLength(1);
    expect(rules[0].selector).toBe('.foo');
    expect(rules[0].declarations.get('color')).toBe('red');
    expect(rules[0].declarations.get('font-size')).toBe('16px');
  });

  test('handles comma-separated selectors', () => {
    const rules = parseRules('.foo, .bar { color: blue; }');
    expect(rules).toHaveLength(2);
    expect(rules[0].selector).toBe('.foo');
    expect(rules[1].selector).toBe('.bar');
  });
});

describe('CSS inliner: variable resolution', () => {
  test('collects custom properties from :root', () => {
    const rules = parseRules(':root { --color: red; --size: 16px; }');
    const vars = collectCustomProperties(rules);
    expect(vars.get('--color')).toBe('red');
    expect(vars.get('--size')).toBe('16px');
  });

  test('collects from .mkly-document', () => {
    const rules = parseRules('.mkly-document { --mkly-accent: #e2725b; }');
    const vars = collectCustomProperties(rules);
    expect(vars.get('--mkly-accent')).toBe('#e2725b');
  });

  test('resolves var() references', () => {
    const vars = new Map([['--color', 'red']]);
    expect(resolveVarReferences('var(--color)', vars)).toBe('red');
  });

  test('uses fallback when var not found', () => {
    const vars = new Map<string, string>();
    expect(resolveVarReferences('var(--missing, blue)', vars)).toBe('blue');
  });

  test('resolves nested var()', () => {
    const vars = new Map([['--a', 'var(--b)'], ['--b', 'green']]);
    expect(resolveVarReferences('var(--a)', vars)).toBe('green');
  });
});

describe('CSS inliner: inlineStyles', () => {
  test('inlines styles by class match', () => {
    const html = '<div class="foo">hello</div>';
    const rules = parseRules('.foo { color: red; font-size: 16px; }');
    const result = inlineStyles(html, rules);
    expect(result).toContain('style="color:red;font-size:16px"');
    expect(result).not.toContain('class="foo"');
  });

  test('merges with existing inline style', () => {
    const html = '<div class="foo" style="margin:0;">hello</div>';
    const rules = parseRules('.foo { color: red; }');
    const result = inlineStyles(html, rules);
    expect(result).toContain('color:red');
    expect(result).toContain('margin:0');
  });

  test('existing inline style overrides CSS rule', () => {
    const html = '<div class="foo" style="color:blue;">hello</div>';
    const rules = parseRules('.foo { color: red; }');
    const result = inlineStyles(html, rules);
    expect(result).toContain('color:blue');
    expect(result).not.toContain('color:red');
  });

  test('skips pseudo-selectors', () => {
    const html = '<div class="foo">hello</div>';
    const rules = parseRules('.foo { color: red; } .foo:hover { color: blue; }');
    const result = inlineStyles(html, rules);
    expect(result).toContain('color:red');
    expect(result).not.toContain('color:blue');
  });

  test('handles descendant selectors', () => {
    const html = '<div class="parent"><span class="child">text</span></div>';
    const rules = parseRules('.parent .child { color: green; }');
    const result = inlineStyles(html, rules);
    expect(result).toContain('style="color:green"');
  });
});

// ---------------------------------------------------------------------------
// Full pipeline: cssToInline
// ---------------------------------------------------------------------------

describe('cssToInline full pipeline', () => {
  test('inlines layered CSS with variable resolution', () => {
    const webHtml = [
      '<style>',
      '@layer kit, theme, preset, user;',
      '@layer kit { .mkly-core-heading { font-weight: bold; } }',
      '@layer theme { .mkly-document { --mkly-accent: #e2725b; } }',
      '@layer user { .mkly-core-heading { color: var(--mkly-accent); } }',
      '</style>',
      '<main class="mkly-document" style="max-width:600px;margin:0 auto;">',
      '<h2 class="mkly-core-heading mkly-core-heading--2">Title</h2>',
      '</main>',
    ].join('\n');

    const { contentHtml } = cssToInline(webHtml);
    expect(contentHtml).toContain('font-weight:bold');
    expect(contentHtml).toContain('color:#e2725b');
    expect(contentHtml).not.toContain('class="mkly-core-heading');
    expect(contentHtml).not.toContain('var(--mkly');
  });
});

// ---------------------------------------------------------------------------
// Email plugin via compile()
// ---------------------------------------------------------------------------

describe('email plugin produces inline-styled email document', () => {
  test('produces full HTML document', () => {
    const html = compileEmail(`--- core/text\nHello world`);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<table');
    expect(html).toContain('role="presentation"');
    expect(html).toContain('<!--[if mso]>');
  });

  test('no CSS class attributes remain', () => {
    const html = compileEmail(`--- core/heading\nlevel: 2\nMy Title`);
    expect(html).not.toContain('class="mkly-');
  });

  test('no style tags remain', () => {
    const html = compileEmail(`--- core/text\nHello`);
    expect(html).not.toContain('<style>');
    expect(html).not.toContain('</style>');
  });

  test('no script tags remain', () => {
    const html = compileEmail(`--- core/text\nHello`);
    expect(html).not.toContain('<script');
  });

  test('has inline styles on elements', () => {
    const html = compileEmail(`--- core/text\nHello world`);
    // The text block should have inline styles from the kit CSS
    expect(html).toContain('style="');
  });

  test('heading block has inline styles', () => {
    const html = compileEmail(`--- core/heading\nlevel: 1\nBig Title`);
    expect(html).toContain('<h1');
    expect(html).toContain('style="');
    expect(html).toContain('Big Title');
  });

  test('image block has inline styles', () => {
    const html = compileEmail(`--- core/image\nsrc: https://img.test/a.png\nalt: pic`);
    expect(html).toContain('<img');
    expect(html).toContain('https://img.test/a.png');
    expect(html).toContain('style="');
  });

  test('button block produces link', () => {
    const html = compileEmail(`--- core/button\nurl: https://example.com\nlabel: Click Me`);
    expect(html).toContain('Click Me');
    expect(html).toContain('https://example.com');
    expect(html).toContain('style="');
  });

  test('code block has inline styles', () => {
    const html = compileEmail(`--- core/code\nlang: ts\nconst x = 1;`);
    expect(html).toContain('const x = 1;');
    expect(html).toContain('style="');
  });

  test('quote block has inline styles', () => {
    const html = compileEmail(`--- core/quote\nauthor: Tester\nSome quote`);
    expect(html).toContain('Some quote');
    expect(html).toContain('Tester');
    expect(html).toContain('style="');
  });

  test('card block has inline styles', () => {
    const html = compileEmail(`--- core/card\nlink: https://example.com\nCard text`);
    expect(html).toContain('Card text');
    expect(html).toContain('style="');
  });

  test('divider block renders', () => {
    const html = compileEmail(`--- core/divider`);
    expect(html).toContain('<hr');
  });

  test('spacer block renders', () => {
    const html = compileEmail(`--- core/spacer\nheight: 20`);
    expect(html).toContain('style="');
  });

  test('list block has inline styles', () => {
    const html = compileEmail(`--- core/list\n- item one\n- item two`);
    expect(html).toContain('style="');
  });

  test('section block renders with children', () => {
    const html = compileEmail(`--- core/section\ntitle: My Section\n--- core/text\nInner content\n--- /core/section`);
    expect(html).toContain('My Section');
    expect(html).toContain('Inner content');
  });

  test('hero block renders', () => {
    const html = compileEmail(`--- core/hero\nimage: https://img.test/hero.png\nHero text`);
    expect(html).toContain('https://img.test/hero.png');
    expect(html).toContain('Hero text');
  });

  test('header block renders', () => {
    const html = compileEmail(`--- core/header\ntitle: My Newsletter`);
    expect(html).toContain('My Newsletter');
  });

  test('footer block renders', () => {
    const html = compileEmail(`--- core/footer\nCopyright 2026`);
    expect(html).toContain('Copyright 2026');
  });

  test('cta block renders', () => {
    const html = compileEmail(`--- core/cta\nurl: https://example.com\nbuttonText: Go\nAct now`);
    expect(html).toContain('Go');
    expect(html).toContain('Act now');
  });

  test('newsletter intro block renders', () => {
    const html = compileEmail(`--- newsletter/intro\nWelcome`);
    expect(html).toContain('Welcome');
  });

  test('newsletter featured block renders', () => {
    const html = compileEmail(`--- newsletter/featured\nsource: TechCrunch\nlink: https://tc.com\nGreat article`);
    expect(html).toContain('TechCrunch');
    expect(html).toContain('Great article');
  });

  test('newsletter category block renders', () => {
    const html = compileEmail(`--- newsletter/category\ntitle: Tech\n--- newsletter/item\nItem text\n--- /newsletter/category`);
    expect(html).toContain('Tech');
    expect(html).toContain('Item text');
  });
});

// ---------------------------------------------------------------------------
// Web mode unchanged (core blocks without plugin = CSS classes)
// ---------------------------------------------------------------------------

describe('web mode produces CSS classes (no email plugin)', () => {
  test('text block', () => {
    const html = compileWeb(`--- core/text\nHello world`);
    expect(html).toContain('class="mkly-core-text"');
  });

  test('heading block', () => {
    const html = compileWeb(`--- core/heading\nlevel: 3\nTitle`);
    expect(html).toContain('mkly-core-heading');
  });
});

// ---------------------------------------------------------------------------
// Email variables and themes affect output
// ---------------------------------------------------------------------------

describe('email variables affect inline output', () => {
  test('theme variables flow into email inline styles', () => {
    const source = [
      '--- use: core',
      '--- use: newsletter',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- style',
      'accent: #ff6600',
      '',
      '--- style',
      'core/heading',
      '  color: $accent',
      '',
      '--- core/heading',
      'level: 2',
      'My Title',
    ].join('\n');
    const doc = parse(source);
    const registry = createRegistry();
    const result = compile(doc, registry, {
      plugins: [emailPlugin()],
      kits: { core: CORE_KIT, newsletter: NEWSLETTER_KIT },
    });
    // The accent color should be inlined after var() resolution
    expect(result.html).toContain('#ff6600');
  });

  test('custom variables override defaults in wrapper', () => {
    const html = compileEmail(`--- core/text\nContent`, {
      fontBody: 'Verdana, sans-serif',
      text: '#000000',
      background: '#fafafa',
    });
    expect(html).toContain('Verdana');
  });

  test('uses fallback values when no variables', () => {
    const html = compileEmail(`--- core/text\nContent`);
    // Default font should appear in the body wrapper
    expect(html).toContain('Helvetica');
  });
});

// ---------------------------------------------------------------------------
// Email document wrapper
// ---------------------------------------------------------------------------

describe('email document wrapper', () => {
  test('uses meta.title in title tag', () => {
    const html = compileEmail(`--- meta\ntitle: Test Email\n\n--- core/text\nContent`);
    expect(html).toContain('<title>Test Email</title>');
  });

  test('uses meta.subject over meta.title', () => {
    const html = compileEmail(`--- meta\ntitle: Test\nsubject: Email Subject\n\n--- core/text\nContent`);
    expect(html).toContain('<title>Email Subject</title>');
  });

  test('includes MSO conditional comment', () => {
    const html = compileEmail(`--- core/text\nContent`);
    expect(html).toContain('<!--[if mso]>');
    expect(html).toContain('PixelsPerInch');
  });

  test('body has inline font and color', () => {
    const html = compileEmail(`--- core/text\nContent`);
    expect(html).toMatch(/<body\s+style="[^"]*font-family:/);
    expect(html).toMatch(/<body\s+style="[^"]*color:/);
  });
});

// ---------------------------------------------------------------------------
// Link tracking
// ---------------------------------------------------------------------------

describe('link tracking', () => {
  test('trackUrl returns original when no prefix', () => {
    expect(trackUrl('https://example.com', ctx())).toBe('https://example.com');
  });

  test('trackUrl prepends prefix with encoded url', () => {
    const result = trackUrl('https://example.com', ctx({ trackingPrefix: 'https://track.milkly.app/click?url=' }));
    expect(result).toBe('https://track.milkly.app/click?url=https%3A%2F%2Fexample.com');
  });

  test('trackUrl returns empty for empty url', () => {
    expect(trackUrl('', ctx({ trackingPrefix: 'https://track.milkly.app/click?url=' }))).toBe('');
  });

  test('links are tracked in email output', () => {
    const source = [
      '--- use: core',
      '--- use: newsletter',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- core/button',
      'url: https://example.com',
      'label: Click',
    ].join('\n');
    const doc = parse(source);
    const registry = createRegistry();
    const result = compile(doc, registry, {
      plugins: [emailPlugin()],
      variables: { trackingPrefix: 'https://t.co/?u=' },
      kits: { core: CORE_KIT, newsletter: NEWSLETTER_KIT },
    });
    expect(result.html).toContain('https://t.co/?u=https%3A%2F%2Fexample.com');
  });

  test('web mode button does NOT use tracking (no plugin)', () => {
    const html = compileWeb(`--- core/button\nurl: https://example.com\nlabel: Click`);
    expect(html).not.toContain('t.co');
    expect(html).toContain('href="https://example.com"');
  });
});

// ---------------------------------------------------------------------------
// Visual parity: email should contain same text/structure as web
// ---------------------------------------------------------------------------

describe('email has visual parity with web', () => {
  test('same text content appears in both modes', () => {
    const source = `--- core/heading\nlevel: 2\nMy Title\n\n--- core/text\nSome paragraph text`;
    const webHtml = compileWeb(source);
    const emailHtml = compileEmail(source);
    expect(webHtml).toContain('My Title');
    expect(emailHtml).toContain('My Title');
    expect(webHtml).toContain('Some paragraph text');
    expect(emailHtml).toContain('Some paragraph text');
  });

  test('email has no CSS classes, web has CSS classes', () => {
    const source = `--- core/text\nHello`;
    const webHtml = compileWeb(source);
    const emailHtml = compileEmail(source);
    expect(webHtml).toContain('class="mkly-core-text"');
    expect(emailHtml).not.toContain('class="mkly-');
  });

  test('email has inline styles, web has style tag', () => {
    const source = `--- core/text\nHello`;
    const webHtml = compileWeb(source);
    const emailHtml = compileEmail(source);
    expect(webHtml).toContain('<style>');
    expect(emailHtml).not.toContain('<style>');
  });
});

// ---------------------------------------------------------------------------
// EMAIL_DEFAULTS are correct
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Raw CSS & pseudo selectors in email pipeline
// ---------------------------------------------------------------------------

describe('email handles raw CSS and pseudo selectors', () => {
  test('raw CSS class selectors are inlined on matching elements', () => {
    const source = [
      '--- style',
      'core/heading',
      '  color: #333',
      '',
      '--- core/heading',
      'level: 2',
      'Title',
    ].join('\n');
    const html = compileEmail(source);
    // The heading color from style block should be inlined
    expect(html).toContain('#333');
  });

  test('pseudo-selectors like :hover are skipped in email output', () => {
    const source = [
      '--- style',
      'core/heading',
      '  color: blue',
      '  :hover',
      '    color: red',
      '',
      '--- core/heading',
      'level: 2',
      'Title',
    ].join('\n');
    const html = compileEmail(source);
    // Should have the base color inlined but NOT the hover color
    expect(html).toContain('color:blue');
    // Hover styles should not appear inline
    expect(html).not.toMatch(/color:red/);
  });

  test('combined sub+pseudo (.img:hover) is skipped in email', () => {
    const source = [
      '--- style',
      'core/card',
      '  border-radius: 8px',
      '  .img:hover',
      '    opacity: 0.5',
      '',
      '--- core/card',
      'link: https://example.com',
      'Card text',
    ].join('\n');
    const html = compileEmail(source);
    // Base border-radius should be inlined
    expect(html).toContain('border-radius:8px');
    // Hover opacity should NOT be inlined
    expect(html).not.toContain('opacity:0.5');
  });
});

describe('EMAIL_DEFAULTS constants', () => {
  test('has correct default values', () => {
    expect(EMAIL_DEFAULTS.fontHeading).toBe('Georgia, serif');
    expect(EMAIL_DEFAULTS.fontBody).toBe('Helvetica, Arial, sans-serif');
    expect(EMAIL_DEFAULTS.colorPrimary).toBe('#333333');
    expect(EMAIL_DEFAULTS.colorAccent).toBe('#666666');
    expect(EMAIL_DEFAULTS.colorBg).toBe('#ffffff');
    expect(EMAIL_DEFAULTS.colorText).toBe('#333333');
    expect(EMAIL_DEFAULTS.radius).toBe('4px');
  });
});
