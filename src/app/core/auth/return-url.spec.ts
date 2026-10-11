import { describe, expect, it } from 'vitest';
import { safeReturnUrl } from './return-url';

describe('safeReturnUrl', () => {
  it('keeps a path of this application, with its query', () => {
    expect(safeReturnUrl('/t/acme/areas/x?y=1')).toBe('/t/acme/areas/x?y=1');
  });

  it.each([
    ['a protocol-relative url', '//evil.example/x'],
    ['a backslash path', '/\\evil.example'],
    ['an absolute url', 'https://evil.example'],
    ['null', null],
    ['an empty value', ''],
    ['a tab', '/\t/evil.example'],
    ['a line feed', '/a\nb'],
    ['a carriage return', '/a\rb'],
  ])('rejects %s', (_name, value) => {
    expect(safeReturnUrl(value)).toBeNull();
  });
});