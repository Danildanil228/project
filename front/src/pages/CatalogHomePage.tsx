import { Fish, Goal, Radio, Worm } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";

const sections = [
    { to: "/catalog/reels", title: "Катушки", description: "Бренды, размеры, фрикцион, передатка, цены и модели.", icon: Radio },
    { to: "/catalog/rods", title: "Удилища", description: "Типы удилищ, тесты, строй, бонусы, прочность и цены.", icon: Goal },
    { to: "/catalog/baits", title: "Приманки и наживки", description: "Фото, разделы и категории для выбора в постах и точках.", icon: Worm },
    { to: "/catalog/fish", title: "Рыба", description: "Фото, редкость, веса трофея и водоемы обитания.", icon: Fish },
];

export function CatalogHomePage() {
    return (
        <section className="grid gap-5">
            <PageHeader
                eyebrow="Справочник"
                title="Каталог"
                description="Выберите раздел, чтобы перейти к нужным игровым данным."
            />

            <div className="grid gap-3 sm:grid-cols-2">
                {sections.map(({ to, title, description, icon: Icon }) => (
                    <Link key={to} to={to} className="flex gap-4 rounded-lg border border-border bg-card p-4 text-foreground hover:border-primary">
                        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                            <Icon size={22} />
                        </span>
                        <span className="grid gap-1">
                            <strong>{title}</strong>
                            <span className="text-sm text-muted-foreground">{description}</span>
                        </span>
                    </Link>
                ))}
            </div>
        </section>
    );
}
