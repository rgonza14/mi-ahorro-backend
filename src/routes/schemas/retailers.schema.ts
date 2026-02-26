export const RETAILERS = ['carrefour', 'dia', 'jumbo', 'vea'] as const;

export const retailersItemSchema = {
    tags: ['retailers'],
    summary: 'Buscar un producto en uno o más retailers',
    body: {
        type: 'object',
        required: ['query'],
        properties: {
            query: { type: 'string', minLength: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 15 },
            retailers: {
                type: 'array',
                items: { type: 'string', enum: [...RETAILERS] }
            }
        }
    },
    response: {
        200: {
            type: 'object',
            required: ['query', 'limit', 'retailers', 'results'],
            properties: {
                query: { type: 'string' },
                limit: { type: 'integer' },
                retailers: {
                    type: 'array',
                    items: { type: 'string', enum: [...RETAILERS] }
                },
                results: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['retailer', 'products'],
                        properties: {
                            retailer: { type: 'string', enum: [...RETAILERS] },
                            products: {
                                type: 'array',
                                items: { $ref: 'Product#' }
                            },
                            error: { type: 'string' }
                        }
                    }
                }
            }
        }
    }
} as const;

export const retailersListSchema = {
    tags: ['retailers'],
    summary: 'Comparar una lista de compras en uno o más retailers',
    body: {
        type: 'object',
        required: ['items'],
        properties: {
            items: {
                type: 'array',
                items: { type: 'string', minLength: 1 },
                minItems: 1,
                maxItems: 60
            },
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 15 },
            retailers: {
                type: 'array',
                items: { type: 'string', enum: [...RETAILERS] }
            }
        }
    },
    response: {
        200: {
            type: 'object',
            required: [
                'items',
                'limit',
                'retailers',
                'best',
                'ranking',
                'detail'
            ],
            properties: {
                items: { type: 'array', items: { type: 'string' } },
                limit: { type: 'integer' },
                retailers: {
                    type: 'array',
                    items: { type: 'string', enum: [...RETAILERS] }
                },
                best: {
                    anyOf: [
                        { type: 'null' },
                        {
                            type: 'object',
                            required: [
                                'retailer',
                                'total',
                                'missingCount',
                                'missingItems'
                            ],
                            properties: {
                                retailer: {
                                    type: 'string',
                                    enum: [...RETAILERS]
                                },
                                total: { type: 'number' },
                                missingCount: { type: 'integer' },
                                missingItems: {
                                    type: 'array',
                                    items: { type: 'string' }
                                }
                            }
                        }
                    ]
                },
                ranking: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: [
                            'retailer',
                            'total',
                            'missingCount',
                            'missingItems'
                        ],
                        properties: {
                            retailer: { type: 'string', enum: [...RETAILERS] },
                            total: { type: 'number' },
                            missingCount: { type: 'integer' },
                            missingItems: {
                                type: 'array',
                                items: { type: 'string' }
                            }
                        }
                    }
                },
                detail: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['query', 'results'],
                        properties: {
                            query: { type: 'string' },
                            results: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    required: ['retailer', 'products'],
                                    properties: {
                                        retailer: {
                                            type: 'string',
                                            enum: [...RETAILERS]
                                        },
                                        products: {
                                            type: 'array',
                                            items: { $ref: 'Product#' }
                                        },
                                        error: { type: 'string' }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
} as const;
