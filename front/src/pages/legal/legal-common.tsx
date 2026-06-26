import type { ReactNode } from "react";

// Shared layout chrome for the legal pages. Keeps them visually tied together and lets
// each page focus on copy rather than styling. Tailwind prose-ish look without pulling in
// @tailwindcss/typography.
export function LegalArticle({ children }: { children: ReactNode }) {
    return (
        <section className="mx-auto grid w-full max-w-3xl gap-6 py-2">
            {children}
        </section>
    );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
    return (
        <article className="grid gap-3 rounded-2xl border border-border bg-card p-5 sm:p-6 [&_a]:underline [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:leading-relaxed [&_li]:my-1">
            <h2 className="text-lg font-bold sm:text-xl">{title}</h2>
            {children}
        </article>
    );
}
