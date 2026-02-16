import { describe, test, expect } from 'bun:test';
import { parse, compile, createRegistry, CORE_KIT } from '@mklyml/core';
import { seoPlugin, buildStandardMeta, buildOpenGraphMeta, buildTwitterMeta, buildJsonLd } from '../src/index';

function compileSeo(source: string, options: Parameters<typeof seoPlugin>[0] = {}): string {
  const fullSource = `--- use: core\n\n--- meta\nversion: 1\n${source}`;
  const doc = parse(fullSource);
  const registry = createRegistry();
  return compile(doc, registry, {
    plugins: [seoPlugin(options)],
    kits: { core: CORE_KIT },
  }).html;
}

// ---------------------------------------------------------------------------
// Full document output
// ---------------------------------------------------------------------------

describe('seoPlugin wrapOutput', () => {
  test('produces full HTML document', () => {
    const html = compileSeo(`title: Test Page\n\n--- core/text\nContent`);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<head>');
    expect(html).toContain('</head>');
    expect(html).toContain('<body>');
    expect(html).toContain('</body>');
    expect(html).toContain('</html>');
  });

  test('uses charset and viewport', () => {
    const html = compileSeo(`title: Test\n\n--- core/text\nContent`);
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('<meta name="viewport" content="width=device-width,initial-scale=1.0">');
  });

  test('wraps content in main.mkly-document', () => {
    const html = compileSeo(`title: Test\n\n--- core/text\nContent`);
    expect(html).toContain('<main class="mkly-document"');
    expect(html).toContain('max-width:600px');
    expect(html).toContain('</main>');
  });

  test('builds title with siteName', () => {
    const html = compileSeo(`title: My Article\n\n--- core/text\nContent`, { siteName: 'My Blog' });
    expect(html).toContain('<title>My Article — My Blog</title>');
  });

  test('uses siteName alone when no meta title', () => {
    const html = compileSeo(`\n--- core/text\nContent`, { siteName: 'My Blog' });
    expect(html).toContain('<title>My Blog</title>');
  });

  test('uses meta title alone when no siteName', () => {
    const html = compileSeo(`title: Solo Title\n\n--- core/text\nContent`);
    expect(html).toContain('<title>Solo Title</title>');
  });

  test('uses lang from meta', () => {
    const html = compileSeo(`title: Test\nlang: fr\n\n--- core/text\nContent`);
    expect(html).toContain('<html lang="fr">');
  });

  test('defaults to lang="en"', () => {
    const html = compileSeo(`title: Test\n\n--- core/text\nContent`);
    expect(html).toContain('<html lang="en">');
  });
});

// ---------------------------------------------------------------------------
// Standard meta tags
// ---------------------------------------------------------------------------

describe('standard meta tags', () => {
  test('generates description meta tag', () => {
    const html = compileSeo(`title: Test\ndescription: A great article\n\n--- core/text\nContent`);
    expect(html).toContain('<meta name="description" content="A great article">');
  });

  test('generates keywords meta tag', () => {
    const html = compileSeo(`title: Test\nkeywords: tech, ai, ml\n\n--- core/text\nContent`);
    expect(html).toContain('<meta name="keywords" content="tech, ai, ml">');
  });

  test('generates author meta tag', () => {
    const html = compileSeo(`title: Test\nauthor: Jane Smith\n\n--- core/text\nContent`);
    expect(html).toContain('<meta name="author" content="Jane Smith">');
  });

  test('generates canonical link', () => {
    const html = compileSeo(`title: Test\ncanonical: https://example.com/article\n\n--- core/text\nContent`);
    expect(html).toContain('<link rel="canonical" href="https://example.com/article">');
  });

  test('falls back to siteUrl for canonical', () => {
    const html = compileSeo(`title: Test\n\n--- core/text\nContent`, { siteUrl: 'https://blog.example.com' });
    expect(html).toContain('<link rel="canonical" href="https://blog.example.com">');
  });

  test('uses defaultDescription when no meta description', () => {
    const html = compileSeo(`title: Test\n\n--- core/text\nContent`, { defaultDescription: 'Fallback desc' });
    expect(html).toContain('<meta name="description" content="Fallback desc">');
  });
});

// ---------------------------------------------------------------------------
// Open Graph tags
// ---------------------------------------------------------------------------

describe('Open Graph meta tags', () => {
  test('generates og:type', () => {
    const html = compileSeo(`title: Test\n\n--- core/text\nContent`);
    expect(html).toContain('<meta property="og:type" content="article">');
  });

  test('uses meta type for og:type', () => {
    const html = compileSeo(`title: Test\ntype: website\n\n--- core/text\nContent`);
    expect(html).toContain('<meta property="og:type" content="website">');
  });

  test('generates og:title', () => {
    const html = compileSeo(`title: My Title\n\n--- core/text\nContent`);
    expect(html).toContain('<meta property="og:title" content="My Title">');
  });

  test('generates og:description', () => {
    const html = compileSeo(`title: Test\ndescription: OG desc\n\n--- core/text\nContent`);
    expect(html).toContain('<meta property="og:description" content="OG desc">');
  });

  test('generates og:image', () => {
    const html = compileSeo(`title: Test\nimage: https://example.com/og.jpg\n\n--- core/text\nContent`);
    expect(html).toContain('<meta property="og:image" content="https://example.com/og.jpg">');
  });

  test('falls back to defaultImage for og:image', () => {
    const html = compileSeo(`title: Test\n\n--- core/text\nContent`, { defaultImage: 'https://example.com/default.jpg' });
    expect(html).toContain('<meta property="og:image" content="https://example.com/default.jpg">');
  });

  test('generates og:url from canonical', () => {
    const html = compileSeo(`title: Test\ncanonical: https://example.com/page\n\n--- core/text\nContent`);
    expect(html).toContain('<meta property="og:url" content="https://example.com/page">');
  });

  test('generates og:site_name', () => {
    const html = compileSeo(`title: Test\n\n--- core/text\nContent`, { siteName: 'My Site' });
    expect(html).toContain('<meta property="og:site_name" content="My Site">');
  });

  test('generates og:locale', () => {
    const html = compileSeo(`title: Test\n\n--- core/text\nContent`, { locale: 'en_US' });
    expect(html).toContain('<meta property="og:locale" content="en_US">');
  });

  test('generates article:published_time', () => {
    const html = compileSeo(`title: Test\npublishedDate: 2026-02-08\n\n--- core/text\nContent`);
    expect(html).toContain('<meta property="article:published_time" content="2026-02-08">');
  });

  test('generates article:modified_time', () => {
    const html = compileSeo(`title: Test\nmodifiedDate: 2026-02-09\n\n--- core/text\nContent`);
    expect(html).toContain('<meta property="article:modified_time" content="2026-02-09">');
  });

  test('generates article:author', () => {
    const html = compileSeo(`title: Test\nauthor: Jane\n\n--- core/text\nContent`);
    expect(html).toContain('<meta property="article:author" content="Jane">');
  });
});

// ---------------------------------------------------------------------------
// Twitter Card tags
// ---------------------------------------------------------------------------

describe('Twitter Card meta tags', () => {
  test('generates summary_large_image card when image present', () => {
    const html = compileSeo(`title: Test\nimage: https://example.com/img.jpg\n\n--- core/text\nContent`);
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
  });

  test('generates summary card when no image', () => {
    const html = compileSeo(`title: Test\n\n--- core/text\nContent`);
    expect(html).toContain('<meta name="twitter:card" content="summary">');
  });

  test('generates twitter:title', () => {
    const html = compileSeo(`title: Tweet This\n\n--- core/text\nContent`);
    expect(html).toContain('<meta name="twitter:title" content="Tweet This">');
  });

  test('generates twitter:description', () => {
    const html = compileSeo(`title: Test\ndescription: Tweet desc\n\n--- core/text\nContent`);
    expect(html).toContain('<meta name="twitter:description" content="Tweet desc">');
  });

  test('generates twitter:image', () => {
    const html = compileSeo(`title: Test\nimage: https://example.com/tw.jpg\n\n--- core/text\nContent`);
    expect(html).toContain('<meta name="twitter:image" content="https://example.com/tw.jpg">');
  });

  test('generates twitter:site from twitterHandle', () => {
    const html = compileSeo(`title: Test\n\n--- core/text\nContent`, { twitterHandle: '@myblog' });
    expect(html).toContain('<meta name="twitter:site" content="@myblog">');
  });
});

// ---------------------------------------------------------------------------
// JSON-LD structured data
// ---------------------------------------------------------------------------

describe('JSON-LD structured data', () => {
  test('generates JSON-LD by default', () => {
    const html = compileSeo(`title: Test Article\nauthor: Jane\n\n--- core/text\nContent`);
    expect(html).toContain('<script type="application/ld+json">');
    expect(html).toContain('"@context": "https://schema.org"');
    expect(html).toContain('"@type": "Article"');
    expect(html).toContain('"headline": "Test Article"');
  });

  test('uses custom jsonLdType', () => {
    const html = compileSeo(`title: Test\n\n--- core/text\nContent`, { jsonLdType: 'BlogPosting' });
    expect(html).toContain('"@type": "BlogPosting"');
  });

  test('disables JSON-LD with jsonLd: false', () => {
    const html = compileSeo(`title: Test\n\n--- core/text\nContent`, { jsonLd: false });
    expect(html).not.toContain('application/ld+json');
  });

  test('includes author in JSON-LD', () => {
    const html = compileSeo(`title: Test\nauthor: Jane Smith\n\n--- core/text\nContent`);
    expect(html).toContain('"@type": "Person"');
    expect(html).toContain('"name": "Jane Smith"');
  });

  test('includes publisher in JSON-LD', () => {
    const html = compileSeo(`title: Test\n\n--- core/text\nContent`, { siteName: 'Tech Blog' });
    expect(html).toContain('"@type": "Organization"');
    expect(html).toContain('"name": "Tech Blog"');
  });

  test('includes datePublished in JSON-LD', () => {
    const html = compileSeo(`title: Test\npublishedDate: 2026-02-08\n\n--- core/text\nContent`);
    expect(html).toContain('"datePublished": "2026-02-08"');
  });

  test('includes image in JSON-LD', () => {
    const html = compileSeo(`title: Test\nimage: https://example.com/img.jpg\n\n--- core/text\nContent`);
    expect(html).toContain('"image": "https://example.com/img.jpg"');
  });

  test('includes custom JSON-LD properties', () => {
    const html = compileSeo(`title: Test\n\n--- core/text\nContent`, {
      customJsonLd: { inLanguage: 'en-US' },
    });
    expect(html).toContain('"inLanguage": "en-US"');
  });

  test('escapes HTML in JSON-LD output', () => {
    const html = compileSeo(`title: Test <script>\n\n--- core/text\nContent`);
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('\\u003cscript\\u003e');
  });
});

// ---------------------------------------------------------------------------
// Extra meta tags
// ---------------------------------------------------------------------------

describe('extra meta tags', () => {
  test('includes extra meta tags', () => {
    const html = compileSeo(`title: Test\n\n--- core/text\nContent`, {
      extraMeta: ['<meta name="robots" content="noindex">'],
    });
    expect(html).toContain('<meta name="robots" content="noindex">');
  });
});

// ---------------------------------------------------------------------------
// HTML escaping
// ---------------------------------------------------------------------------

describe('HTML escaping in meta', () => {
  test('escapes title with special characters', () => {
    const html = compileSeo(`title: Title "with" <special> & chars\n\n--- core/text\nContent`);
    expect(html).toContain('Title &quot;with&quot; &lt;special&gt; &amp; chars');
  });

  test('escapes description', () => {
    const html = compileSeo(`title: Test\ndescription: Desc with "quotes"\n\n--- core/text\nContent`);
    expect(html).toContain('content="Desc with &quot;quotes&quot;"');
  });
});

// ---------------------------------------------------------------------------
// Builder functions directly
// ---------------------------------------------------------------------------

describe('buildStandardMeta', () => {
  test('returns empty array with no input', () => {
    const tags = buildStandardMeta({});
    expect(tags).toHaveLength(0);
  });

  test('builds all standard tags', () => {
    const tags = buildStandardMeta({
      description: 'Desc',
      keywords: 'a, b',
      author: 'Jane',
      canonical: 'https://example.com',
    });
    expect(tags).toHaveLength(4);
  });
});

describe('buildOpenGraphMeta', () => {
  test('always includes og:type', () => {
    const tags = buildOpenGraphMeta({});
    expect(tags.length).toBeGreaterThanOrEqual(1);
    expect(tags[0]).toContain('og:type');
  });
});

describe('buildTwitterMeta', () => {
  test('always includes twitter:card', () => {
    const tags = buildTwitterMeta({});
    expect(tags.length).toBeGreaterThanOrEqual(1);
    expect(tags[0]).toContain('twitter:card');
  });
});

describe('buildJsonLd', () => {
  test('builds valid JSON-LD', () => {
    const result = buildJsonLd({
      type: 'Article',
      title: 'Test',
      author: 'Jane',
    });
    expect(result).toContain('application/ld+json');
    expect(result).toContain('"@context": "https://schema.org"');
    expect(result).toContain('"@type": "Article"');
    expect(result).toContain('"headline": "Test"');
  });

  test('builds WebPage type', () => {
    const result = buildJsonLd({ type: 'WebPage', title: 'Home' });
    expect(result).toContain('"@type": "WebPage"');
  });

  test('includes mainEntityOfPage', () => {
    const result = buildJsonLd({ type: 'Article', url: 'https://example.com/article' });
    expect(result).toContain('"mainEntityOfPage": "https://example.com/article"');
  });
});
