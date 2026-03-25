'use strict';

const {
  sanitizePrompt,
  normalizeLanguage,
  buildLocalizedPrompt,
  buildImageUrl,
  buildDownloadName,
} = require('../services/mediaGenerationAgent');

describe('mediaGenerationAgent helpers', () => {
  test('normalizes prompt and language', () => {
    expect(sanitizePrompt('  hello   world  ')).toBe('hello world');
    expect(normalizeLanguage('HI')).toBe('hindi');
    expect(normalizeLanguage('both')).toBe('both');
    expect(normalizeLanguage('random')).toBe('english');
  });

  test('builds localized prompt variants', () => {
    expect(buildLocalizedPrompt('a cat', 'hindi')).toContain('Hindi');
    expect(buildLocalizedPrompt('a cat', 'english')).toContain('English');
    expect(buildLocalizedPrompt('a cat', 'both')).toContain('Bilingual');
  });

  test('creates image url and download filename', () => {
    const url = buildImageUrl('hello world', 42);
    expect(url).toContain('image.pollinations.ai');
    expect(url).toContain('seed=42');

    const name = buildDownloadName('image', 'english');
    expect(name.startsWith('image-english-')).toBe(true);
  });
});
