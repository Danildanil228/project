import type { ReactNode } from "react";
import { Fish } from "lucide-react";

type EmptyStateProps = {
    icon?: typeof Fish;
    title: string;
    description?: string;
    action?: ReactNode;
};

export function EmptyState({ icon: Icon = Fish, title, description, action }: EmptyStateProps) {
    return (
        <div className="grid place-items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
                <Icon size={22} />
            </span>
            <div className="grid gap-1">
                <h3 className="text-base font-semibold">{title}</h3>
                {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
            </div>
            {action && <div className="mt-1">{action}</div>}
        </div>
    );
}
