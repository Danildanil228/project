import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cog, Fish  } from "lucide-react";
import { Combobox, type ComboboxOption } from "../components/Combobox";
import { PageHeader } from "../components/PageHeader";
import { SelectMenu } from "../components/SelectMenu";
import { currentStrength, fetchCalculatorItems, formatKg, parseStrength } from "../lib/calculator-api";

export function CalculatorPage() {
    const { data, isLoading, error } = useQuery({
        queryKey: ["calculator", "items"],
        queryFn: fetchCalculatorItems,
        staleTime: 5 * 60_000,
    });

    const [rodId, setRodId] = useState<number | null>(null);
    const [reelId, setReelId] = useState<number | null>(null);
    const [rodWear, setRodWear] = useState(0);
    const [reelWear, setReelWear] = useState(0);
    const [rodCategory, setRodCategory] = useState<string>("");
    const [reelCategory, setReelCategory] = useState<string>("");

    const rodCategories = useMemo(() => unique(data?.rods.map((r) => r.category)), [data?.rods]);
    const reelCategories = useMemo(() => unique(data?.reels.map((r) => r.category)), [data?.reels]);

    const rodOptions = useMemo<ComboboxOption[]>(
        () =>
            (data?.rods ?? [])
                .filter((r) => !rodCategory || r.category === rodCategory)
                .map((r) => ({
                    id: r.id,
                    name: r.name,
                    hint: `${r.category}${r.type ? ` · ${r.type}` : ""} · ${parseStrength(r.stren).toFixed(1)} кг`,
                })),
        [data?.rods, rodCategory],
    );

    const reelOptions = useMemo<ComboboxOption[]>(
        () =>
            (data?.reels ?? [])
                .filter((r) => !reelCategory || r.category === reelCategory)
                .map((r) => ({
                    id: r.id,
                    name: r.name,
                    hint: `${r.category} · ${parseStrength(r.meh).toFixed(1)} кг`,
                })),
        [data?.reels, reelCategory],
    );

    const rod = useMemo(() => data?.rods.find((r) => r.id === rodId), [data?.rods, rodId]);
    const reel = useMemo(() => data?.reels.find((r) => r.id === reelId), [data?.reels, reelId]);

    const rodBase = parseStrength(rod?.stren);
    const reelBase = parseStrength(reel?.meh);
    const rodCurrent = currentStrength(rodBase, rodWear);
    const reelCurrent = currentStrength(reelBase, reelWear);

    const hasBoth = rod && reel;
    const weakLink = hasBoth ? (rodCurrent <= reelCurrent ? "rod" : "reel") : null;

    if (isLoading) {
        return (
            <section className="grid gap-5">
                <PageHeader eyebrow="Расчёты" title="Калькулятор прочности" description="Загружаем каталог…" />
            </section>
        );
    }
    if (error) {
        return (
            <section className="grid gap-5">
                <PageHeader eyebrow="Расчёты" title="Калькулятор прочности" />
                <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {(error as Error).message}
                </p>
            </section>
        );
    }

    return (
        <section className="grid gap-5">
            <PageHeader
                eyebrow="Расчёты"
                title="Калькулятор прочности"
                description="Выберите удилище и катушку, задайте износ — увидите реальную прочность с учётом 30% неизнашиваемой части. Слабое звено — то, что лопнет первым."
            />

            {/* Two-column gear pickers */}
            <div className="grid gap-4 lg:grid-cols-2">
                <GearBlock
                    icon={Fish}
                    title="Удилище"
                    subtitle="Прочность бланка"
                    categories={rodCategories}
                    category={rodCategory}
                    onCategoryChange={(value) => { setRodCategory(value); setRodId(null); }}
                    options={rodOptions}
                    selectedId={rodId}
                    onSelect={setRodId}
                    selectedName={rod?.name}
                    meta={rod ? `${rod.category}${rod.type ? ` · ${rod.type}` : ""}` : undefined}
                    base={rodBase}
                    wear={rodWear}
                    onWearChange={setRodWear}
                    current={rodCurrent}
                    isWeak={weakLink === "rod"}
                />
                <GearBlock
                    icon={Cog}
                    title="Катушка"
                    subtitle="Прочность ведущей шестерни"
                    categories={reelCategories}
                    category={reelCategory}
                    onCategoryChange={(value) => { setReelCategory(value); setReelId(null); }}
                    options={reelOptions}
                    selectedId={reelId}
                    onSelect={setReelId}
                    selectedName={reel?.name}
                    meta={reel?.category}
                    base={reelBase}
                    wear={reelWear}
                    onWearChange={setReelWear}
                    current={reelCurrent}
                    isWeak={weakLink === "reel"}
                />
            </div>

            {/* Weak-link summary */}
            {/* <div
                className={`flex flex-col items-start justify-between gap-3 rounded-2xl border p-5 sm:flex-row sm:items-center ${
                    hasBoth
                        ? "border-accent/40 bg-accent/10"
                        : "border-dashed border-border bg-muted/30"
                }`}
            >
                <div className="flex items-start gap-3">
                    <span
                        className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                            hasBoth ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                        }`}
                    >
                        <GitFork size={18} />
                    </span>
                    <div className="grid gap-0.5">
                        <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                            Слабое звено
                        </p>
                        <p className="text-lg font-bold">
                            {hasBoth
                                ? <>{weakLink === "rod" ? "Удилище" : "Катушка"} — рвётся первым на {formatKg(weakValue)}</>
                                : <>Выберите удилище и катушку</>}
                        </p>
                        {hasBoth && (
                            <p className="text-sm text-muted-foreground">
                                Это максимальный вес рыбы, который выдержит вся снасть при текущем износе.
                            </p>
                        )}
                    </div>
                </div>
                {hasBoth && weakValue < Math.max(rodBase, reelBase) * 0.5 && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-xs font-bold text-destructive">
                        <AlertTriangle size={12} /> Сильно изношено
                    </span>
                )}
            </div> */}

            {/* Formula explainer */}
            {/* <details
                open={formulaOpen}
                onToggle={(event) => setFormulaOpen((event.target as HTMLDetailsElement).open)}
                className="rounded-2xl border border-border bg-card"
            >
                <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-sm font-semibold">
                    <span className="inline-flex items-center gap-2">
                        <Info size={16} className="text-primary" /> Как считается прочность
                    </span>
                    <ChevronDown size={16} className={`text-muted-foreground transition-transform ${formulaOpen ? "rotate-180" : ""}`} />
                </summary>
                <div className="grid gap-4 border-t border-border px-5 py-4 text-sm text-muted-foreground">
                    <p>
                        В RF4 у бланков удилищ и ведущих шестерён катушек одна и та же модель износа:
                        <strong className="ml-1 text-foreground">30%</strong> прочности неизнашиваемые, остальные
                        <strong className="ml-1 text-foreground">70%</strong> уменьшаются линейно от 0 до 100% износа.
                    </p>
                    <pre className="overflow-x-auto rounded-lg bg-muted/60 p-4 text-xs text-foreground">
{`current = base × (0.30 + 0.70 × (1 − wear/100))

При 0%   → 100% от базы
При 50%  →  65% от базы
При 100% →  30% от базы`}
                    </pre>
                    <p>
                        Источник: <a href="https://potryasovgame.ru/page114271846.html" target="_blank" rel="noreferrer">potryasovgame.ru — Калькулятор прочности</a>.
                        Удилища и катушки используют одинаковую формулу; разница лишь в каталоге.
                    </p>
                </div>
            </details> */}
        </section>
    );
}

type GearBlockProps = {
    icon: typeof Fish;
    title: string;
    subtitle: string;
    categories: string[];
    category: string;
    onCategoryChange: (value: string) => void;
    options: ComboboxOption[];
    selectedId: number | null;
    onSelect: (id: number | null) => void;
    selectedName?: string;
    meta?: string;
    base: number;
    wear: number;
    onWearChange: (value: number) => void;
    current: number;
    isWeak: boolean;
};

function GearBlock({
    icon: Icon,
    title,
    subtitle,
    categories,
    category,
    onCategoryChange,
    options,
    selectedId,
    onSelect,
    selectedName,
    meta,
    base,
    wear,
    onWearChange,
    current,
    isWeak,
}: GearBlockProps) {
    const ratio = base > 0 ? current / base : 0;
    const barPercent = Math.max(0, Math.min(100, ratio * 100));

    return (
        <div
            className={`grid gap-4 rounded-2xl border bg-card p-5 transition-colors ${
                isWeak ? "border-accent shadow-[0_0_0_1px_var(--accent)]" : "border-border"
            }`}
        >
            <header className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
                        <Icon size={18} />
                    </span>
                    <div>
                        <h3 className="text-base font-bold">{title}</h3>
                        <p className="text-xs text-muted-foreground">{subtitle}</p>
                    </div>
                </div>
                {isWeak && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-accent-foreground">
                        Слабое звено
                    </span>
                )}
            </header>

            <div className="grid gap-2">
                <label className="grid gap-1.5 text-xs">
                    <span className="text-muted-foreground">Категория</span>
                    <SelectMenu value={category} onChange={onCategoryChange} options={[{ value: "", label: "Все категории" }, ...categories.map((value) => ({ value, label: value }))]} />
                </label>
                <label className="grid gap-1.5 text-xs">
                    <span className="text-muted-foreground">Модель</span>
                    <Combobox
                        options={options}
                        value={selectedId}
                        onChange={onSelect}
                        placeholder="Выберите модель…"
                        searchPlaceholder="Введите название…"
                    />
                </label>
                {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
            </div>

            <div className="grid gap-2">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Износ</span>
                    <span className="font-mono font-bold">{wear}%</span>
                </div>
                <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={wear}
                    disabled={!selectedId}
                    onChange={(event) => onWearChange(Number.parseInt(event.target.value, 10))}
                    className="accent-primary disabled:opacity-40"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>0%</span><span>50%</span><span>100%</span>
                </div>
            </div>

            {/* Strength bar */}
            <div className="grid gap-2 rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-end justify-between gap-2">
                    <div className="grid gap-0.5">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">Текущая прочность</p>
                        <p className="text-2xl font-bold tabular-nums">
                            {selectedName ? formatKg(current) : "—"}
                        </p>
                    </div>
                    {selectedName && (
                        <p className="text-right text-xs text-muted-foreground">
                            из {formatKg(base)}<br />
                            <span className="font-bold text-foreground">{(ratio * 100).toFixed(0)}%</span>
                        </p>
                    )}
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-primary via-primary to-accent transition-all"
                        style={{ width: `${barPercent}%` }}
                    />
                </div>
            </div>
        </div>
    );
}

function unique(values: (string | undefined | null)[] | undefined): string[] {
    if (!values) return [];
    return [...new Set(values.filter((v): v is string => Boolean(v)))].sort();
}
