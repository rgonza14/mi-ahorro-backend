import type { Product, RetailerPort } from '../../domain';
import { HttpClient } from '../http/http-client';

type JumboResponseProduct = {
    productId: string;
    productName: string;
    link: string;
    ProductData?: string[];

    items?: Array<{
        images?: Array<{ imageUrl: string }>;
        sellers?: Array<{
            commertialOffer?: {
                Price?: number;
                ListPrice?: number;
                PriceWithoutDiscount?: number;
                AvailableQuantity?: number;
                IsAvailable?: boolean;
            };
        }>;
    }>;
};

export class JumboAdapter implements RetailerPort {
    readonly retailer = 'jumbo' as const;

    private readonly baseUrl = 'https://www.jumbo.com.ar';

    constructor(private readonly http: HttpClient) {}

    async search(term: string): Promise<Product[]> {
        const url = `${this.baseUrl}/api/catalog_system/pub/products/search/?ft=${encodeURIComponent(
            term
        )}`;

        const data = await this.http.get<JumboResponseProduct[]>(url);
        return this.mapProducts(data);
    }

    private mapProducts(products: JumboResponseProduct[]): Product[] {
        const out: Product[] = [];

        for (const p of products ?? []) {
            if (!p?.ProductData?.length) continue;

            const item0 = p?.items?.[0];
            const img0 = item0?.images?.[0]?.imageUrl;

            const offer0 = item0?.sellers?.[0]?.commertialOffer;
            const price = offer0?.Price;

            const isAvailable = offer0?.IsAvailable === true;
            const quantity = offer0?.AvailableQuantity ?? 0;

            if (!isAvailable || quantity <= 0) continue;

            if (!p.productName || price == null) continue;

            out.push({
                id: p.productId ? String(p.productId) : undefined,
                name: String(p.productName),
                price: Number(price),
                listPrice:
                    offer0?.ListPrice != null
                        ? Number(offer0.ListPrice)
                        : undefined,
                link: p.link ? `${p.link}` : undefined,
                image: img0 ? String(img0) : undefined,
                retailer: this.retailer
            });
        }

        return out;
    }
}
