import type { Product, RetailerPort } from '../../domain';
import { isPersistedQueryNotFound } from '../vtex/vtex.types.js';
import { VtexGraphqlClient } from '../vtex/vtex-graphql-client.js';

export class VeaAdapter implements RetailerPort {
    readonly retailer = 'vea' as const;
    private readonly baseUrl = 'https://www.vea.com.ar';

    private readonly bindingId =
        process.env.VTEX_VEA_BINDING_ID ??
        '6890cd39-87c6-4689-ad4f-3b913f3c0b19';

    constructor(private readonly gql: VtexGraphqlClient) {}

    async search(term: string): Promise<Product[]> {
        const terms: string[] = this.buildSearchTerms(term);

        for (const t of terms) {
            const url = this.buildSearchUrl(t, 0, 20);

            const data = await this.gql.get(url);

            if (isPersistedQueryNotFound(data)) {
                throw new Error('PersistedQueryNotFound (hash expired)');
            }

            const raw =
                data?.data?.productSearchV3?.products ??
                data?.data?.productSearch?.products ??
                [];

            const mapped = this.mapProducts(raw);

            if (mapped.length > 0) {
                return mapped;
            }
        }

        return [];
    }

    private hash(): string {
        const h = process.env.VEA_VTEX_SHA256_HASH;

        if (!h) {
            throw new Error('Missing VTEX_VEA_SHA256_HASH');
        }

        return h;
    }

    private buildSearchUrl(query: string, from: number, to: number): string {
        const base = `${this.baseUrl}/_v/segment/graphql/v1`;

        const extVarsObj = {
            hideUnavailableItems: true,
            skusFilter: 'ALL',
            simulationBehavior: 'default',
            installmentCriteria: 'MAX_WITHOUT_INTEREST',
            productOriginVtex: false,
            map: 'ft',
            query,
            orderBy: 'OrderByScoreDESC',
            from,
            to,
            selectedFacets: [{ key: 'ft', value: query }],
            fullText: query,
            facetsBehavior: 'Static',
            categoryTreeBehavior: 'default',
            withFacets: false
        };

        const extVarsB64 = Buffer.from(
            JSON.stringify(extVarsObj),
            'utf8'
        ).toString('base64');

        const extensionsObj = {
            persistedQuery: {
                version: 1,
                sha256Hash: this.hash(),
                sender: 'vtex.store-resources@0.x',
                provider: 'vtex.search-graphql@0.x'
            },
            variables: extVarsB64
        };

        const params = new URLSearchParams({
            workspace: 'master',
            maxAge: 'short',
            appsEtag: 'remove',
            domain: 'store',
            locale: 'es-AR',
            __bindingId: this.bindingId,
            operationName: 'productSearchV3',
            variables: '{}',
            extensions: JSON.stringify(extensionsObj)
        });

        return `${base}?${params.toString()}`;
    }

    private normalizeForSearch(q: string): string {
        return String(q ?? '')
            .toLowerCase()
            .replace(/,/g, '.')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private buildSearchTerms(userQuery: string): string[] {
        const q = this.normalizeForSearch(userQuery);

        const terms: string[] = [];

        terms.push(q);

        const hasSize =
            /\d+(\.\d+)?\s*(ml|l|lts?|lt|litros?|mls?|mililitros?)/i.test(q);

        if (hasSize) {
            const withoutSize = q
                .replace(
                    /\d+(\.\d+)?\s*(ml|l|lts?|lt|litros?|mls?|mililitros?)/gi,
                    ''
                )
                .replace(/\s+/g, ' ')
                .trim();

            if (withoutSize && withoutSize !== q) {
                terms.push(withoutSize);
            }
        }

        const firstWord = q.split(' ')[0];
        if (firstWord && !terms.includes(firstWord)) {
            terms.push(firstWord);
        }

        return terms;
    }

    private mapProducts(products: any[]): Product[] {
        const out: Product[] = [];

        for (const p of products ?? []) {
            const item0 = p?.items?.[0];
            const img0 = item0?.images?.[0]?.imageUrl;
            const offer0 = item0?.sellers?.[0]?.commertialOffer;

            const available = offer0?.AvailableQuantity ?? 0;
            if (available <= 0) continue;

            const price =
                offer0?.Price != null
                    ? Number(offer0.Price)
                    : p?.priceRange?.sellingPrice?.lowPrice != null
                      ? Number(p.priceRange.sellingPrice.lowPrice)
                      : 0;

            if (!p?.productName || !price) continue;

            out.push({
                id: p?.productId ? String(p.productId) : undefined,
                name: String(p.productName),
                price,
                listPrice:
                    offer0?.ListPrice != null
                        ? Number(offer0.ListPrice)
                        : undefined,
                link: p?.linkText
                    ? `${this.baseUrl}/${p.linkText}/p`
                    : undefined,
                image: img0 ? String(img0) : undefined,
                retailer: this.retailer
            });
        }

        return out;
    }
}
