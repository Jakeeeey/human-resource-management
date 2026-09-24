export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export const DEFAULT_PAGE_SIZE = 10;

export interface PageSlice<T> {
    pageItems: T[];
    page: number;
    totalPages: number;
    total: number;
    rangeStart: number;
    rangeEnd: number;
}

export function paginate<T>(items: readonly T[], page: number, pageSize: number): PageSlice<T> {
    const size = Number.isFinite(pageSize) && pageSize >= 1 ? Math.floor(pageSize) : DEFAULT_PAGE_SIZE;
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / size));
    const requested = Number.isFinite(page) ? Math.floor(page) : 1;
    const safePage = Math.min(Math.max(requested, 1), totalPages);
    const start = (safePage - 1) * size;
    const pageItems = items.slice(start, start + size);
    return {
        pageItems,
        page: safePage,
        totalPages,
        total,
        rangeStart: total === 0 ? 0 : start + 1,
        rangeEnd: total === 0 ? 0 : start + pageItems.length,
    };
}
