import type { Product, RetailerPort } from '../../domain';
import { isPersistedQueryNotFound } from '../vtex/vtex.types.js';
import { VtexGraphqlClient } from '../vtex/vtex-graphql-client.js';
import { buildVtexSuggestionsUrl } from '../vtex/vtex-suggestions-url.js';

export class CarrefourAdapter implements RetailerPort {
    readonly retailer = 'carrefour' as const;
    private readonly baseUrl = 'https://www.carrefour.com.ar';

    constructor(private readonly gql: VtexGraphqlClient) {}
    async search(term: string): Promise<Product[]> {
        const terms: string[] = this.buildSearchTerms(term);
        for (const t of terms) {
            const url = buildVtexSuggestionsUrl({
                baseUrl: this.baseUrl,
                sha256Hash: this.hash(),
                fullText: t,
                count: 30
            });

            const data = await this.gql.get(url);

            if (isPersistedQueryNotFound(data)) {
                throw new Error('PersistedQueryNotFound (hash expired)');
            }

            const raw = data?.data?.productSuggestions?.products ?? [];
            const mapped = this.mapProducts(raw);

            if (mapped.length > 0) {
                return mapped;
            }
        }

        return [];
    }

    private hash(): string {
        const h = process.env.VTEX_SHA256_HASH;
        if (!h) {
            throw new Error('Missing VTEX_SHA256_HASH');
        }
        return h;
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
