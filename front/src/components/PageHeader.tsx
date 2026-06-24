import type { ReactNode } from "react";

type PageHeaderProps = {
    eyebrow?: string;
    title: string;
    description?: string;
    actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
    return (
        <header className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
            <div className="grid gap-1">
                {eyebrow && (
                    <p className="text-xs font-extrabold uppercase tracking-wider text-primary">
                        {eyebrow}
                    </p>
                )}
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
                {description && (
                    <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{description}</p>
                )}
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
    );
}
