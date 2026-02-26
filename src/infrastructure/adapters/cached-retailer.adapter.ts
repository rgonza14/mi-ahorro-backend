import { LRUCache } from 'lru-cache';
import { Product, Retailer, RetailerPort } from '../../domain';

type CacheKey = string;

function normQuery(q: string) {
    return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

function makeKey(retailer: Retailer, query: string): CacheKey {
    return `retailer:${retailer}|q=${normQuery(query)}`;
}

export class CachedRetailerAdapter implements RetailerPort {
    readonly retailer: Retailer;

    private cache: LRUCache<CacheKey, Product[]>;
    private inFlight = new Map<CacheKey, Promise<Product[]>>();
    private readonly negativeTtlMs: number;

    constructor(
        private readonly inner: RetailerPort,
        opts?: {
            ttlMs?: number;
            maxEntries?: number;
            negativeTtlMs?: number;
        }
    ) {
        this.retailer = inner.retailer;

        this.cache = new LRUCache<CacheKey, Product[]>({
            max: opts?.maxEntries ?? 2000,
            ttl: opts?.ttlMs ?? 10 * 60 * 1000
        });

        this.negativeTtlMs = opts?.negativeTtlMs ?? 90 * 1000;
    }

    async search(query: string): Promise<Product[]> {
        const key = makeKey(this.retailer, query);

        const hit = this.cache.get(key);

        if (hit !== undefined) return hit;

        const inflight = this.inFlight.get(key);
        if (inflight) return await inflight;

        const p = (async () => {
            try {
                const res = await this.inner.search(query);

                if (res.length === 0) {
                    this.cache.set(key, res, { ttl: this.negativeTtlMs });
                    return res;
                }

                this.cache.set(key, res);
                return res;
            } finally {
                this.inFlight.delete(key);
            }
        })();

        this.inFlight.set(key, p);
        return await p;
    }
}
