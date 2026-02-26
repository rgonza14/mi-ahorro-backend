export type VtexGraphqlResponse = {
    data?: any;
    errors?: Array<{ message: string }>;
};

export function isPersistedQueryNotFound(x: any) {
    const msg = x?.errors?.[0]?.message ?? x?.data?.errors?.[0]?.message ?? '';
    return String(msg).includes('PersistedQueryNotFound');
}
