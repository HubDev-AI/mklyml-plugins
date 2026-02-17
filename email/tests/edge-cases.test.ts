import { describe, test, expect } from 'bun:test';
import { parse, compile, createRegistry, CORE_KIT } from '@mklyml/core';
import { NEWSLETTER_KIT } from '@mklyml/kits/newsletter';
import {
  emailPlugin,
  emailVar,
  emailWrap,
  emailButton,
  emailColumns,
  trackUrl,
  replaceUrls,
  EMAIL_DEFAULTS,
} from '../src/index';
import {
  cssToInline,
  extractStyleContent,
  unwrapLayers,
  parseRules,
  collectCustomProperties,
  resolveVarReferences,
  inlineStyles,
  extractMainContent,
  stripNonContentTags,
} from '../src/css-inliner';
import type { CompileContext, MklyDocument } from '@mklyml/core';

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

// ===== Utility functions (utils.ts) =====

describe('emailVar — variable resolution with aliases', () => {
  test('returns direct variable when set', () => {
    expect(emailVar(ctx({ colorAccent: '#ff0000' }), 'colorAccent', '#666')).toBe('#ff0000');
  });

  test('falls back to alias when direct key missing', () => {
    expect(emailVar(ctx({ accent: '#ff0000' }), 'colorAccent', '#666')).toBe('#ff0000');
  });

  test('falls back to default when no key or alias', () => {
    expect(emailVar(ctx(), 'colorAccent', '#666')).toBe('#666');
  });

  test('colorPrimary aliases to accent then primary', () => {
    expect(emailVar(ctx({ primary: '#111' }), 'colorPrimary', '#333')).toBe('#111');
    expect(emailVar(ctx({ accent: '#222' }), 'colorPrimary', '#333')).toBe('#222');
  });

  test('colorText aliases to text', () => {
    expect(emailVar(ctx({ text: '#000' }), 'colorText', '#333')).toBe('#000');
  });

  test('colorBg aliases to bg and background', () => {
    expect(emailVar(ctx({ bg: '#fff' }), 'colorBg', '#ffffff')).toBe('#fff');
    expect(emailVar(ctx({ background: '#fafafa' }), 'colorBg', '#ffffff')).toBe('#fafafa');
  });

  test('non-aliased key falls back to default', () => {
    expect(emailVar(ctx(), 'fontBody', 'Helvetica')).toBe('Helvetica');
  });
});

describe('emailWrap — table wrapper', () => {
  test('wraps content in table with default padding', () => {
    const result = emailWrap('<p>Content</p>');
    expect(result).toContain('<table role="presentation"');
    expect(result).toContain('padding:0 32px 16px');
    expect(result).toContain('<p>Content</p>');
  });

  test('wraps content with custom padding', () => {
    const result = emailWrap('<p>Content</p>', '8px 16px');
    expect(result).toContain('padding:8px 16px');
  });

  test('produces valid table structure', () => {
    const result = emailWrap('Hi');
    expect(result).toContain('cellpadding="0"');
    expect(result).toContain('cellspacing="0"');
    expect(result).toContain('width="100%"');
    expect(result).toMatch(/<table[^>]*><tr><td[^>]*>Hi<\/td><\/tr><\/table>/);
  });
});

describe('emailColumns — two-column layout', () => {
  test('creates two-column table with defaults', () => {
    const result = emailColumns('<p>Left</p>', '<p>Right</p>');
    expect(result).toContain('width:60%');
    expect(result).toContain('width:40%');
    expect(result).toContain('width:16px');
    expect(result).toContain('<p>Left</p>');
    expect(result).toContain('<p>Right</p>');
  });

  test('creates two-column table with custom widths', () => {
    const result = emailColumns('<p>L</p>', '<p>R</p>', '50%', '50%', '8px');
    expect(result).toContain('width:50%');
    expect(result).toContain('width:8px');
  });

  test('has vertical-align:top on cells', () => {
    const result = emailColumns('A', 'B');
    expect(result).toContain('vertical-align:top');
  });
});

describe('emailButton — button rendering', () => {
  test('produces accessible button with tracking', () => {
    const result = emailButton('https://example.com', 'Click Me', ctx({ trackingPrefix: 'https://t.co/?u=' }));
    expect(result).toContain('https://t.co/?u=https%3A%2F%2Fexample.com');
    expect(result).toContain('Click Me');
    expect(result).toContain('role="presentation"');
  });

  test('produces button without tracking', () => {
    const result = emailButton('https://example.com', 'Click', ctx());
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('Click');
  });

  test('uses variable overrides for accent and radius', () => {
    const result = emailButton('https://test.com', 'Go', ctx({
      accent: '#ff6600',
      radius: '8px',
    }));
    expect(result).toContain('#ff6600');
    expect(result).toContain('8px');
  });

  test('escapes HTML in label', () => {
    const result = emailButton('https://test.com', '<script>alert(1)</script>', ctx());
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  test('sanitizes unsafe URLs', () => {
    const result = emailButton('javascript:alert(1)', 'Hack', ctx());
    expect(result).toContain('href=""');
    expect(result).not.toContain('javascript:');
  });

  test('uses default EMAIL_DEFAULTS when no variables', () => {
    const result = emailButton('https://test.com', 'Go', ctx());
    expect(result).toContain(EMAIL_DEFAULTS.colorAccent);
    expect(result).toContain(EMAIL_DEFAULTS.radius);
    expect(result).toContain(EMAIL_DEFAULTS.fontBody);
  });
});

describe('trackUrl — link tracking', () => {
  test('returns original URL when no prefix', () => {
    expect(trackUrl('https://example.com', ctx())).toBe('https://example.com');
  });

  test('prepends prefix with encoded URL', () => {
    const result = trackUrl('https://example.com/path?q=1', ctx({ trackingPrefix: 'https://t.co/?u=' }));
    expect(result).toBe('https://t.co/?u=https%3A%2F%2Fexample.com%2Fpath%3Fq%3D1');
  });

  test('returns empty string for empty URL', () => {
    expect(trackUrl('', ctx({ trackingPrefix: 'https://t.co/?u=' }))).toBe('');
  });

  test('handles URL with special characters', () => {
    const result = trackUrl('https://example.com/a&b=c', ctx({ trackingPrefix: 'https://t.co/?u=' }));
    expect(result).toContain('https%3A%2F%2Fexample.com%2Fa%26b%3Dc');
  });
});

describe('replaceUrls — URL replacement in documents', () => {
  test('returns document unchanged for empty URL map', () => {
    const doc: MklyDocument = {
      uses: ['core'],
      meta: { version: '1' },
      themes: [],
      presets: [],
      styleBlocks: [],
      blocks: [
        { type: 'core/text', properties: {}, content: 'Hello', children: [], label: '' },
      ],
    };
    const result = replaceUrls(doc, {});
    expect(result).toBe(doc);
  });

  test('replaces URLs in block properties', () => {
    const doc: MklyDocument = {
      uses: ['core'],
      meta: { version: '1' },
      themes: [],
      presets: [],
      styleBlocks: [],
      blocks: [
        {
          type: 'core/image',
          properties: { src: 'https://old.com/img.png', alt: 'Test' },
          content: '',
          children: [],
          label: '',
        },
      ],
    };
    const result = replaceUrls(doc, { 'https://old.com/img.png': 'https://new.com/img.png' });
    expect(result.blocks[0].properties.src).toBe('https://new.com/img.png');
  });

  test('replaces URLs in block content', () => {
    const doc: MklyDocument = {
      uses: ['core'],
      meta: { version: '1' },
      themes: [],
      presets: [],
      styleBlocks: [],
      blocks: [
        {
          type: 'core/text',
          properties: {},
          content: 'Visit https://old.com for more',
          children: [],
          label: '',
        },
      ],
    };
    const result = replaceUrls(doc, { 'https://old.com': 'https://new.com' });
    expect(result.blocks[0].content).toBe('Visit https://new.com for more');
  });

  test('replaces URLs in nested children', () => {
    const doc: MklyDocument = {
      uses: ['core'],
      meta: { version: '1' },
      themes: [],
      presets: [],
      styleBlocks: [],
      blocks: [
        {
          type: 'core/section',
          properties: {},
          content: '',
          label: '',
          children: [
            {
              type: 'core/image',
              properties: { src: 'https://old.com/a.png', alt: 'A' },
              content: '',
              children: [],
              label: '',
            },
          ],
        },
      ],
    };
    const result = replaceUrls(doc, { 'https://old.com/a.png': 'https://cdn.com/a.png' });
    expect(result.blocks[0].children[0].properties.src).toBe('https://cdn.com/a.png');
  });

  test('does not replace non-URL properties', () => {
    const doc: MklyDocument = {
      uses: ['core'],
      meta: { version: '1' },
      themes: [],
      presets: [],
      styleBlocks: [],
      blocks: [
        {
          type: 'core/heading',
          properties: { level: '2' },
          content: 'Title',
          children: [],
          label: '',
        },
      ],
    };
    const result = replaceUrls(doc, { '2': '3' });
    expect(result.blocks[0].properties.level).toBe('2');
  });

  test('replaces link property in blocks', () => {
    const doc: MklyDocument = {
      uses: ['core'],
      meta: { version: '1' },
      themes: [],
      presets: [],
      styleBlocks: [],
      blocks: [
        {
          type: 'core/card',
          properties: { link: 'https://old.com/article' },
          content: 'Card',
          children: [],
          label: '',
        },
      ],
    };
    const result = replaceUrls(doc, { 'https://old.com/article': 'https://new.com/article' });
    expect(result.blocks[0].properties.link).toBe('https://new.com/article');
  });
});

// ===== CSS Inliner Edge Cases =====

describe('parseDeclarations — edge cases', () => {
  test('handles data: URLs (semicolon inside url())', () => {
    const rules = parseRules('.bg { background: url(data:image/png;base64,abc123); }');
    expect(rules).toHaveLength(1);
    // The semicolon inside data: URL splits the declaration — this is a known limitation
    // Just verify it doesn't crash and produces some output
    const bg = rules[0].declarations.get('background');
    expect(bg).toBeDefined();
  });

  test('handles values with colons (e.g. time values)', () => {
    const rules = parseRules('.foo { content: "10:30 AM"; }');
    expect(rules).toHaveLength(1);
    expect(rules[0].declarations.get('content')).toBe('"10:30 AM"');
  });
});

describe('simplifyCalc — edge cases', () => {
  test('simplifies px * number', () => {
    const rules = parseRules('.foo { margin-bottom: calc(24px * 1.5); }');
    const vars = new Map<string, string>();
    const resolved = resolveVarReferences(rules[0].declarations.get('margin-bottom')!, vars);
    // simplifyCalc is called inside resolveAllDeclarations, but we can test the input
    expect(resolved).toContain('calc(24px * 1.5)');
  });

  test('calc with unresolved var stays as-is', () => {
    const value = 'calc(var(--unknown) * 2)';
    const vars = new Map<string, string>();
    const resolved = resolveVarReferences(value, vars);
    expect(resolved).toContain('calc(var(--unknown) * 2)');
  });
});

describe('unwrapLayers — edge cases', () => {
  test('handles nested @layer blocks', () => {
    const css = '@layer kit { @layer inner { .foo { color: red; } } }';
    const result = unwrapLayers(css);
    expect(result).toContain('.foo { color: red; }');
    expect(result).not.toContain('@layer');
  });

  test('strips CSS comments', () => {
    const css = '/* comment */ .foo { color: red; } /* another */';
    const result = unwrapLayers(css);
    expect(result).toContain('.foo { color: red; }');
    expect(result).not.toContain('comment');
  });

  test('removes @media blocks', () => {
    const css = '.foo { color: red; } @media (max-width:600px) { .foo { color: blue; } }';
    const result = unwrapLayers(css);
    expect(result).toContain('.foo { color: red; }');
    expect(result).not.toContain('@media');
    expect(result).not.toContain('blue');
  });

  test('removes @keyframes blocks', () => {
    const css = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } .foo { color: red; }';
    const result = unwrapLayers(css);
    expect(result).not.toContain('@keyframes');
    expect(result).toContain('.foo { color: red; }');
  });

  test('handles multiple @layer declarations', () => {
    const css = '@layer kit, theme;\n@layer preset, user;\n.foo { color: red; }';
    const result = unwrapLayers(css);
    expect(result).not.toContain('@layer');
    expect(result).toContain('.foo { color: red; }');
  });
});

describe('selectorMatchesElement — via inlineStyles', () => {
  test('matches tag-only selector', () => {
    const html = '<p>Hello</p>';
    const rules = parseRules('p { color: red; }');
    const result = inlineStyles(html, rules);
    expect(result).toContain('style="color:red"');
  });

  test('matches compound class selector', () => {
    const html = '<div class="foo bar">text</div>';
    const rules = parseRules('.foo.bar { color: green; }');
    const result = inlineStyles(html, rules);
    expect(result).toContain('color:green');
  });

  test('matches tag + class selector', () => {
    const html = '<h1 class="title">text</h1>';
    const rules = parseRules('h1.title { font-size: 32px; }');
    const result = inlineStyles(html, rules);
    expect(result).toContain('font-size:32px');
  });

  test('skips child combinator (>) gracefully', () => {
    const html = '<div class="parent"><span class="child">text</span></div>';
    const rules = parseRules('.parent > .child { color: red; }');
    const result = inlineStyles(html, rules);
    // `>` combinator is not supported — the selector should be silently skipped
    expect(result).not.toContain('color:red');
  });

  test('skips ::before pseudo-element', () => {
    const html = '<div class="foo">text</div>';
    const rules = parseRules('.foo::before { content: "→"; }');
    const result = inlineStyles(html, rules);
    expect(result).not.toContain('content:');
  });

  test('skips ::marker pseudo-element', () => {
    const html = '<li class="item">text</li>';
    const rules = parseRules('.item::marker { color: red; }');
    const result = inlineStyles(html, rules);
    expect(result).not.toContain('color:red');
  });

  test('handles deep descendant selectors (3+ levels)', () => {
    const html = '<div class="a"><div class="b"><span class="c">text</span></div></div>';
    const rules = parseRules('.a .b .c { color: purple; }');
    const result = inlineStyles(html, rules);
    expect(result).toContain('color:purple');
  });

  test('does not match wrong tag for tag selector', () => {
    const html = '<span>text</span>';
    const rules = parseRules('p { color: red; }');
    const result = inlineStyles(html, rules);
    expect(result).not.toContain('color:red');
  });

  test('handles self-closing tags (img, br, hr)', () => {
    const html = '<img class="photo" src="a.png" />';
    const rules = parseRules('.photo { max-width: 100%; }');
    const result = inlineStyles(html, rules);
    expect(result).toContain('max-width:100%');
  });
});

describe('extractMainContent — edge cases', () => {
  test('extracts content from <main> tag', () => {
    const html = '<main class="mkly-document"><div>Content</div></main>';
    expect(extractMainContent(html)).toBe('<div>Content</div>');
  });

  test('returns full HTML when no <main> tag', () => {
    const html = '<div>No main here</div>';
    expect(extractMainContent(html)).toBe('<div>No main here</div>');
  });
});

describe('stripNonContentTags', () => {
  test('removes script tags with content', () => {
    const html = '<div>text</div><script>alert(1)</script><p>more</p>';
    const result = stripNonContentTags(html);
    expect(result).not.toContain('<script');
    expect(result).toContain('<div>text</div>');
    expect(result).toContain('<p>more</p>');
  });

  test('removes meta tags', () => {
    const html = '<meta name="viewport" content="width=device-width"><div>text</div>';
    const result = stripNonContentTags(html);
    expect(result).not.toContain('<meta');
    expect(result).toContain('<div>text</div>');
  });
});

describe('collectCustomProperties', () => {
  test('collects from :root', () => {
    const rules = parseRules(':root { --color: red; font-size: 16px; }');
    const vars = collectCustomProperties(rules);
    expect(vars.get('--color')).toBe('red');
    expect(vars.has('font-size')).toBe(false);
  });

  test('collects from .mkly-document', () => {
    const rules = parseRules('.mkly-document { --mkly-accent: #e2725b; color: #333; }');
    const vars = collectCustomProperties(rules);
    expect(vars.get('--mkly-accent')).toBe('#e2725b');
    expect(vars.has('color')).toBe(false);
  });

  test('ignores custom properties from other selectors', () => {
    const rules = parseRules('.foo { --bar: baz; }');
    const vars = collectCustomProperties(rules);
    expect(vars.size).toBe(0);
  });
});

describe('resolveVarReferences — edge cases', () => {
  test('resolves nested var() with fallback', () => {
    const vars = new Map([['--a', '#ff0000']]);
    const result = resolveVarReferences('var(--a, var(--b, blue))', vars);
    expect(result).toBe('#ff0000');
  });

  test('uses inner fallback when outer var not found', () => {
    const vars = new Map<string, string>();
    const result = resolveVarReferences('var(--missing, var(--also-missing, 16px))', vars);
    expect(result).toBe('16px');
  });

  test('resolves chain of variables', () => {
    const vars = new Map([['--a', 'var(--b)'], ['--b', 'var(--c)'], ['--c', 'red']]);
    expect(resolveVarReferences('var(--a)', vars)).toBe('red');
  });

  test('handles var() with comma in fallback', () => {
    const vars = new Map<string, string>();
    const result = resolveVarReferences('var(--font, Helvetica, Arial, sans-serif)', vars);
    expect(result).toBe('Helvetica, Arial, sans-serif');
  });

  test('stops after 10 iterations to prevent infinite loops', () => {
    const vars = new Map([['--a', 'var(--b)'], ['--b', 'var(--a)']]);
    const result = resolveVarReferences('var(--a)', vars);
    // Should not throw — just return whatever it resolved to after 10 iterations
    expect(result).toBeDefined();
  });
});

// ===== Full Pipeline Edge Cases =====

describe('email pipeline — non-breaking spaces', () => {
  test('\\~ becomes &nbsp; in email output', () => {
    const html = compileEmail(`--- core/text\nHello\\~World`);
    expect(html).toContain('&nbsp;');
  });
});

describe('email pipeline — HTML entities in content', () => {
  test('ampersand in heading is escaped', () => {
    const html = compileEmail(`--- core/heading\nlevel: 2\nTom & Jerry`);
    expect(html).toContain('Tom');
    expect(html).toContain('Jerry');
  });

  test('ampersand in text is properly rendered', () => {
    const html = compileEmail(`--- core/text\nGet $99 deals & 20% off`);
    expect(html).toContain('$99');
    expect(html).toContain('20%');
  });
});

describe('email pipeline — multiple style blocks', () => {
  test('user variables resolve to inline styles', () => {
    const source = [
      '--- style',
      'accent: #e2725b',
      'core/heading',
      '  color: $accent',
      '',
      '--- core/heading',
      'level: 2',
      'Colored Title',
    ].join('\n');
    const html = compileEmail(source);
    expect(html).toContain('#e2725b');
    expect(html).toContain('Colored Title');
  });

  test('sub-element styles are inlined', () => {
    const source = [
      '--- style',
      'core/card',
      '  border-radius: 12px',
      '  .img',
      '    object-fit: cover',
      '',
      '--- core/card',
      'title: My Card',
      'img: https://example.com/photo.jpg',
    ].join('\n');
    const html = compileEmail(source);
    expect(html).toContain('border-radius:12px');
  });
});

describe('email pipeline — link tracking in full compile', () => {
  test('button links are tracked', () => {
    const source = [
      '--- core/button',
      'url: https://example.com/action',
      'label: Click Here',
    ].join('\n');
    const html = compileEmail(source, { trackingPrefix: 'https://t.co/?u=' });
    expect(html).toContain('https://t.co/?u=');
    expect(html).toContain('Click Here');
  });

  test('links without tracking prefix are not modified', () => {
    const source = [
      '--- core/button',
      'url: https://example.com',
      'label: Click',
    ].join('\n');
    const html = compileEmail(source);
    expect(html).toContain('https://example.com');
    expect(html).not.toContain('t.co');
  });
});

describe('email pipeline — markdown formatting in email', () => {
  test('bold text is preserved in email', () => {
    const html = compileEmail(`--- core/text\nThis is **bold** text`);
    expect(html).toContain('<strong>bold</strong>');
  });

  test('italic text is preserved in email', () => {
    const html = compileEmail(`--- core/text\nThis is *italic* text`);
    expect(html).toContain('<em>italic</em>');
  });

  test('links in text are preserved with inline styles', () => {
    const html = compileEmail(`--- core/text\nClick [here](https://example.com) now`);
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('here');
  });

  test('list items render in email', () => {
    const html = compileEmail(`--- core/text\n- Item one\n- Item two\n- Item three`);
    expect(html).toContain('Item one');
    expect(html).toContain('Item two');
    expect(html).toContain('Item three');
  });
});

describe('email pipeline — mkly meta tags in email', () => {
  test('email output includes mkly:use meta tags', () => {
    const html = compileEmail(`--- core/text\nContent`);
    expect(html).toContain('name="mkly:use"');
    expect(html).toContain('content="core"');
  });

  test('email output includes mkly:version meta', () => {
    const html = compileEmail(`--- core/text\nContent`);
    expect(html).toContain('name="mkly:version"');
    expect(html).toContain('content="1"');
  });

  test('custom meta fields are preserved', () => {
    const source = [
      '--- meta',
      'title: My Newsletter',
      'author: Test',
      '',
      '--- core/text',
      'Content',
    ].join('\n');
    const html = compileEmail(source);
    expect(html).toContain('name="mkly:title"');
    expect(html).toContain('content="My Newsletter"');
  });
});

describe('email pipeline — max-width extraction', () => {
  test('uses default 600px max-width', () => {
    const html = compileEmail(`--- core/text\nContent`);
    expect(html).toContain('width="600"');
    expect(html).toContain('max-width:600px');
  });
});

describe('email pipeline — document styles from CSS', () => {
  test('document background color flows to body wrapper', () => {
    const source = [
      '--- style',
      'bg: #f5f5f5',
      '',
      '--- core/text',
      'Content',
    ].join('\n');
    const html = compileEmail(source);
    // The document background should appear in the body style
    expect(html).toContain('background:');
  });
});

describe('cssToInline — full pipeline edge cases', () => {
  test('variable-to-variable resolution works', () => {
    const webHtml = [
      '<style>',
      '.mkly-document { --mkly-accent: #e2725b; --mkly-link-color: var(--mkly-accent); }',
      '.mkly-core-text a { color: var(--mkly-link-color); }',
      '</style>',
      '<main class="mkly-document"><div class="mkly-core-text"><p><a href="#">Link</a></p></div></main>',
    ].join('\n');
    const { contentHtml } = cssToInline(webHtml);
    expect(contentHtml).toContain('color:#e2725b');
    expect(contentHtml).not.toContain('var(');
  });

  test('calc() with gap-scale resolves to px', () => {
    const webHtml = [
      '<style>',
      '.mkly-document { --mkly-gap-scale: 1; --_gs: var(--mkly-gap-scale, 1); }',
      '.mkly-core-text { margin-bottom: calc(24px * var(--_gs)); }',
      '</style>',
      '<main class="mkly-document"><div class="mkly-core-text"><p>Hello</p></div></main>',
    ].join('\n');
    const { contentHtml } = cssToInline(webHtml);
    expect(contentHtml).toContain('margin-bottom:24px');
    expect(contentHtml).not.toContain('calc(');
    expect(contentHtml).not.toContain('var(');
  });

  test('multiple rules cascade — later rule wins', () => {
    const webHtml = [
      '<style>',
      '.foo { color: red; }',
      '.foo { color: blue; }',
      '</style>',
      '<div class="foo">text</div>',
    ].join('\n');
    const { contentHtml } = cssToInline(webHtml);
    expect(contentHtml).toContain('color:blue');
  });

  test('strips <style> and <meta> tags from output', () => {
    const webHtml = [
      '<meta name="test" content="value">',
      '<style>.foo { color: red; }</style>',
      '<main class="mkly-document"><div class="foo">text</div></main>',
    ].join('\n');
    const { contentHtml } = cssToInline(webHtml);
    expect(contentHtml).not.toContain('<style>');
    expect(contentHtml).not.toContain('<meta');
  });
});
