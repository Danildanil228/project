import { useEffect, useState } from "react";
import { Cookie } from "lucide-react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "cookie-consent-v1";

// Minimal cookie notice: we only use first-party cookies for the auth session and theme,
// so we don't need fine-grained consent toggles — one acknowledgement is enough. Bumping
// the version key (v2, v3...) re-shows the banner if policy changes.
export function CookieBanner() {
    const [hidden, setHidden] = useState(true);

    useEffect(() => {
        try {
            setHidden(localStorage.getItem(STORAGE_KEY) === "ok");
        } catch {
            setHidden(false);
        }
    }, []);

    function acknowledge() {
        try { localStorage.setItem(STORAGE_KEY, "ok"); } catch { /* private mode — banner reappears each session */ }
        setHidden(true);
    }

    if (hidden) return null;

    return (
        <div className="fixed inset-x-2 bottom-2 z-50 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-md">
            <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-2xl">
                <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                        <Cookie size={18} />
                    </span>
                    <div className="grid gap-1 text-sm leading-relaxed">
                        <strong>Сайт использует cookies</strong>
                        <p className="text-xs text-muted-foreground">
                            Только для входа в аккаунт и сохранения темы. Подробнее — в{" "}
                            <Link to="/legal/privacy" className="text-primary hover:underline">политике конфиденциальности</Link>.
                        </p>
                    </div>
                </div>
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={acknowledge}
                        className="rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90"
                    >
                        Понятно
                    </button>
                </div>
            </div>
        </div>
    );
}
