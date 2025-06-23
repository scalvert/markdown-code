import { describe, it, expect } from 'vitest';
import { ensureTrailingNewline } from '../src/sync.js';

describe('ensureTrailingNewline', () => {
  it('adds newline to content without trailing newline', () => {
    const content = 'console.log("hello")';
    const result = ensureTrailingNewline(content);
    expect(result).toBe('console.log("hello")\n');
  });

  it('does not add newline to content with LF ending', () => {
    const content = 'console.log("hello")\n';
    const result = ensureTrailingNewline(content);
    expect(result).toBe('console.log("hello")\n');
  });

  it('does not add newline to content with CRLF ending', () => {
    const content = 'console.log("hello")\r\n';
    const result = ensureTrailingNewline(content);
    expect(result).toBe('console.log("hello")\r\n');
    
    // Verify it ends with newline
    expect(result.endsWith('\n')).toBe(true);
    
    // Verify no double newline was added
    expect(result).not.toBe('console.log("hello")\r\n\n');
  });

  it('handles empty string', () => {
    const content = '';
    const result = ensureTrailingNewline(content);
    expect(result).toBe('\n');
  });

  it('handles content with only CRLF', () => {
    const content = '\r\n';
    const result = ensureTrailingNewline(content);
    expect(result).toBe('\r\n');
    expect(result.endsWith('\n')).toBe(true);
  });

  it('handles content with mixed line endings', () => {
    const content = 'line1\nline2\r\nline3\r\n';
    const result = ensureTrailingNewline(content);
    expect(result).toBe('line1\nline2\r\nline3\r\n');
    expect(result.endsWith('\n')).toBe(true);
  });
}); 