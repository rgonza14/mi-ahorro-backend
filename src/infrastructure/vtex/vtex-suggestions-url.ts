import { Buffer } from 'node:buffer';

type SuggestionsVars = {
    productOriginVtex: boolean;
    simulationBehavior: 'default';
    hideUnavailableItems: boolean;
    fullText: string;
    count: number;
    shippingOptions: string[];
    variant: null;
};

function b64json(obj: any) {
    return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64');
}

export function buildVtexSuggestionsUrl(params: {
    baseUrl: string;
    sha256Hash: string;
    fullText: string;
    count?: number;
    locale?: string;
    maxAge?: 'short' | 'medium' | 'long';
}) {
    const {
        baseUrl,
        sha256Hash,
        fullText,
        count = 8,
        locale = 'es-AR',
        maxAge = 'medium'
    } = params;

    const variablesObj: SuggestionsVars = {
        productOriginVtex: true,
        simulationBehavior: 'default',
        hideUnavailableItems: true,
        fullText,
        count,
        shippingOptions: [],
        variant: null
    };

    const extensionsObj = {
        persistedQuery: {
            version: 1,
            sha256Hash,
            sender: 'vtex.store-resources@0.x',
            provider: 'vtex.search-graphql@0.x'
        },
        variables: b64json(variablesObj)
    };

    const u = new URL(`${baseUrl}/_v/segment/graphql/v1/`);
    u.searchParams.set('workspace', 'master');
    u.searchParams.set('maxAge', maxAge);
    u.searchParams.set('appsEtag', 'remove');
    u.searchParams.set('domain', 'store');
    u.searchParams.set('locale', locale);

    u.searchParams.set('operationName', 'productSuggestions');
    u.searchParams.set('variables', '{}');
    u.searchParams.set('extensions', JSON.stringify(extensionsObj));

    return u.toString();
}
