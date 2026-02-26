export interface ParsedQuery {
    text: string;
    sizeValue?: number;
    sizeUnit?: string;
}

export function parseQuery(raw: string): ParsedQuery {
    const normalized = normalize(raw);

    const m = normalized.match(/(\d+(?:\.\d+)?)\s*(ml|l|g|kg)\b/);

    if (!m) {
        return { text: normalized };
    }

    const value = Number(m[1]);
    const unit = m[2];

    const text = normalized.replace(m[0], '').trim();

    return {
        text,
        sizeValue: value,
        sizeUnit: unit
    };
}

export function normalize(input: string): string {
    return String(input ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[-_/]/g, ' ')
        .replace(/,/g, '.')
        .replace(/\b(lts?|litros?)\b/g, 'l')
        .replace(/\b(ml|mililitros?)\b/g, 'ml')
        .replace(/\s+/g, ' ')
        .trim();
}
