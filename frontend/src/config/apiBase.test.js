import { describe, expect, it } from 'vitest';
import { API_ORIGIN, DEV_API_ORIGIN, normalizeApiOrigin } from './apiBase';
import { resolveImageUrl } from '../api/api';

describe('resolveImageUrl', () => {
  it('prefixes backend-hosted paths with the backend origin, never the frontend domain', () => {
    expect(resolveImageUrl('/catalog-gems/ruby-oval.jpg')).toBe(`${API_ORIGIN}/catalog-gems/ruby-oval.jpg`);
    expect(resolveImageUrl('uploads/products/2/a.jpg')).toBe(`${API_ORIGIN}/uploads/products/2/a.jpg`);
  });

  it('keeps absolute, data and blob URLs unchanged', () => {
    expect(resolveImageUrl('https://cdn.example.test/a.jpg')).toBe('https://cdn.example.test/a.jpg');
    expect(resolveImageUrl('data:image/png;base64,AA')).toBe('data:image/png;base64,AA');
    expect(resolveImageUrl('blob:http://localhost/1')).toBe('blob:http://localhost/1');
    expect(resolveImageUrl(null)).toBeNull();
  });
});

describe('normalizeApiOrigin', () => {
  it('uses the configured backend origin as-is', () => {
    expect(normalizeApiOrigin('https://backend.example.test')).toBe('https://backend.example.test');
  });

  it('accepts the older value with a trailing /api or slash', () => {
    expect(normalizeApiOrigin('http://localhost:5113/api')).toBe('http://localhost:5113');
    expect(normalizeApiOrigin('https://example.test/api/')).toBe('https://example.test');
    expect(normalizeApiOrigin(' https://example.test/ ')).toBe('https://example.test');
  });

  it('uses the fallback only when no value is configured', () => {
    expect(normalizeApiOrigin(undefined, DEV_API_ORIGIN)).toBe(DEV_API_ORIGIN);
    expect(normalizeApiOrigin('', DEV_API_ORIGIN)).toBe(DEV_API_ORIGIN);
    expect(normalizeApiOrigin('https://example.test', DEV_API_ORIGIN)).toBe('https://example.test');
  });

  it('returns an empty origin (same-site) instead of localhost when there is no fallback', () => {
    expect(normalizeApiOrigin(undefined)).toBe('');
    expect(normalizeApiOrigin('   ')).toBe('');
  });
});
