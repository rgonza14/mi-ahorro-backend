import { Product } from '../models/product';
import { fuzzy } from 'fast-fuzzy';

type Canonical = {
    core: string;
    volumeL: number | null;
    weightKg: number | null;
    wantsCombo: boolean;
    wantsZero: boolean;
};

export class ProductMatchingService {
    match(query: string, products: Product[], limit = 15): Product[] {
        if (!products.length) return [];

        const q = this.canonicalize(query);

        let pool = products;

        if (!q.wantsCombo) {
            pool = pool.filter(p => !this.isComboName(String(p.name ?? '')));
        }

        if (!q.wantsZero) {
            pool = pool.filter(p => !this.isZeroName(String(p.name ?? '')));
        }

        pool = this.applyTokenGate(pool, q);

        if (q.volumeL != null) {
            const qL = q.volumeL;
            const tol = this.volumeToleranceLiters(qL);
            const min = qL - tol;
            const max = qL + tol;

            const withVol = pool.filter(
                p => this.canonicalize(String(p.name ?? '')).volumeL != null
            );

            if (withVol.length) {
                const filtered = withVol.filter(p => {
                    const pL = this.canonicalize(String(p.name ?? '')).volumeL!;
                    return pL >= min && pL <= max;
                });

                pool = filtered.length ? filtered : withVol;
            }
        } else if (q.weightKg != null) {
            const qKg = q.weightKg;
            const tol = this.weightToleranceKg(qKg);
            const min = qKg - tol;
            const max = qKg + tol;

            const withW = pool.filter(
                p => this.canonicalize(String(p.name ?? '')).weightKg != null
            );

            if (withW.length) {
                const filtered = withW.filter(p => {
                    const pKg = this.canonicalize(
                        String(p.name ?? '')
                    ).weightKg!;
                    return pKg >= min && pKg <= max;
                });

                pool = filtered.length ? filtered : withW;
            }
        }

        return this.rank(pool, q, limit);
    }

    private applyTokenGate(products: Product[], q: Canonical): Product[] {
        const tokens = (q.core || '')
            .split(/\s+/)
            .map(t => t.trim())
            .filter(Boolean);

        if (tokens.length < 2) return products;

        return products.filter(p => {
            const name = this.baseNormalize(String(p.name ?? ''));
            return tokens.every(t => this.hasWord(name, t));
        });
    }

    private hasWord(text: string, token: string): boolean {
        const t = this.baseNormalize(token);
        if (!t) return false;
        const re = new RegExp(`\\b${this.escapeRegExp(t)}\\b`, 'i');
        return re.test(text);
    }

    private escapeRegExp(s: string): string {
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    private volumeToleranceLiters(qL: number): number {
        if (qL < 0.2) return Math.max(0.01, qL * 0.12);
        if (qL < 1) return Math.max(0.05, qL * 0.12);
        if (qL < 2) return Math.max(0.12, qL * 0.1);
        return Math.max(0.25, qL * 0.12);
    }

    private weightToleranceKg(qKg: number): number {
        if (qKg < 0.5) return Math.max(0.02, qKg * 0.1);
        if (qKg < 2) return Math.max(0.05, qKg * 0.07);
        return Math.max(0.08, qKg * 0.06);
    }

    private canonicalize(input: string): Canonical {
        const raw = this.normalizeUnits(input);

        const wantsCombo =
            /\+/.test(raw) ||
            /\b(pack|combo|multipack|promo|oferta)\b/.test(raw);

        const wantsZero = this.wantsZero(raw);

        const volumeL = this.extractVolumeLiters(raw);
        const weightKg = this.extractWeightKg(raw);

        const cleanedText = this.stripUnitsEverywhere(raw)
            .replace(/\b\d+(\.\d+)?\b/g, ' ')
            .replace(/[^\p{L}\p{N}\s\+]/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const stop = new Set([
            'gaseosa',
            'bebida',
            'jugo',
            'agua',
            'vino',
            'cerveza',
            'sabor',
            'original',
            'pack',
            'combo',
            'multipack',
            'promo',
            'oferta',
            'zero',
            'light',
            'liviana',
            'liviano',
            'diet',
            'sin',
            'azucar',
            'azúcar',
            'sugar',
            'no',
            'unidad',
            'unidades',
            'un',
            'u',
            'ud',
            'uds',
            'x'
        ]);

        let core = cleanedText
            .split(' ')
            .filter(Boolean)
            .filter(t => !stop.has(t))
            .join(' ')
            .trim();

        if (!core) core = cleanedText;

        return { core, volumeL, weightKg, wantsCombo, wantsZero };
    }

    private baseNormalize(input: string): string {
        return String(input ?? '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/,/g, '.')
            .replace(/[-_/]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private normalizeUnits(text: string): string {
        let t = this.baseNormalize(text);

        t = t.replace(/cm³/g, 'cm3');
        t = t.replace(/\b(c\.?\s*c\.?)\b/g, 'cc');

        t = t.replace(/\b(mililitro|mililitros|mls)\b/g, 'ml');
        t = t.replace(/\b(lts|litro|litros)\b/g, 'l');
        t = t.replace(/\b(lt)\b/g, 'l');

        t = t.replace(/\b(kilos?|kilogramos?)\b/g, 'kg');
        t = t.replace(/\b(gramos?)\b/g, 'g');

        t = t.replace(/(\d+(?:\.\d+)?)\s*(cm3|cc)\b/g, '$1 ml');
        t = t.replace(/(\d+(?:\.\d+)?)\s*ml\b/g, '$1 ml');
        t = t.replace(/(\d+(?:\.\d+)?)\s*l\b/g, '$1 l');

        t = t.replace(/(\d+(?:\.\d+)?)\s*kg\b/g, '$1 kg');
        t = t.replace(/(\d+(?:\.\d+)?)\s*g\b/g, '$1 g');

        t = t.replace(/\s+/g, ' ').trim();
        return t;
    }

    private stripUnitsEverywhere(text: string): string {
        let t = this.normalizeUnits(text);

        t = t.replace(/\bml\b/gi, ' ');
        t = t.replace(/\bl\b/gi, ' ');
        t = t.replace(/\bkg\b/gi, ' ');
        t = t.replace(/\bg\b/gi, ' ');

        t = t.replace(/\b(\d+(?:\.\d+)?)\s*ml\b/gi, ' $1 ');
        t = t.replace(/\b(\d+(?:\.\d+)?)\s*l\b/gi, ' $1 ');
        t = t.replace(/\b(\d+(?:\.\d+)?)\s*kg\b/gi, ' $1 ');
        t = t.replace(/\b(\d+(?:\.\d+)?)\s*g\b/gi, ' $1 ');

        return t.replace(/\s+/g, ' ').trim();
    }

    private wantsZero(text: string): boolean {
        return (
            /\b(zero|light|liviana|diet|liviano)\b/.test(text) ||
            /\b(sin)\s*(azucar|azúcar)\b/.test(text) ||
            /\b(no)\s*(sugar)\b/.test(text)
        );
    }

    private isZeroName(name: string): boolean {
        const t = this.normalizeUnits(name);
        return (
            /\b(zero|light|liviana|diet|liviano)\b/.test(t) ||
            /\b(sin)\s*(azucar|azúcar)\b/.test(t) ||
            /\b(no)\s*(sugar)\b/.test(t)
        );
    }

    private isComboName(name: string): boolean {
        const t = this.normalizeUnits(name);
        return (
            /\+/.test(t) ||
            /\b(pack|combo|multipack|promo|oferta)\b/i.test(t) ||
            /\b(\d+)\s*(u|uds|unidades)\b/i.test(t) ||
            /\b\d+\s*x\s*\d+\b/i.test(t) ||
            /\bx\s*\d+\b/i.test(t) ||
            /\b(lleva|llevas|llevate)\s*\d+\b/i.test(t)
        );
    }

    private extractVolumeLiters(text: string): number | null {
        const t = this.normalizeUnits(text);

        const m = t.match(/\b(\d+(?:\.\d+)?)\s*(ml|l|lt|lts)\b/i);
        if (!m) return null;

        const v = Number(m[1]);
        if (!Number.isFinite(v)) return null;

        const unit = String(m[2]).toLowerCase();
        const liters = unit === 'ml' ? v / 1000 : v;

        if (liters >= 0.02 && liters <= 10) return this.round3(liters);
        return null;
    }

    private extractWeightKg(text: string): number | null {
        const t = this.normalizeUnits(text);

        const m = t.match(/\b(\d+(?:\.\d+)?)\s*(g|kg)\b/i);
        if (!m) return null;

        const v = Number(m[1]);
        if (!Number.isFinite(v)) return null;

        const unit = String(m[2]).toLowerCase();
        const kg = unit === 'g' ? v / 1000 : v;

        if (kg >= 0.01 && kg <= 50) return this.round3(kg);
        return null;
    }

    private round3(n: number): number {
        return Math.round(n * 1000) / 1000;
    }

    private volumeClosenessScore(qL: number | null, pL: number | null): number {
        if (qL == null || pL == null) return 0;

        const diff = Math.abs(pL - qL);

        if (qL < 1) {
            if (diff <= 0.015) return 0.55;
            if (diff <= 0.03) return 0.4;
            if (diff <= 0.06) return 0.15;
            if (diff <= 0.12) return -0.2;
            return -0.7;
        }

        if (diff <= 0.05) return 0.45;
        if (diff <= 0.1) return 0.3;
        if (diff <= 0.2) return 0.1;

        if (diff <= 0.35) return -0.2;
        if (diff <= 0.5) return -0.45;
        return -0.7;
    }

    private weightClosenessScore(
        qKg: number | null,
        pKg: number | null
    ): number {
        if (qKg == null || pKg == null) return 0;

        const diff = Math.abs(pKg - qKg);

        if (qKg < 0.5) {
            if (diff <= 0.01) return 0.55;
            if (diff <= 0.02) return 0.4;
            if (diff <= 0.05) return 0.15;
            if (diff <= 0.1) return -0.2;
            return -0.7;
        }

        if (diff <= 0.05) return 0.45;
        if (diff <= 0.1) return 0.3;
        if (diff <= 0.25) return 0.1;

        if (diff <= 0.4) return -0.2;
        if (diff <= 0.6) return -0.45;
        return -0.7;
    }

    private comboPenalty(q: Canonical, name: string): number {
        if (q.wantsCombo) return 0;
        const t = this.normalizeUnits(name);
        const hasPlus = /\+/.test(t);
        const hasCombo =
            /\b(pack|combo|multipack|promo|oferta)\b/i.test(t) ||
            /\b\d+\s*x\s*\d+\b/i.test(t) ||
            /\bx\s*\d+\b/i.test(t);
        return (hasPlus ? 0.55 : 0) + (hasCombo ? 0.45 : 0);
    }

    private zeroPenalty(q: Canonical, name: string): number {
        if (q.wantsZero) return 0;
        return this.isZeroName(name) ? 0.6 : 0;
    }

    private rank(products: Product[], q: Canonical, limit: number): Product[] {
        const MIN_CORE_WITH_SIZE = 0.45;

        const hasQueryVolume = q.volumeL != null;
        const hasQueryWeight = q.weightKg != null;
        const hasAnySize = hasQueryVolume || hasQueryWeight;

        const coreTokens = (q.core || '').split(/\s+/).filter(Boolean);
        const isGenericQuery =
            coreTokens.length === 1 && coreTokens[0].length >= 4 && !hasAnySize;

        const MIN_FINAL = isGenericQuery ? -0.2 : 0.25;

        const scored = products.map(p => {
            const name = String(p.name ?? '');
            const pCanon = this.canonicalize(name);

            const coreScore = fuzzy(q.core, pCanon.core);

            const sizeScore = hasQueryVolume
                ? this.volumeClosenessScore(q.volumeL, pCanon.volumeL)
                : hasQueryWeight
                  ? this.weightClosenessScore(q.weightKg, pCanon.weightKg)
                  : 0;

            const comboPenalty = this.comboPenalty(q, name);
            const zeroPenalty = this.zeroPenalty(q, name);

            const missingSizePenalty = hasAnySize
                ? hasQueryVolume
                    ? pCanon.volumeL == null
                        ? 0.55
                        : 0
                    : pCanon.weightKg == null
                      ? 0.55
                      : 0
                : 0;

            const coreGate =
                hasAnySize && !isGenericQuery
                    ? coreScore >= MIN_CORE_WITH_SIZE
                        ? 0
                        : -999
                    : 0;

            const wCore = hasAnySize ? 0.65 : 0.85;
            const wSize = hasAnySize ? 0.35 : 0.15;

            const finalScore =
                coreGate +
                wCore * coreScore +
                wSize * sizeScore -
                comboPenalty -
                zeroPenalty -
                missingSizePenalty;

            return { product: p, score: finalScore };
        });

        const filtered = scored.filter(x => x.score >= MIN_FINAL);
        const working = filtered.length ? filtered : scored;

        working.sort((a, b) => {
            const dScore = b.score - a.score;
            if (dScore !== 0) return dScore;

            const aName = String(a.product.name ?? '');
            const bName = String(b.product.name ?? '');

            const aCanon = this.canonicalize(aName);
            const bCanon = this.canonicalize(bName);

            if (hasQueryVolume) {
                const qa = q.volumeL!;
                const da =
                    aCanon.volumeL == null
                        ? Number.POSITIVE_INFINITY
                        : Math.abs(aCanon.volumeL - qa);
                const db =
                    bCanon.volumeL == null
                        ? Number.POSITIVE_INFINITY
                        : Math.abs(bCanon.volumeL - qa);

                if (da !== db) return da - db;

                const aAbove =
                    aCanon.volumeL != null && aCanon.volumeL >= qa ? 0 : 1;
                const bAbove =
                    bCanon.volumeL != null && bCanon.volumeL >= qa ? 0 : 1;

                if (aAbove !== bAbove) return aAbove - bAbove;
            }

            const pa = a.product.price ?? Number.POSITIVE_INFINITY;
            const pb = b.product.price ?? Number.POSITIVE_INFINITY;
            if (pa !== pb) return pa - pb;

            return aName.localeCompare(bName);
        });

        const effectiveLimit = isGenericQuery ? Math.max(limit, 40) : limit;

        return working.slice(0, effectiveLimit).map(x => x.product);
    }
}
