import { describe, it, expect } from 'vitest';
import { buildPaginationResponse, paginationToSkipTake, parsePaginationParams } from '@/lib/api/pagination';

const sp = (q: string) => new URLSearchParams(q);

describe('pagination', () => {
  it('defaults to page 1, limit 20', () => {
    expect(parsePaginationParams(sp(''))).toEqual({ page: 1, limit: 20 });
  });

  it('clamps limit to 100 and rejects non-positive / non-integer values', () => {
    expect(parsePaginationParams(sp('limit=500')).limit).toBe(100);
    expect(parsePaginationParams(sp('limit=0')).limit).toBe(20);
    expect(parsePaginationParams(sp('page=-3&limit=abc'))).toEqual({ page: 1, limit: 20 });
    expect(parsePaginationParams(sp('page=1.5')).page).toBe(1);
  });

  it('computes skip/take', () => {
    expect(paginationToSkipTake({ page: 3, limit: 20 })).toEqual({ skip: 40, take: 20 });
  });

  it('builds the frozen response shape', () => {
    expect(buildPaginationResponse(['a'], 137, { page: 1, limit: 20 })).toEqual({
      data: ['a'],
      pagination: { page: 1, limit: 20, total: 137, totalPages: 7 },
    });
    expect(buildPaginationResponse([], 0, { page: 1, limit: 20 }).pagination.totalPages).toBe(0);
  });
});
