import { Trophy } from "lucide-react";
import { catchTrophyTypeLabels, type CatchTrophyType } from "../types/post";

type CatchTrophyBadgeProps = {
    type: CatchTrophyType;
};

export function CatchTrophyBadge({ type }: CatchTrophyBadgeProps) {
    if (type === "normal") return null;

    const colors = type === "rare_trophy"
        ? "border-rose-400/50 bg-rose-500/15 text-rose-700 dark:text-rose-300"
        : "border-amber-400/50 bg-amber-500/15 text-amber-800 dark:text-amber-300";

    return (
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${colors}`}>
            <Trophy size={11} aria-hidden="true" />
            {catchTrophyTypeLabels[type]}
        </span>
    );
}
