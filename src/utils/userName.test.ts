import { describe, expect, it } from 'vitest';
import { capitalizeFirstLetter } from './userName';

describe('capitalizeFirstLetter', () => {
  it('capitalizes a lowercase name', () => {
    expect(capitalizeFirstLetter('kaushal')).toBe('Kaushal');
  });

  it('lowercases the remainder of an all-caps name', () => {
    expect(capitalizeFirstLetter('KAUSHAL')).toBe('Kaushal');
  });

  it('normalizes mixed-case input', () => {
    expect(capitalizeFirstLetter('kAuShAl')).toBe('Kaushal');
  });

  it('trims surrounding whitespace', () => {
    expect(capitalizeFirstLetter('  kaushal  ')).toBe('Kaushal');
  });

  it('returns an empty string for empty or whitespace-only input', () => {
    expect(capitalizeFirstLetter('')).toBe('');
    expect(capitalizeFirstLetter('   ')).toBe('');
  });
});
