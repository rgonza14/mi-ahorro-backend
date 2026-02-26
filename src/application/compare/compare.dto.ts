import type { Product } from '../../domain';
import type { RetailerId } from '../search/search.dto';

export type CompareItemResult = {
    retailer: RetailerId;
    products: Product[];
    error?: string;
};

export type CompareItemResponse = {
    query: string;
    limit: number;
    retailers: RetailerId[];
    results: CompareItemResult[];
};

export type CompareListRankingRow = {
    retailer: string;
    total: number;
    missingCount: number;
    missingItems: string[];
};

export type CompareListResponse = {
    items: string[];
    limit: number;
    retailers: string[];
    best: CompareListRankingRow | null;
    ranking: CompareListRankingRow[];
    detail: CompareItemResponse[];
};
