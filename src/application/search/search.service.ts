import type {
    Product,
    ProductMatchingService,
    RetailerPort
} from '../../domain';
import type {
    RetailerId,
    RetailersItemRequest,
    SearchByRetailerRequest
} from './search.dto';
import { buildSearchTerms, safeFetch } from './search.utils';

type SearchResult = {
    query: string;
    retailer: RetailerId;
    count: number;
    products: Product[];
};

export class SearchService {
    constructor(
        private readonly retailers: RetailerPort[],
        private readonly matcher: ProductMatchingService
    ) {}

    private readonly cache = new Map<string, { ts: number; value: Product[] }>();
    private readonly inflight = new Map<string, Promise<Product[]>>();
    private readonly CACHE_TTL_MS = 60_000;
    private readonly CACHE_MAX = 500;

    getSupportedRetailers(): RetailerId[] {
        return this.retailers.map(r => r.retailer as RetailerId);
    }

    async byRetailer(req: SearchByRetailerRequest): Promise<SearchResult> {
        const originalQuery = req.query?.trim() ?? '';
        if (!originalQuery) {
            return {
                query: originalQuery,
                retailer: req.retailer,
                count: 0,
                products: []
            };
        }

        const r = this.retailers.find(x => x.retailer === req.retailer);
        if (!r) throw new Error(`Unknown retailer: ${req.retailer}`);

        const limit = req.limit ?? 15;

        const candidates = await this.fetchCandidatesWithFallback(
            originalQuery,
            term => r.search(term),
            String(r.retailer)
        );

        const normalized = originalQuery
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();

        const words = normalized.split(/\s+/).filter(Boolean);

        const isGenericSingleWord = words.length === 1 && words[0].length > 3;

        const products = isGenericSingleWord
            ? candidates.slice(0, limit)
            : this.matcher.match(originalQuery, candidates, limit);

        return {
            query: originalQuery,
            retailer: r.retailer as RetailerId,
            count: products.length,
            products
        };
    }

    async byRetailers(req: RetailersItemRequest) {
        const q = req.query?.trim() ?? '';
        const limit = req.limit ?? 15;

        const supported = this.getSupportedRetailers();
        const selected = this.pickRetailers(req.retailers, supported);

        const results = await Promise.all(
            selected.map(async retailer => {
                try {
                    const res = await this.byRetailer({
                        retailer,
                        query: q,
                        limit
                    });
                    return { retailer, products: res.products };
                } catch (e: any) {
                    return {
                        retailer,
                        products: [] as Product[],
                        error: String(e?.message ?? e)
                    };
                }
            })
        );

        return { query: q, limit, retailers: selected, results };
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

    private async fetchCandidatesWithFallback(
        query: string,
        fetcher: (term: string) => Promise<Product[]>,
        retailerKey: string
    ): Promise<Product[]> {
        const q = query.trim();
        if (!q) return [];

        const words = q.split(/\s+/).filter(Boolean);
        const isGeneric = words.length === 1 && words[0].length > 3;

        const all: Product[] = [];
        const seen = new Set<string>();

        const MAX_ITEMS = 120;

        const addProducts = (list: Product[]) => {
            for (const p of list) {
                const id = String((p as any)?.id ?? '');
                const name = String((p as any)?.name ?? '')
                    .toLowerCase()
                    .trim();
                const price = Number((p as any)?.price ?? 0);

                const key = id
                    ? `id:${id}|price:${price}`
                    : `name:${name}|price:${price}`;

                if (seen.has(key)) continue;
                seen.add(key);
                all.push(p);

                if (all.length >= MAX_ITEMS) break;
            }
        };

        if (isGeneric) {
            const res = await this.fetchCached(retailerKey, q, fetcher);
            addProducts(res);
            return all;
        }

        const terms = buildSearchTerms(q);
        const MAX_TERMS = 3;
        let used = 0;

        for (const term of terms) {
            const res = await this.fetchCached(retailerKey, term, fetcher);
            addProducts(res);

            if (res.length) used++;
            if (used >= MAX_TERMS || all.length >= MAX_ITEMS) break;
        }

        return all;
    }

    private async fetchCached(
        retailerKey: string,
        term: string,
        fetcher: (t: string) => Promise<Product[]>
    ): Promise<Product[]> {
        const key = `${retailerKey}::${term}`;
        const now = Date.now();
        const hit = this.cache.get(key);
        if (hit && now - hit.ts <= this.CACHE_TTL_MS) return hit.value;

        const inF = this.inflight.get(key);
        if (inF) return inF;

        const p = (async () => {
            const res = await safeFetch(fetcher, term);
            this.inflight.delete(key);
            this.cache.set(key, { ts: now, value: res });
            if (this.cache.size > this.CACHE_MAX) {
                const oldestKey = this.cache.keys().next().value as string | undefined;
                if (oldestKey) this.cache.delete(oldestKey);
            }
            return res;
        })();

        this.inflight.set(key, p);
        return p;
    }
}
