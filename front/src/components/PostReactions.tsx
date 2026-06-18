import { useEffect, useState } from "react";
import { getReactions, setReaction } from "../lib/engagement-api";
import type { ManagedUser } from "../types/admin";
import type { ReactionSummary } from "../types/post";
import { getErrorMessage } from "../utils/admin-format";

type PostReactionsProps = {
    postId: number;
    currentUser?: ManagedUser;
    onOpenAuthModal: () => void;
};

export function PostReactions({ postId, currentUser, onOpenAuthModal }: PostReactionsProps) {
    const [summary, setSummary] = useState<ReactionSummary>({ likes: 0, dislikes: 0, mine: 0 });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let ignore = false;
        getReactions(postId)
            .then((data) => {
                if (!ignore) setSummary(data);
            })
            .catch(() => undefined);
        return () => {
            ignore = true;
        };
    }, [postId]);

    async function react(value: 1 | -1) {
        if (!currentUser) {
            onOpenAuthModal();
            return;
        }
        setBusy(true);
        setError("");
        try {
            const { summary: next } = await setReaction(postId, value);
            setSummary(next);
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="flex items-center gap-3">
            <button
                type="button"
                disabled={busy}
                onClick={() => react(1)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-bold transition-colors disabled:opacity-50 ${
                    summary.mine === 1 ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary"
                }`}
            >
                👍 <span>{summary.likes}</span>
            </button>
            <button
                type="button"
                disabled={busy}
                onClick={() => react(-1)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-bold transition-colors disabled:opacity-50 ${
                    summary.mine === -1 ? "border-destructive bg-destructive/10 text-destructive" : "border-border hover:border-destructive"
                }`}
            >
                👎 <span>{summary.dislikes}</span>
            </button>
            {error && <span className="text-xs text-destructive">{error}</span>}
        </div>
    );
}
