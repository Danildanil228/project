import { ListSkeleton, MapSkeleton, PageLoader, Skeleton, TableSkeleton } from "./LoadingState";

export function PageHeaderSkeleton({ action = false }: { action?: boolean }) {
    return (
        <div className="flex flex-wrap items-end justify-between gap-4" aria-hidden="true">
            <div className="grid min-w-0 flex-1 gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-72 max-w-full" />
                <Skeleton className="h-4 w-[34rem] max-w-full" />
            </div>
            {action && <Skeleton className="h-10 w-36" />}
        </div>
    );
}

type CatalogSkeletonVariant = "item" | "bait" | "fish" | "waterbody";

export function CatalogCardGridSkeleton({ count = 8, className = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4", variant = "item" }: { count?: number; className?: string; variant?: CatalogSkeletonVariant }) {
    const imageClass = variant === "bait" ? "aspect-square" : variant === "waterbody" ? "aspect-[16/8]" : "aspect-[4/3]";
    const lineCount = variant === "fish" ? 5 : variant === "item" ? 4 : 2;

    return (
        <div className={`grid min-w-0 gap-3 ${className}`} aria-busy="true">
            {Array.from({ length: count }, (_, index) => (
                <article key={index} className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
                    <Skeleton className={`${imageClass} w-full rounded-none`} />
                    <div className={`grid ${variant === "waterbody" ? "gap-2 p-4" : "gap-2 p-3"}`}>
                        <Skeleton className="h-4 w-2/3" />
                        {Array.from({ length: lineCount - 1 }, (_, line) => <Skeleton key={line} className={`h-3 ${line === lineCount - 2 ? "w-3/5" : "w-full"}`} />)}
                    </div>
                </article>
            ))}
        </div>
    );
}

export function PostGridSkeleton({ count = 6, className = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" }: { count?: number; className?: string }) {
    return (
        <div className={`grid min-w-0 gap-4 ${className}`} aria-busy="true">
            {Array.from({ length: count }, (_, index) => (
                <article key={index} className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
                    <Skeleton className="aspect-[16/9] w-full rounded-none" />
                    <div className="hidden grid-cols-2 gap-1 sm:grid lg:grid-cols-4">{Array.from({ length: 4 }, (_, thumbnail) => <Skeleton key={thumbnail} className="h-20 rounded-none" />)}</div>
                    <div className="grid flex-1 gap-2 p-3">
                        <div className="flex gap-2"><Skeleton className="h-4 w-2/5" /><Skeleton className="h-4 w-20" /></div>
                        <div className="flex gap-1"><Skeleton className="h-5 w-24 rounded-full" /><Skeleton className="h-5 w-20 rounded-full" /></div>
                        <Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /><Skeleton className="mt-1 h-3 w-32" />
                    </div>
                    <div className="flex items-center justify-between border-t border-border p-3"><div className="flex items-center gap-2"><Skeleton className="size-7 rounded-full" /><Skeleton className="h-4 w-24" /></div><Skeleton className="h-3 w-16" /></div>
                </article>
            ))}
        </div>
    );
}

export function ItemDetailSkeleton({ withBack = false }: { withBack?: boolean }) {
    return (
        <section className="grid gap-5" aria-busy="true">
            {withBack && <Skeleton className="h-5 w-28" />}
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <div className="grid content-start gap-2"><Skeleton className="h-9 w-48" /><Skeleton className="h-[360px] w-full rounded-lg" /></div>
                <div className="grid content-start gap-3">
                    <Skeleton className="h-3 w-24" /><Skeleton className="h-8 w-2/3" />
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">{Array.from({ length: 14 }, (_, index) => <div key={index} className="grid gap-1 border-b border-border pb-2"><Skeleton className="h-3 w-2/3" /><Skeleton className="h-4 w-4/5" /></div>)}</div>
                </div>
            </div>
        </section>
    );
}

export function PostDetailSkeleton() {
    return (
        <section className="grid gap-5" aria-busy="true">
            <Skeleton className="h-9 w-24" />
            <div className="grid items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
                <div className="grid content-start gap-3"><Skeleton className="aspect-[4/3] w-full rounded-lg" /><div className="grid gap-3 rounded-lg border border-border bg-card p-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div></div>
                <div className="grid content-start gap-3">
                    <div className="flex items-center gap-3"><Skeleton className="size-11 rounded-full" /><div className="grid flex-1 gap-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-36" /></div></div>
                    <div className="grid gap-3 rounded-lg border border-border bg-card p-3">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className={`h-4 ${index === 3 ? "w-2/5" : "w-3/4"}`} />)}</div>
                    <div className="grid gap-2 rounded-lg border border-border bg-card p-3"><Skeleton className="h-4 w-16" /><MapSkeleton className="aspect-square min-h-64" /></div>
                    <div className="grid gap-2 rounded-lg border border-border bg-card p-3"><Skeleton className="h-4 w-20" /><ListSkeleton count={2} leading /></div>
                </div>
            </div>
        </section>
    );
}

export function PostEditorSkeleton() {
    return (
        <section className="grid gap-5" aria-busy="true">
            <PageHeaderSkeleton />
            <div className="grid gap-4 rounded-lg border border-border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,460px)]">
                <div className="grid content-start gap-4"><div className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full sm:col-span-2" /></div><Skeleton className="h-36 w-full" /></div>
                <MapSkeleton className="aspect-square min-h-72" />
            </div>
            <div className="grid gap-3 rounded-lg border border-border bg-card p-4"><Skeleton className="h-5 w-32" /><Skeleton className="h-10 w-full" /><ListSkeleton count={2} /></div>
            <div className="grid gap-3 rounded-lg border border-border bg-card p-4"><Skeleton className="h-5 w-36" /><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="aspect-square" />)}</div></div>
        </section>
    );
}

export function CalculatorPageSkeleton() {
    return (
        <section className="grid gap-5" aria-busy="true"><PageHeaderSkeleton /><div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 2 }, (_, index) => <div key={index} className="grid gap-4 rounded-2xl border border-border bg-card p-5"><div className="flex items-center gap-3"><Skeleton className="size-10 rounded-xl" /><div className="grid flex-1 gap-2"><Skeleton className="h-5 w-28" /><Skeleton className="h-3 w-40" /></div></div><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-12 w-full" /><div className="grid gap-3 rounded-xl border border-border p-4"><Skeleton className="h-3 w-32" /><Skeleton className="h-8 w-24" /><Skeleton className="h-2 w-full rounded-full" /></div></div>)}
        </div></section>
    );
}

export function WaterbodyDetailSkeleton() {
    return (
        <section className="grid gap-5" aria-busy="true"><PageHeaderSkeleton action /><div className="grid w-full min-w-0 grid-cols-1 items-start justify-between gap-5 lg:grid-cols-[minmax(360px,500px)_minmax(420px,1fr)]">
            <MapSkeleton className="aspect-square min-h-56 w-full max-w-[500px] justify-self-start sm:min-h-72" />
            <div className="grid min-w-0 gap-3 rounded-lg border border-border bg-card p-4"><Skeleton className="h-6 w-32" />{Array.from({ length: 4 }, (_, index) => <div key={index} className="flex items-center justify-between gap-4 border-t border-border pt-3"><Skeleton className="h-4 w-2/5" /><Skeleton className="h-3 w-16" /></div>)}</div>
        </div><div className="grid gap-4 rounded-lg border border-border bg-card p-4"><Skeleton className="h-6 w-48" /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-20 w-full" />)}</div></div></section>
    );
}

export function AuthorProfileSkeleton() {
    return <section className="grid gap-5" aria-busy="true"><div className="flex items-center gap-4 rounded-lg border border-border bg-card p-4"><Skeleton className="size-16 shrink-0 rounded-full" /><div className="grid flex-1 gap-2"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-64 max-w-full" /></div></div><PostGridSkeleton count={6} /></section>;
}

export function ProfilePageSkeleton() {
    return <section className="grid gap-6" aria-busy="true"><PageHeaderSkeleton action /><div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-6"><Skeleton className="size-16 rounded-full" /><div className="grid flex-1 gap-2"><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-64 max-w-full" /></div></div><div className="grid gap-3 sm:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"><Skeleton className="size-10 rounded-xl" /><div className="grid flex-1 gap-2"><Skeleton className="h-3 w-28" /><Skeleton className="h-5 w-20" /></div></div>)}</div><ListSkeleton count={5} leading /></section>;
}

export function ProfileSettingsSkeleton() {
    return <section className="grid gap-5" aria-busy="true"><PageHeaderSkeleton action /><div className="grid gap-4 lg:grid-cols-2">{Array.from({ length: 2 }, (_, index) => <div key={index} className="grid gap-4 rounded-lg border border-border bg-card p-5"><div className="flex items-center gap-3"><Skeleton className="size-14 rounded-full" /><div className="grid flex-1 gap-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-3 w-56 max-w-full" /></div></div><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-10 w-36" /></div>)}</div><div className="grid gap-4 rounded-lg border border-border bg-card p-5"><Skeleton className="h-6 w-56" /><ListSkeleton count={4} leading /><Skeleton className="h-12 w-full" /></div><div className="grid gap-3 rounded-lg border border-border bg-card p-5"><Skeleton className="h-6 w-32" /><ListSkeleton count={3} leading /></div></section>;
}

export function CatalogHomeSkeleton() {
    return <section className="grid gap-5" aria-busy="true"><PageHeaderSkeleton /><div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 4 }, (_, index) => <div key={index} className="flex gap-4 rounded-lg border border-border bg-card p-4"><Skeleton className="size-11 shrink-0 rounded-lg" /><div className="grid flex-1 gap-2"><Skeleton className="h-5 w-28" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div></div>)}</div></section>;
}

export function LegalPageSkeleton() {
    return <section className="mx-auto grid w-full max-w-3xl gap-6 py-2" aria-busy="true"><PageHeaderSkeleton />{Array.from({ length: 3 }, (_, index) => <article key={index} className="grid gap-3 rounded-2xl border border-border bg-card p-6"><Skeleton className="h-6 w-2/5" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /></article>)}</section>;
}

export function AuthPageSkeleton() {
    return <main className="auth-page" aria-busy="true"><section className="auth-panel grid gap-4"><Skeleton className="h-3 w-24" /><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-64 max-w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-5 w-32" /></section></main>;
}

export function AdminPageSkeleton() {
    return <section className="grid gap-5" aria-busy="true"><PageHeaderSkeleton /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24 rounded-lg" />)}</div><TableSkeleton columns={6} rows={7} /></section>;
}

export function RoutePageSkeleton({ pathname }: { pathname: string }) {
    const segments = pathname.split("/").filter(Boolean);
    if (pathname === "/catalog") return <CatalogHomeSkeleton />;
    if (pathname === "/feed") return <section className="grid min-w-0 gap-5"><PageHeaderSkeleton action /><Skeleton className="h-44 w-full rounded-lg" /><PostGridSkeleton /></section>;
    if (pathname === "/calculator") return <CalculatorPageSkeleton />;
    if (pathname === "/waterbodies") return <section className="grid min-w-0 gap-5"><PageHeaderSkeleton /><CatalogCardGridSkeleton count={6} className="sm:grid-cols-2 lg:grid-cols-3" variant="waterbody" /></section>;
    if (segments[0] === "waterbodies" && segments.length === 2) return <WaterbodyDetailSkeleton />;
    if (segments[0] === "catalog" && segments.length === 3) return <ItemDetailSkeleton withBack />;
    if (segments[0] === "catalog" && segments.length === 2) {
        const variant = segments[1] === "baits" ? "bait" : segments[1] === "fish" ? "fish" : "item";
        return <section className="grid min-w-0 gap-5 overflow-hidden"><PageHeaderSkeleton /><Skeleton className="h-28 w-full max-w-full" /><CatalogCardGridSkeleton variant={variant} /></section>;
    }
    if (segments[0] === "posts" && (segments[1] === "new" || segments[2] === "edit" || segments[2] === "moderate")) return <PostEditorSkeleton />;
    if (segments[0] === "posts" && segments[1] === "author") return <AuthorProfileSkeleton />;
    if (segments[0] === "posts" && segments.length === 2) return <PostDetailSkeleton />;
    if (pathname === "/profile/settings") return <ProfileSettingsSkeleton />;
    if (pathname === "/profile") return <ProfilePageSkeleton />;
    if (pathname.startsWith("/legal/")) return <LegalPageSkeleton />;
    if (pathname.startsWith("/admin") || pathname.startsWith("/moderation")) return <AdminPageSkeleton />;
    return <PageLoader />;
}
