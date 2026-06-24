export type CalculatorRod = {
    id: number;
    name: string;
    category: string;
    type: string | null;
    stren: string | null;
};

export type CalculatorReel = {
    id: number;
    name: string;
    category: string;
    meh: string | null;
    meh_mod: string | null;
};

export type CalculatorItems = {
    rods: CalculatorRod[];
    reels: CalculatorReel[];
};

export async function fetchCalculatorItems(): Promise<CalculatorItems> {
    const response = await fetch("/api/calculator/items", { credentials: "include" });
    if (!response.ok) throw new Error("Не удалось загрузить каталог для калькулятора");
    return response.json();
}

// Parses "52,3" / "52.3" / "52" / null → number (NaN-safe). RF4 uses comma as decimal separator.
export function parseStrength(raw: string | null | undefined): number {
    if (!raw) return 0;
    const cleaned = raw.replace(",", ".").match(/-?[0-9]+(?:\.[0-9]+)?/)?.[0];
    if (!cleaned) return 0;
    const value = Number.parseFloat(cleaned);
    return Number.isFinite(value) ? value : 0;
}

// The single durability formula used across all RF4 gear (rod blanks, reel gears, etc.):
//   current = base * (0.30 + 0.70 * (1 - wear/100))
// Effectively: 30% of base is "indestructible", the remaining 70% wears linearly.
//
// Examples:
//   0% wear   → base * 1.00
//   50% wear  → base * 0.65
//   100% wear → base * 0.30
export const INDESTRUCTIBLE_SHARE = 0.30;

export function currentStrength(base: number, wearPercent: number): number {
    const wear = Math.min(100, Math.max(0, wearPercent));
    return base * (INDESTRUCTIBLE_SHARE + (1 - INDESTRUCTIBLE_SHARE) * (1 - wear / 100));
}

export function formatKg(value: number): string {
    return `${value.toFixed(2).replace(/\.?0+$/, "")} кг`;
}
