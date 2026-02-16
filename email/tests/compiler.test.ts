import { describe, it, expect } from 'bun:test';
import { mkly, parse, compile, createRegistry, CORE_KIT } from '@mklyml/core';
import { emailPlugin } from '../src/index';

describe('email plugin compiler integration', () => {
  it('should wrap in table structure with email plugin', () => {
    const result = mkly(`--- use: core\n\n--- meta\nversion: 1\n\n--- core/text\nContent`, {
      kits: { core: CORE_KIT },
      plugins: [emailPlugin()],
    }).html;
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('<table');
    expect(result).toContain('role="presentation"');
    expect(result).toContain('<!--[if mso]>');
  });

  it('should use meta.title with email plugin', () => {
    const result = mkly(`--- use: core\n\n--- meta\nversion: 1\ntitle: Test Email\n\n--- core/text\nContent`, {
      kits: { core: CORE_KIT },
      plugins: [emailPlugin()],
    }).html;
    expect(result).toContain('<title>Test Email</title>');
  });

  it('should use meta.subject over meta.title with email plugin', () => {
    const result = mkly(
      `--- use: core\n\n--- meta\nversion: 1\ntitle: Test\nsubject: Email Subject\n\n--- core/text\nContent`,
      { kits: { core: CORE_KIT }, plugins: [emailPlugin()] },
    ).html;
    expect(result).toContain('<title>Email Subject</title>');
  });

  it('should apply email variables to wrapper', () => {
    const result = mkly(`--- use: core\n\n--- meta\nversion: 1\n\n--- core/text\nContent`, {
      kits: { core: CORE_KIT },
      plugins: [emailPlugin()],
      variables: {
        fontBody: 'Verdana, sans-serif',
        text: '#000000',
        background: '#fafafa',
      },
    }).html;
    expect(result).toContain('Verdana');
    expect(result).toContain('#000000');
    expect(result).toContain('#fafafa');
  });

  it('should use fallback values when no variables provided', () => {
    const result = mkly(`--- use: core\n\n--- meta\nversion: 1\n\n--- core/text\nContent`, {
      kits: { core: CORE_KIT },
      plugins: [emailPlugin()],
    }).html;
    expect(result).toContain('Helvetica');
    expect(result).toContain('#333333');
  });

  it('should use plugin renderers to override block compilation', () => {
    const source = `--- use: core\n\n--- meta\nversion: 1\n\n--- core/text\nHello`;
    const doc = parse(source);
    const registry = createRegistry();
    const result = compile(doc, registry, { kits: { core: CORE_KIT }, plugins: [emailPlugin()] });
    expect(result.html).toContain('font-family:Helvetica');
    expect(result.html).not.toContain('class="mkly-text"');
  });

  it('should produce valid email HTML via plugin', () => {
    const result = mkly(`--- use: core\n\n--- meta\nversion: 1\ntitle: Test\n\n--- core/text\n\nContent`, {
      kits: { core: CORE_KIT },
      plugins: [emailPlugin()],
    });
    expect(result.html).toContain('<!DOCTYPE html>');
    expect(result.html).toContain('<html>');
    expect(result.html).toContain('</html>');
    expect(result.html).toContain('<body');
    expect(result.html).toContain('</body>');
  });

  it('should compile example.mkly to email HTML via plugin', () => {
    const { readFileSync } = require('fs');
    const { join } = require('path');
    const examplePath = join(__dirname, '..', '..', '..', 'mkly', 'example.mkly');
    const exampleSource = readFileSync(examplePath, 'utf-8');
    const { parse: parseMkly, createRegistry: createReg, compile: compileMkly, CORE_KIT: coreKit } = require('@mklyml/core');
    const doc = parseMkly(exampleSource);
    const registry = createReg();
    const result = compileMkly(doc, registry, { kits: { core: coreKit }, plugins: [emailPlugin()] });

    expect(result.html).toContain('<!DOCTYPE html>');
    expect(result.html).toContain('<table');
    expect(result.html).toContain('The simplest way to write rich HTML');
  });
});
