// Small helpers in src/env.ts.

import { describe, expect, it } from 'vitest';
import { trimUrl } from '../src/env';

describe('trimUrl', () => {
  it('removes trailing slashes only', () => {
    expect(trimUrl('https://example.test///')).toBe('https://example.test');
    expect(trimUrl('https://example.test/a/b')).toBe('https://example.test/a/b');
    expect(trimUrl('///')).toBe('');
  });
});
