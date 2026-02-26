export type RetailerId = 'carrefour' | 'dia' | 'jumbo' | 'vea';

export type SearchByRetailerRequest = {
    retailer: RetailerId;
    query: string;
    limit?: number;
};

export type RetailersItemRequest = {
    query: string;
    limit?: number;
    retailers?: RetailerId[];
};

export type RetailersListRequest = {
    items: string[];
    limit?: number;
    retailers?: RetailerId[];
};
