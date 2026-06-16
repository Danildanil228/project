import { Link } from "react-router-dom";
import type { AdminSecurityContext, ManagedUser } from "../types/admin";
import { canManageCatalog } from "../utils/admin-format";

type ReferenceAdminPageProps = {
    currentUser?: ManagedUser;
    adminContext?: AdminSecurityContext | null;
    onOpenAuthModal: () => void;
};

const sections = [
    { to: "/admin/catalog", title: "Снасти", description: "Катушки и удилища с характеристиками" },
    { to: "/admin/fish", title: "Рыба", description: "Виды рыбы и их редкость" },
    { to: "/admin/waterbodies", title: "Водоёмы", description: "Водоёмы и обитающая в них рыба" },
];

export function ReferenceAdminPage({ currentUser, adminContext, onOpenAuthModal }: ReferenceAdminPageProps) {
    const canManage = canManageCatalog(currentUser, adminContext);

    if (!canManage) {
        return (
            <section className="grid gap-4">
                <div className="rounded-lg border border-border bg-card p-6 text-center">
                    <h2 className="text-xl font-bold">Доступ ограничен</h2>
                    <p className="mt-1 text-muted-foreground">Справочники доступны только администраторам.</p>
                    {!currentUser && (
                        <button onClick={onOpenAuthModal} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
                            Войти
                        </button>
                    )}
                </div>
            </section>
        );
    }

    return (
        <section className="grid gap-5">
            <div className="grid gap-1">
                <p className="text-xs font-extrabold uppercase text-primary">Администрирование</p>
                <h2 className="text-2xl font-bold">Справочники</h2>
                <p className="text-muted-foreground">Управление игровыми данными: снасти, рыба, водоёмы.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
                {sections.map((section) => (
                    <Link key={section.to} to={section.to} className="grid gap-1 rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary">
                        <h3 className="text-lg font-bold">{section.title}</h3>
                        <p className="text-sm text-muted-foreground">{section.description}</p>
                    </Link>
                ))}
            </div>
        </section>
    );
}
