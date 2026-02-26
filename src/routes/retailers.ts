import type { FastifyPluginAsync } from 'fastify';
import pLimit from 'p-limit';
import {
    RETAILERS,
    retailersItemSchema,
    retailersListSchema
} from './schemas/retailers.schema';

type Retailer = (typeof RETAILERS)[number];

type RetailersItemBody = {
    query: string;
    limit?: number;
    retailers?: Retailer[];
};

type RetailersListBody = {
    items: string[];
    limit?: number;
    retailers?: Retailer[];
};

function cleanItems(items: string[]) {
    return (items ?? []).map(x => x?.trim()).filter(Boolean) as string[];
}

const DEFAULT_RETAILERS: Retailer[] = ['carrefour', 'dia'];

const MAX_ITEMS = 60;
const MAX_COST = 340; // ej 60 itemsx4 retailers

function assertCost(items: string[], retailers: Retailer[]) {
    if (items.length > MAX_ITEMS) throw new Error(`Max items: ${MAX_ITEMS}`);
    const cost = items.length * retailers.length;
    if (cost > MAX_COST) throw new Error(`Too expensive (cost=${cost})`);
}

const retailers: FastifyPluginAsync = async fastify => {
    fastify.post<{ Body: RetailersItemBody }>(
        '/retailers/item',
        { schema: retailersItemSchema },
        async req => {
            const limit = req.body.limit ?? 15;
            const selectedRetailers = (
                req.body.retailers?.length
                    ? req.body.retailers
                    : DEFAULT_RETAILERS
            ) as Retailer[];

            const settled = await Promise.allSettled(
                selectedRetailers.map(r =>
                    fastify.services.search.byRetailer({
                        retailer: r,
                        query: req.body.query,
                        limit
                    })
                )
            );

            const results = settled.map((res, idx) => {
                const retailer = selectedRetailers[idx];

                if (res.status === 'fulfilled') {
                    const products = Array.isArray(res.value?.products)
                        ? res.value.products
                        : [];

                    return { retailer, products };
                }

                return {
                    retailer,
                    products: [],
                    error: 'RETAILER_FAILED' as const
                };
            });

            return {
                query: req.body.query,
                limit,
                retailers: selectedRetailers,
                results
            };
        }
    );

    fastify.post<{ Body: RetailersListBody }>(
        '/retailers/list',
        { schema: retailersListSchema },
        async req => {
            const limit = req.body.limit ?? 15;
            const selectedRetailers = (
                req.body.retailers?.length
                    ? req.body.retailers
                    : DEFAULT_RETAILERS
            ) as Retailer[];

            const items = cleanItems(req.body.items);

            assertCost(items, selectedRetailers);

            const itemLimiter = pLimit(3);

            const detail = await Promise.all(
                items.map(query =>
                    itemLimiter(async () => {
                        const settledRetailers = await Promise.allSettled(
                            selectedRetailers.map(r =>
                                fastify.services.search.byRetailer({
                                    retailer: r,
                                    query,
                                    limit
                                })
                            )
                        );

                        const perRetailer = settledRetailers.map((res, idx) => {
                            const retailer = selectedRetailers[idx];

                            if (res.status === 'fulfilled') {
                                const products = Array.isArray(
                                    res.value?.products
                                )
                                    ? res.value.products
                                    : [];

                                return { retailer, products };
                            }

                            return {
                                retailer,
                                products: [],
                                error: 'RETAILER_FAILED' as const
                            };
                        });

                        return { query, results: perRetailer };
                    })
                )
            );

            const totals: Record<string, number> = {};
            const missing: Record<string, string[]> = {};

            for (const r of selectedRetailers) {
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
                items,
                limit,
                retailers: selectedRetailers,
                best: ranking[0] ?? null,
                ranking,
                detail
            };
        }
    );
};

export default retailers;
