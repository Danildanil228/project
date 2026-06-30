import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export function Skeleton({ className = "" }: { className?: string }) {
    return <span aria-hidden="true" className={`loading-shimmer block rounded-md bg-muted ${className}`} />;
}

export function LoadingSpinner({ label = "Загрузка", size = 18, className = "" }: { label?: string; size?: number; className?: string }) {
    return (
        <span role="status" className={`inline-flex items-center justify-center ${className}`}>
            <Loader2 size={size} className="animate-spin text-primary" aria-hidden="true" />
            <span className="sr-only">{label}</span>
        </span>
    );
}

export function PageLoader() {
    return (
        <main className="mx-auto grid min-h-[50vh] w-full max-w-6xl content-start gap-5 px-4 py-8" aria-busy="true">
            <div className="grid gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-64 max-w-full" />
                <Skeleton className="h-4 w-[32rem] max-w-full" />
            </div>
            <CardGridSkeleton count={6} />
        </main>
    );
}

export function CardGridSkeleton({ count = 6, className = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" }: { count?: number; className?: string }) {
    return (
        <div className={`grid gap-3 ${className}`} aria-busy="true">
            {Array.from({ length: count }, (_, index) => (
                <div key={index} className="overflow-hidden rounded-lg border border-border bg-card">
                    <Skeleton className="aspect-[16/9] w-full rounded-none" />
                    <div className="grid gap-3 p-4">
                        <Skeleton className="h-5 w-2/3" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-4/5" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function TableSkeleton({ columns = 5, rows = 7 }: { columns?: number; rows?: number }) {
    return (
        <div className="overflow-hidden rounded-lg border border-border bg-card" aria-busy="true">
            <div className="grid gap-3 border-b border-border bg-muted/50 p-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(5rem, 1fr))` }}>
                {Array.from({ length: columns }, (_, index) => <Skeleton key={index} className="h-4 w-3/4" />)}
            </div>
            {Array.from({ length: rows }, (_, row) => (
                <div key={row} className="grid gap-3 border-b border-border p-3 last:border-0" style={{ gridTemplateColumns: `repeat(${columns}, minmax(5rem, 1fr))` }}>
                    {Array.from({ length: columns }, (_, column) => <Skeleton key={column} className={`h-5 ${column === 0 ? "w-3/4" : "w-full"}`} />)}
                </div>
            ))}
        </div>
    );
}

export function TableRowsSkeleton({ columns, rows = 6 }: { columns: number; rows?: number }) {
    return Array.from({ length: rows }, (_, row) => (
        <tr key={row} className="border-t border-border" aria-hidden="true">
            {Array.from({ length: columns }, (_, column) => <td key={column} className="p-3"><Skeleton className={`h-5 ${column === 0 ? "w-16" : "w-full"}`} /></td>)}
        </tr>
    ));
}

export function ListSkeleton({ count = 5, leading = false }: { count?: number; leading?: boolean }) {
    return (
        <div className="grid gap-2" aria-busy="true">
            {Array.from({ length: count }, (_, index) => (
                <div key={index} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                    {leading && <Skeleton className="size-11 shrink-0 rounded-lg" />}
                    <div className="grid min-w-0 flex-1 gap-2"><Skeleton className="h-4 w-2/5" /><Skeleton className="h-3 w-4/5" /></div>
                </div>
            ))}
        </div>
    );
}

export function MapSkeleton({ className = "min-h-72" }: { className?: string }) {
    return (
        <div className={`relative overflow-hidden rounded-lg border border-border bg-muted ${className}`} aria-busy="true">
            <Skeleton className="absolute inset-0 size-full rounded-none" />
            <div className="absolute inset-0 grid place-items-center"><LoadingSpinner label="Загрузка карты" size={24} /></div>
        </div>
    );
}

export function LoadingOverlay({ children }: { children?: ReactNode }) {
    return <div className="absolute inset-0 z-10 grid place-items-center bg-background/75 backdrop-blur-[1px]">{children ?? <LoadingSpinner size={24} />}</div>;
}
