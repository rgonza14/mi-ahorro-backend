import type { Product } from '../../domain';

export function normalizeQuery(q: string): string {
    return String(q ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/,/g, '.')
        .replace(/[-_/]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function firstWord(s: string): string {
    return (normalizeQuery(s).split(/\s+/)[0] ?? '').trim();
}

const UNIT_WORDS =
    '(?:l|lt|lts|litro|litros|ml|mls|mililitro|mililitros|g|gr|gramo|gramos|kg|kilo|kilos)';

export function removeSizeToken(input: string): string {
    const s = normalizeQuery(input);

    return s
        .replace(
            new RegExp(`\\b\\d+(?:\\.\\d+)?\\s*${UNIT_WORDS}\\b`, 'gi'),
            ' '
        )
        .replace(/\s+/g, ' ')
        .trim();
}

export function stripNumbers(input: string): string {
    const s = normalizeQuery(input);

    return s
        .replace(/\b\d+(\.\d+)?\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function hasLooseNumber(input: string): boolean {
    const s = normalizeQuery(input);
    return /\b\d+(\.\d+)?\b/.test(s);
}

function stripUnitWordsOnly(input: string): string {
    const s = normalizeQuery(input);

    return s
        .replace(new RegExp(`\\b${UNIT_WORDS}\\b`, 'gi'), ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function removeOnlyUnitAfterNumber(input: string): string {
    const s = normalizeQuery(input);

    return s
        .replace(
            new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*${UNIT_WORDS}\\b`, 'gi'),
            ' $1 '
        )
        .replace(/\s+/g, ' ')
        .trim();
}

export async function safeFetch(
    fetcher: (term: string) => Promise<Product[]>,
    term: string
): Promise<Product[]> {
    try {
        const res = await fetcher(term);
        return res ?? [];
    } catch {
        return [];
    }
}

export function cleanItems(items: string[]): string[] {
    return (items ?? []).map(x => x?.trim()).filter(Boolean) as string[];
}

export function buildSearchTerms(input: string): string[] {
    const base = normalizeQuery(input);
    if (!base) return [];

    const set = new Set<string>();
    const add = (x: string) => {
        const t = normalizeQuery(x);
        if (t) set.add(t);
    };

    add(base);

    add(removeOnlyUnitAfterNumber(base));

    const withoutSize = removeSizeToken(base);
    if (withoutSize && withoutSize !== base) add(withoutSize);

    const withoutUnitsOnly = stripUnitWordsOnly(base);
    if (withoutUnitsOnly && withoutUnitsOnly !== base) add(withoutUnitsOnly);

    const withoutNumber = stripNumbers(withoutSize || base);
    if (withoutNumber && withoutNumber !== base) add(withoutNumber);

    const first = firstWord(withoutUnitsOnly || withoutSize || base);
    if (first && first !== base) add(first);

    return Array.from(set);
}
