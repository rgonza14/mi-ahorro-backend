export type Retailer = 'carrefour' | 'dia' | 'jumbo' | 'farmacity' | 'vea';

export interface Product {
    id?: string;
    name: string;
    price: number;
    listPrice?: number;
    link?: string;
    image?: string;
    retailer: Retailer;
}
