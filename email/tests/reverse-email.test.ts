import { describe, it, expect } from 'bun:test';
import { mkly, CORE_KIT, reverseEmail, htmlToMkly, detectOrigin } from '@mklyml/core';
import { emailPlugin } from '../src/index';

describe('reverse email parser', () => {
  it('should extract title from email HTML', () => {
    const html = mkly('--- meta\nversion: 1\ntitle: Test Email\n\n--- core/text\n\nContent', {
      kits: { core: CORE_KIT },
      plugins: [emailPlugin()],
    }).html;
    const reversed = reverseEmail(html);
    expect(reversed).toContain('--- meta');
    expect(reversed).toContain('title: Test Email');
  });

  it('should extract text content from table cells', () => {
    const html = mkly('--- meta\nversion: 1\n\n--- core/text\n\nHello email world', {
      kits: { core: CORE_KIT },
      plugins: [emailPlugin()],
    }).html;
    const reversed = reverseEmail(html);
    expect(reversed).toContain('Hello email world');
  });

  it('should detect email origin for mkly email output', () => {
    const html = mkly('--- meta\nversion: 1\n\n--- core/text\n\nContent', {
      kits: { core: CORE_KIT },
      plugins: [emailPlugin()],
    }).html;
    expect(detectOrigin(html)).toBe('mkly-email');
  });

  it('should auto-detect email output via htmlToMkly', () => {
    const html = mkly('--- meta\nversion: 1\ntitle: Email\n\n--- core/text\n\nEmail content', {
      kits: { core: CORE_KIT },
      plugins: [emailPlugin()],
    }).html;
    const reversed = htmlToMkly(html);
    expect(reversed).toContain('Email content');
  });

  it('should handle email HTML with markdown-like content', () => {
    const html = mkly('--- meta\nversion: 1\n\n--- core/text\n\n**Bold** and *italic*', {
      kits: { core: CORE_KIT },
      plugins: [emailPlugin()],
    }).html;
    const reversed = reverseEmail(html);
    expect(reversed).toContain('Bold');
  });

  it('should produce non-empty output for minimal email', () => {
    const html = mkly('--- meta\nversion: 1\n\n--- core/text\n\nHi', {
      plugins: [emailPlugin()],
    }).html;
    const reversed = reverseEmail(html);
    expect(reversed.trim().length).toBeGreaterThan(0);
  });

  it('should handle email with heading content', () => {
    const html = mkly('--- meta\nversion: 1\n\n--- core/heading\nlevel: 1\n\nBig Title', {
      kits: { core: CORE_KIT },
      plugins: [emailPlugin()],
    }).html;
    const reversed = reverseEmail(html);
    expect(reversed).toContain('Big Title');
  });

  it('should handle subject in meta for title extraction', () => {
    const html = mkly('--- meta\nversion: 1\ntitle: Ignored\nsubject: Email Subject\n\n--- core/text\n\nContent', {
      plugins: [emailPlugin()],
    }).html;
    const reversed = reverseEmail(html);
    expect(reversed).toContain('subject: Email Subject');
  });
});
