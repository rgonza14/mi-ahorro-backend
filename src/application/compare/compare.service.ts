import pLimit from 'p-limit';
import type { SearchService } from '../search/search.service';
import type { RetailerId } from '../search/search.dto';
import type { CompareItemResponse, CompareListResponse } from './compare.dto';
import { cleanItems } from '../search/search.utils';

export class CompareService {
    constructor(private readonly search: SearchService) {}

    async compareItem(
        query: string,
        retailers?: RetailerId[],
        limit = 15
    ): Promise<CompareItemResponse> {
        const q = query?.trim() ?? '';
        const supported = this.search.getSupportedRetailers();
        const selected = this.pickRetailers(retailers, supported);

        if (!q) {
            return {
                query: q,
                limit,
                retailers: selected,
                results: selected.map(r => ({ retailer: r, products: [] }))
            };
        }

        const limiter = pLimit(3);

        const results = await Promise.all(
            selected.map(retailer =>
                limiter(async () => {
                    try {
                        const res = await this.search.byRetailer({
                            retailer,
                            query: q,
                            limit
                        });
                        return { retailer, products: res.products };
                    } catch (e: any) {
                        return {
                            retailer,
                            products: [],
                            error: String(e?.message ?? e)
                        };
                    }
                })
            )
        );

        return { query: q, limit, retailers: selected, results };
    }

    async compareList(
        items: string[],
        retailers?: RetailerId[],
        limit = 15
    ): Promise<CompareListResponse> {
        const clean = cleanItems(items);
        const supported = this.search.getSupportedRetailers();
        const selected = this.pickRetailers(retailers, supported);

        if (!clean.length) {
            return {
                items: [],
                limit,
                retailers: selected,
                best: null,
                ranking: [],
                detail: []
            };
        }

        const limiter = pLimit(3);

        const detail = await Promise.all(
            clean.map(q => limiter(() => this.compareItem(q, selected, limit)))
        );

        const totals: Record<string, number> = {};
        const missing: Record<string, string[]> = {};

        for (const r of selected) {
            totals[r] = 0;
            missing[r] = [];
        }

        for (const item of detail) {
            for (const res of item.results) {
                const best = res.products?.[0];
                totals[res.retailer] =
                    (totals[res.retailer] ?? 0) + (best?.price ?? 0);
                if (!best) (missing[res.retailer] ??= []).push(item.query);
            }
        }

        const ranking = Object.entries(totals)
            .map(([retailer, total]) => ({
                retailer,
                total,
                missingCount: (missing[retailer] ?? []).length,
                missingItems: missing[retailer] ?? []
            }))
            .sort((a, b) => a.total - b.total);

        return {
            items: clean,
            limit,
            retailers: selected,
            best: ranking[0] ?? null,
            ranking,
            detail
        };
    }

    private pickRetailers(
        retailers: RetailerId[] | undefined,
        supported: RetailerId[]
    ) {
        if (!retailers?.length) return supported;
        const set = new Set(retailers);
        const filtered = supported.filter(r => set.has(r));
        return filtered.length ? filtered : supported;
    }
}
