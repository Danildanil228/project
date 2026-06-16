import { Link } from "react-router-dom";
import { UserAvatar } from "../components/UserAvatar";
import type { AdminSecurityContext, ManagedUser } from "../types/admin";
import { displayRoleText, hasElevatedUserAccess } from "../utils/admin-format";
import { ModeToggle } from "../components/mode-toggle";
import "@google/model-viewer";
import { ReelCard } from "../components/ReelCard";
import { useEffect, useState } from "react";
import type { Reel } from "../types/reel";

type HomePageProps = {
    currentUser?: ManagedUser;
    adminContext?: AdminSecurityContext | null;
    onOpenAuthModal: () => void;
};

export function HomePage({ currentUser, adminContext, onOpenAuthModal }: HomePageProps) {
    const canOpenAdmin = hasElevatedUserAccess(currentUser, adminContext);

    const [reels, setReels] = useState<Reel[]>([]);
    useEffect(() => {
        fetch("/api/reels")
            .then((res) => res.json())
            .then((data) => setReels(data.reels))
            .catch((err) => console.error("Fetch error:", err));
    }, []);

    const testRequest = async () => {
        if (!currentUser) {
            onOpenAuthModal();
            return;
        }
        try {
            const res = await fetch("/api/admin/context", { credentials: "include" });
            const data = await res.json();
            alert(`Успешный запрос! Данные: ${JSON.stringify(data)}`);
        } catch {
            alert("Ошибка запроса или вы не авторизованы");
        }
    };

    return (
        <section className="home-page">
            <div className="page-heading">
                <p className="eyebrow">Аккаунт</p>
                <h2>Добро пожаловать, {currentUser?.name || currentUser?.email || "гость"}</h2>
                <p className="muted">Это главная страница. Для доступа к некоторым разделам требуется авторизация.</p>
            </div>
            <div className="topbar-actions" style={{ marginBottom: "20px" }}>
                <ModeToggle />
                <button className="secondary" onClick={testRequest}>
                    Тестовый запрос (требует авторизацию)
                </button>
            </div>

            <div className="home-grid">
                <article className="panel home-card">
                    <div className="profile-heading">
                        <UserAvatar user={currentUser} size="lg" />
                        <h3>Профиль</h3>
                    </div>
                    <dl className="profile-list">
                        <div>
                            <dt>Email</dt>
                            <dd>{currentUser?.email || "Не указан"}</dd>
                        </div>
                        <div>
                            <dt>Роль</dt>
                            <dd>{displayRoleText(currentUser, adminContext)}</dd>
                        </div>
                    </dl>
                    {currentUser ? (
                        <Link className="secondary nav-card-link" to="/profile">
                            Настройки профиля
                        </Link>
                    ) : (
                        <button className="secondary" onClick={onOpenAuthModal}>
                            Войти для доступа к профилю
                        </button>
                    )}
                </article>

                {canOpenAdmin && (
                    <article className="panel home-card">
                        <h3>Админ панель</h3>
                        <p className="muted">Управление пользователями, сессиями, ролями, блокировками и связанными аккаунтами.</p>
                        <Link className="primary nav-card-link" to="/admin">
                            Открыть админку
                        </Link>
                    </article>
                )}

                {!canOpenAdmin && currentUser && (
                    <article className="panel home-card">
                        <h3>Доступ</h3>
                        <p className="muted">Для админ-панели нужна роль admin. Обычным пользователям этот раздел не показывается.</p>
                    </article>
                )}
            </div>

            <div className="">
                <div className="grid gap-20">
                    {reels.map((reel) => (
                        <ReelCard key={reel.id} reel={reel} />
                    ))}
                </div>
            </div>
        </section>
    );
}
