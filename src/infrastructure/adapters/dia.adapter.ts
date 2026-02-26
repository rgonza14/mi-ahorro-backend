import type { Product, RetailerPort } from '../../domain/';
import { HttpClient } from '../http/http-client.js';

export class DiaAdapter implements RetailerPort {
    readonly retailer = 'dia' as const;

    private readonly baseUrl = 'https://diaonline.supermercadosdia.com.ar';

    constructor(private readonly http: HttpClient) {}

    async search(term: string): Promise<Product[]> {
        const url = `${this.baseUrl}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(
            term
        )}&_from=0&_to=30`;

        const data = await this.http.get<any[]>(url);

        return this.mapProducts(data);
    }

    private mapProducts(products: any[]): Product[] {
        const out: Product[] = [];

        for (const p of products ?? []) {
            const item0 = p?.items?.[0];
            const seller0 = item0?.sellers?.[0];

            const price = seller0?.commertialOffer?.Price;

            if (!p?.productName || !price) continue;

            out.push({
                id: p?.productId,
                name: p?.productName,
                price: Number(price),
                listPrice:
                    seller0?.commertialOffer?.ListPrice != null
                        ? Number(seller0.commertialOffer.ListPrice)
                        : undefined,
                link: p?.link ? `${p.link}` : undefined,
                image: item0?.images?.[0]?.imageUrl,
                retailer: this.retailer
            });
        }

        return out;
    }
}
