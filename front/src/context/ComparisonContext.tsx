import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Scale, X } from "lucide-react";
import type { ItemType } from "../lib/items-api";

const storageKey = "catalog-comparison-v1";
const maxItems = 10;

type ComparisonState = {
    type: ItemType | null;
    ids: number[];
};

type ComparisonNotice = {
    message: string;
    tone: "success" | "error";
    showLink: boolean;
};

type ComparisonContextValue = ComparisonState & {
    maxItems: number;
    add: (type: ItemType, id: number, name: string) => boolean;
    remove: (id: number) => void;
    toggle: (type: ItemType, id: number, name: string) => boolean;
    clear: () => void;
    includes: (type: ItemType, id: number) => boolean;
};

const emptyState: ComparisonState = { type: null, ids: [] };
const ComparisonContext = createContext<ComparisonContextValue | null>(null);

function isItemType(value: unknown): value is ItemType {
    return value === "reels" || value === "rods";
}

function readState(): ComparisonState {
    try {
        const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "null") as Partial<ComparisonState> | null;
        const ids = Array.isArray(parsed?.ids)
            ? [...new Set(parsed.ids.filter((id): id is number => Number.isInteger(id) && id > 0))].slice(0, maxItems)
            : [];
        const type = isItemType(parsed?.type) && ids.length > 0 ? parsed.type : null;
        return { type, ids: type ? ids : [] };
    } catch {
        return emptyState;
    }
}

export function ComparisonProvider({ children }: { children: ReactNode }) {
    const location = useLocation();
    const [state, setState] = useState<ComparisonState>(readState);
    const [notice, setNotice] = useState<ComparisonNotice | null>(null);

    useEffect(() => {
        try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* Comparison still works for this tab. */ }
    }, [state]);

    useEffect(() => {
        function sync(event: StorageEvent) {
            if (event.key === storageKey) setState(readState());
        }
        window.addEventListener("storage", sync);
        return () => window.removeEventListener("storage", sync);
    }, []);

    useEffect(() => {
        if (!notice) return;
        const timeout = window.setTimeout(() => setNotice(null), 5000);
        return () => window.clearTimeout(timeout);
    }, [notice]);

    const value = useMemo<ComparisonContextValue>(() => ({
        ...state,
        maxItems,
        add(type, id, name) {
            if (state.ids.includes(id) && state.type === type) return true;
            if (state.type && state.type !== type && state.ids.length > 0) {
                setNotice({ message: "Нельзя сравнивать катушки и удилища вместе. Сначала очистите текущее сравнение.", tone: "error", showLink: true });
                return false;
            }
            if (state.ids.length >= maxItems) {
                setNotice({ message: `В сравнении уже максимальные ${maxItems} предметов.`, tone: "error", showLink: true });
                return false;
            }
            setState({ type, ids: [...state.ids, id] });
            if (location.pathname !== "/comparison") setNotice({ message: `«${name}» добавлен в сравнение.`, tone: "success", showLink: true });
            return true;
        },
        remove(id) {
            const ids = state.ids.filter((itemId) => itemId !== id);
            setState({ type: ids.length ? state.type : null, ids });
        },
        toggle(type, id, name) {
            if (state.type === type && state.ids.includes(id)) {
                const ids = state.ids.filter((itemId) => itemId !== id);
                setState({ type: ids.length ? state.type : null, ids });
                return false;
            }
            if (state.type && state.type !== type && state.ids.length > 0) {
                setNotice({ message: "Нельзя сравнивать катушки и удилища вместе. Сначала очистите текущее сравнение.", tone: "error", showLink: true });
                return false;
            }
            if (state.ids.length >= maxItems) {
                setNotice({ message: `В сравнении уже максимальные ${maxItems} предметов.`, tone: "error", showLink: true });
                return false;
            }
            setState({ type, ids: [...state.ids, id] });
            if (location.pathname !== "/comparison") setNotice({ message: `«${name}» добавлен в сравнение.`, tone: "success", showLink: true });
            return true;
        },
        clear() { setState(emptyState); },
        includes(type, id) { return state.type === type && state.ids.includes(id); },
    }), [location.pathname, state]);

    return (
        <ComparisonContext.Provider value={value}>
            {children}
            {notice && <div className={`fixed bottom-4 right-4 z-[70] flex w-[min(380px,calc(100vw-2rem))] items-start gap-3 rounded-lg border bg-card p-3 shadow-xl ${notice.tone === "error" ? "border-destructive/50" : "border-primary/40"}`} role="status">
                <Scale size={18} className={`mt-0.5 shrink-0 ${notice.tone === "error" ? "text-destructive" : "text-primary"}`} />
                <div className="min-w-0 flex-1">
                    <p className="text-sm">{notice.message}</p>
                    {notice.showLink && <Link to="/comparison" onClick={() => setNotice(null)} className="mt-1 inline-block text-sm font-bold hover:underline">Перейти к сравнению</Link>}
                </div>
                <button type="button" onClick={() => setNotice(null)} title="Закрыть" className="grid size-7 shrink-0 place-items-center rounded hover:bg-muted"><X size={15} /></button>
            </div>}
        </ComparisonContext.Provider>
    );
}

export function useComparison() {
    const context = useContext(ComparisonContext);
    if (!context) throw new Error("useComparison must be used inside ComparisonProvider");
    return context;
}
