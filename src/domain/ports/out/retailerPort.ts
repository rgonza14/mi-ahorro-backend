import { Product, Retailer } from '../../models/product';

export interface RetailerPort {
    readonly retailer: Retailer;
    search(query: string): Promise<Product[]>;
}
