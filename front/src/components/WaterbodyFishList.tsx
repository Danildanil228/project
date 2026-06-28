import { Crown, Fish, Sparkles } from "lucide-react";
import { mediaUrl } from "../lib/items-api";
import type { WaterbodyFish } from "../types/waterbody";
import type { FishRarity } from "../types/fish";
import { LoadingImage } from "./LoadingImage";

type Props = { fish: WaterbodyFish[] };

// Read-only inhabitants list for the public waterbody page. Trophy column shows the trophy
// threshold (g→kg) and, if the fish has a rare-trophy threshold, the rare-trophy weight
// alongside it. Rarity is rendered as a coloured pill.
export function WaterbodyFishList({ fish }: Props) {
    if (fish.length === 0) {
        return (
            <article className="grid place-items-center gap-2 rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
                <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary"><Fish size={20} /></span>
                <p className="text-sm text-muted-foreground">Список обитателей этого водоёма пока не заполнен.</p>
            </article>
        );
    }

    return (
        <article className="grid gap-3 rounded-2xl border border-border bg-card p-5">
            <header className="flex items-center justify-between">
                <h3 className="text-base font-bold">Обитатели водоёма</h3>
                <span className="text-xs text-muted-foreground">{fish.length} вид{declension(fish.length)}</span>
            </header>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {fish.map((item) => <FishRow key={item.id} fish={item} />)}
            </ul>
        </article>
    );
}

function FishRow({ fish }: { fish: WaterbodyFish }) {
    return (
        <li className="flex items-center gap-3 rounded-xl border border-border bg-background/50 p-3">
            {fish.photo ? (
                <LoadingImage
                    src={mediaUrl(fish.photo)}
                    alt={fish.name}
                    title={fish.name}
                    className="h-12 w-16 shrink-0 rounded-lg border border-border bg-background"
                    imageClassName="object-contain p-1"
                />
            ) : (
                <span className="grid h-12 w-16 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><Fish size={20} /></span>
            )}
            <div className="grid min-w-0 gap-1">
                <strong className="truncate text-sm">{fish.name}</strong>
                <RarityBadge rarity={fish.rarity} />
                <TrophyLine trophy={fish.trophyWeightGrams} rareTrophy={fish.rareTrophyWeightGrams} />
            </div>
        </li>
    );
}

function RarityBadge({ rarity }: { rarity: FishRarity }) {
    // Rare/legendary fish are highlighted with the warm accent palette; common fish get a muted pill.
    const tone =
        rarity === "Редчайший"
            ? "border-accent/40 bg-accent/15 text-accent-foreground"
            : rarity === "Редкий"
                ? "border-primary/30 bg-primary-soft text-primary"
                : "border-border bg-muted text-muted-foreground";
    return (
        <span className={`inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tone}`}>
            {rarity === "Редчайший" && <Sparkles size={10} />}
            {rarity === "Редкий" && <Crown size={10} />}
            {rarity}
        </span>
    );
}

function TrophyLine({ trophy, rareTrophy }: { trophy: number | null; rareTrophy: number | null }) {
    if (trophy == null && rareTrophy == null) return null;
    return (
        <p className="text-[11px] text-muted-foreground">
            {trophy != null && <>Трофей: <strong className="text-foreground">{formatWeight(trophy)}</strong></>}
            {trophy != null && rareTrophy != null && " · "}
            {rareTrophy != null && <>Редкий: <strong className="text-foreground">{formatWeight(rareTrophy)}</strong></>}
        </p>
    );
}

function formatWeight(grams: number): string {
    if (grams >= 1000) return `${(grams / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} кг`;
    return `${grams.toLocaleString("ru-RU")} г`;
}

function declension(count: number): string {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod100 >= 11 && mod100 <= 14) return "ов";
    if (mod10 === 1) return "";
    if (mod10 >= 2 && mod10 <= 4) return "а";
    return "ов";
}
