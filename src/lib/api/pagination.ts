/**
 * Local stand-in for the shared pagination util (`@quikit/shared`:
 * parsePaginationParams / paginationToSkipTake / buildPaginationResponse).
 * Contract (handbook §6.11, frozen): defaults page=1, limit=20, max limit=100.
 * Swap for the `@quikit/shared` import once the monorepo packages are available.
 */
export type PaginationParams = { page: number; limit: number };

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

function toInt(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

export function parsePaginationParams(searchParams: URLSearchParams): PaginationParams {
  const page = toInt(searchParams.get('page'));
  const limit = toInt(searchParams.get('limit'));
  return {
    page: page !== null && page >= 1 ? page : DEFAULT_PAGE,
    limit: limit !== null && limit >= 1 ? Math.min(limit, MAX_LIMIT) : DEFAULT_LIMIT,
  };
}

export function paginationToSkipTake(params: PaginationParams): { skip: number; take: number } {
  return { skip: (params.page - 1) * params.limit, take: params.limit };
}

export function buildPaginationResponse<T>(items: T[], total: number, params: PaginationParams) {
  return {
    data: items,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
    },
  };
}
