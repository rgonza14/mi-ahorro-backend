import pLimit from 'p-limit';
import type { Product, RetailerPort } from '../../domain';

export class LimitedRetailerAdapter implements RetailerPort {
    retailer: RetailerPort['retailer'];
    private readonly limiter: ReturnType<typeof pLimit>;

    constructor(
        private readonly inner: RetailerPort,
        concurrency: number
    ) {
        this.retailer = inner.retailer;
        this.limiter = pLimit(concurrency);
    }

    search(query: string): Promise<Product[]> {
        return this.limiter(() => this.inner.search(query));
    }
}
