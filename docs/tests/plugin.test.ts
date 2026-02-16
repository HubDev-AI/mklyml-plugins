import { describe, test, expect } from 'bun:test';
import type { MklyBlock, CompileContext, SourceRange, CompileResult } from '@mklyml/core';
import { mkly, CORE_KIT } from '@mklyml/core';
import { docsPlugin, slugify } from '../src/index';

const POS: SourceRange = { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } };

function block(blockType: string, properties: Record<string, string> = {}, content = ''): MklyBlock {
  return { blockType, properties, content, children: [], position: POS };
}

function ctx(variables: Record<string, string> = {}): CompileContext {
  return { variables, errors: [], extraStyles: new Set() };
}

const plugin = docsPlugin();
const pluginNoWrap = docsPlugin({ wrap: false });

describe('slugify', () => {
  test('basic text to slug', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  test('strips special characters', () => {
    expect(slugify('What is mkly?')).toBe('what-is-mkly');
  });

  test('collapses multiple dashes', () => {
    expect(slugify('foo---bar')).toBe('foo-bar');
  });

  test('trims leading/trailing dashes', () => {
    expect(slugify('-hello-')).toBe('hello');
  });

  test('handles empty string', () => {
    expect(slugify('')).toBe('');
  });

  test('handles numbers', () => {
    expect(slugify('Step 1 Setup')).toBe('step-1-setup');
  });
});

describe('heading renderer', () => {
  const render = plugin.renderers!['core/heading'];

  test('adds id and anchor link', () => {
    const html = render(block('heading', { level: '2' }, 'Getting Started'), ctx());
    expect(html).toContain('id="getting-started"');
    expect(html).toContain('href="#getting-started"');
    expect(html).toContain('class="mkly-docs-heading__anchor"');
    expect(html).toContain('<h2');
    expect(html).toContain('</h2>');
  });

  test('uses correct heading level', () => {
    const html = render(block('heading', { level: '3' }, 'API'), ctx());
    expect(html).toContain('<h3');
    expect(html).toContain('mkly-core-heading--3');
  });

  test('defaults to h2', () => {
    const html = render(block('heading', {}, 'Title'), ctx());
    expect(html).toContain('<h2');
    expect(html).toContain('mkly-core-heading--2');
  });

  test('escapes HTML in text', () => {
    const html = render(block('heading', { level: '2' }, '<script>'), ctx());
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  test('special chars in slug are stripped', () => {
    const html = render(block('heading', { level: '2' }, 'What\'s new in v2.0?'), ctx());
    expect(html).toContain('id="whats-new-in-v20"');
  });

  test('has docs-specific classes', () => {
    const html = render(block('heading', { level: '1' }, 'Intro'), ctx());
    expect(html).toContain('mkly-docs-heading');
    expect(html).toContain('mkly-core-heading');
  });
});

describe('code renderer', () => {
  const render = plugin.renderers!['core/code'];

  test('adds copy button', () => {
    const html = render(block('code', {}, 'const x = 1;'), ctx());
    expect(html).toContain('class="mkly-docs-code__copy"');
    expect(html).toContain('aria-label="Copy code"');
    expect(html).toContain('>Copy</button>');
  });

  test('has docs-specific wrapper class', () => {
    const html = render(block('code', {}, 'x'), ctx());
    expect(html).toContain('mkly-docs-code');
    expect(html).toContain('mkly-core-code');
  });

  test('includes lang attribute', () => {
    const html = render(block('code', { lang: 'typescript' }, 'let a = 1;'), ctx());
    expect(html).toContain('data-lang="typescript"');
  });

  test('no lang attribute when not specified', () => {
    const html = render(block('code', {}, 'text'), ctx());
    expect(html).not.toContain('data-lang');
  });

  test('escapes content', () => {
    const html = render(block('code', {}, '<div>test</div>'), ctx());
    expect(html).toContain('&lt;div&gt;test&lt;/div&gt;');
  });
});

describe('afterCompile', () => {
  const afterCompile = plugin.afterCompile!;

  test('injects script tag', () => {
    const result: CompileResult = { html: '<div>content</div>', errors: [] };
    const enhanced = afterCompile(result, ctx());
    expect(enhanced.html).toContain('<script>');
    expect(enhanced.html).toContain('</script>');
  });

  test('script contains tab switching logic', () => {
    const result: CompileResult = { html: '', errors: [] };
    const enhanced = afterCompile(result, ctx());
    expect(enhanced.html).toContain('mkly-docs-tabs');
    expect(enhanced.html).toContain('mkly-docs-tabs__label--active');
  });

  test('script contains copy button logic', () => {
    const result: CompileResult = { html: '', errors: [] };
    const enhanced = afterCompile(result, ctx());
    expect(enhanced.html).toContain('mkly-docs-code__copy');
    expect(enhanced.html).toContain('navigator.clipboard');
    expect(enhanced.html).toContain('Copied!');
  });

  test('preserves original html', () => {
    const result: CompileResult = { html: '<p>hello</p>', errors: [] };
    const enhanced = afterCompile(result, ctx());
    expect(enhanced.html).toStartWith('<p>hello</p>');
  });

  test('preserves errors', () => {
    const result: CompileResult = {
      html: '',
      errors: [{ message: 'test', line: 1, severity: 'error' }],
    };
    const enhanced = afterCompile(result, ctx());
    expect(enhanced.errors).toHaveLength(1);
    expect(enhanced.errors[0].message).toBe('test');
  });
});

describe('wrapOutput', () => {
  const wrapOutput = plugin.wrapOutput!;

  test('produces full HTML document', () => {
    const html = wrapOutput('<p>content</p>', {}, ctx(), 720);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('</html>');
  });

  test('includes nav, sidebar, main, footer', () => {
    const html = wrapOutput('<p>content</p>', {}, ctx(), 720);
    expect(html).toContain('mkly-docs-nav');
    expect(html).toContain('data-sidebar-slot');
    expect(html).toContain('mkly-docs-main');
    expect(html).toContain('mkly-docs-footer');
  });

  test('uses siteName from variables', () => {
    const html = wrapOutput('', {}, ctx({ siteName: 'MyDocs' }), 720);
    expect(html).toContain('MyDocs');
  });

  test('uses title from meta', () => {
    const html = wrapOutput('', { title: 'Install' }, ctx({ siteName: 'MyDocs' }), 720);
    expect(html).toContain('<title>Install — MyDocs</title>');
  });

  test('falls back to siteName for title', () => {
    const html = wrapOutput('', {}, ctx({ siteName: 'MyDocs' }), 720);
    expect(html).toContain('<title>MyDocs</title>');
  });

  test('defaults siteName to mkly', () => {
    const html = wrapOutput('', {}, ctx(), 720);
    expect(html).toContain('<title>mkly</title>');
    expect(html).toContain('>mkly</a>');
  });

  test('includes version badge when provided', () => {
    const html = wrapOutput('', {}, ctx({ version: '1.2.3' }), 720);
    expect(html).toContain('mkly-docs-nav__version');
    expect(html).toContain('1.2.3');
  });

  test('omits version badge when not provided', () => {
    const html = wrapOutput('', {}, ctx(), 720);
    expect(html).not.toContain('<span class="mkly-docs-nav__version">');
  });

  test('includes github link when provided', () => {
    const html = wrapOutput('', {}, ctx({ githubUrl: 'https://github.com/milkly/mkly' }), 720);
    expect(html).toContain('mkly-docs-nav__github');
    expect(html).toContain('https://github.com/milkly/mkly');
  });

  test('omits github link when not provided', () => {
    const html = wrapOutput('', {}, ctx(), 720);
    expect(html).not.toContain('target="_blank"');
  });

  test('includes description meta tag when provided', () => {
    const html = wrapOutput('', {}, ctx({ siteDescription: 'A markup language' }), 720);
    expect(html).toContain('name="description"');
    expect(html).toContain('A markup language');
  });

  test('includes CSS styles', () => {
    const html = wrapOutput('', {}, ctx(), 720);
    expect(html).toContain('<style>');
    expect(html).toContain('--docs-accent');
  });

  test('includes footer link', () => {
    const html = wrapOutput('', {}, ctx(), 720);
    expect(html).toContain('Built with');
    expect(html).toContain('github.com/milkly/mkly');
  });

  test('wraps content in mkly-document div', () => {
    const html = wrapOutput('<p>test</p>', {}, ctx(), 720);
    expect(html).toContain('<div class="mkly-document"><p>test</p></div>');
  });
});

describe('wrap:false option', () => {
  test('disables wrapOutput', () => {
    expect(pluginNoWrap.wrapOutput).toBeUndefined();
  });

  test('still has renderers', () => {
    expect(pluginNoWrap.renderers).toBeDefined();
    expect(pluginNoWrap.renderers!['core/heading']).toBeDefined();
    expect(pluginNoWrap.renderers!['core/code']).toBeDefined();
  });

  test('still has afterCompile', () => {
    expect(pluginNoWrap.afterCompile).toBeDefined();
  });
});

describe('integration', () => {
  test('compile full .mkly source with docs plugin', () => {
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      'title: Quick Start',
      '',
      '--- core/heading',
      'level: 1',
      '',
      'Getting Started',
      '',
      '--- core/code',
      'lang: bash',
      '',
      'npm install mkly',
    ].join('\n');

    const result = mkly(source, {
      plugins: [docsPlugin()],
      kits: { core: CORE_KIT },
      variables: { siteName: 'TestDocs', version: '0.1.0' },
    });

    expect(result.html).toContain('id="getting-started"');
    expect(result.html).toContain('mkly-docs-heading__anchor');
    expect(result.html).toContain('mkly-docs-code__copy');
    expect(result.html).toContain('<!DOCTYPE html>');
    expect(result.html).toContain('<title>Quick Start — TestDocs</title>');
    expect(result.html).toContain('0.1.0');
    expect(result.html).toContain('<script>');
    expect(result.errors).toHaveLength(0);
  });

  test('compile with wrap:false produces fragment', () => {
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- core/heading',
      'level: 2',
      '',
      'Hello',
    ].join('\n');

    const result = mkly(source, {
      plugins: [docsPlugin({ wrap: false })],
      kits: { core: CORE_KIT },
    });

    expect(result.html).toContain('id="hello"');
    expect(result.html).not.toContain('<!DOCTYPE html>');
    expect(result.html).toContain('<script>');
  });
});
