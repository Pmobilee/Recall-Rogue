import { describe, it, expect } from 'vitest';
import { interleaveFacts } from './interleaveFacts';

describe('interleaveFacts', () => {
  it('round-robins equal-length arrays', () => {
    const result = interleaveFacts([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
    expect(result).toEqual([1, 4, 7, 2, 5, 8, 3, 6, 9]);
  });

  it('handles unequal-length arrays — shorter array exhausts first', () => {
    const result = interleaveFacts([['a', 'b', 'c', 'd'], ['x', 'y']]);
    expect(result).toEqual(['a', 'x', 'b', 'y', 'c', 'd']);
  });

  it('passes through a single array unchanged', () => {
    const result = interleaveFacts([[1, 2, 3]]);
    expect(result).toEqual([1, 2, 3]);
  });

  it('skips empty arrays, returns elements from non-empty arrays', () => {
    const result = interleaveFacts([[], [1, 2], []]);
    expect(result).toEqual([1, 2]);
  });

  it('returns empty array when all inputs are empty', () => {
    const result = interleaveFacts([[], []]);
    expect(result).toEqual([]);
  });

  it('three unequal arrays — shorter arrays exhaust proportionally', () => {
    const result = interleaveFacts([['a', 'b', 'c'], ['x'], ['1', '2']]);
    expect(result).toEqual(['a', 'x', '1', 'b', '2', 'c']);
  });
});
