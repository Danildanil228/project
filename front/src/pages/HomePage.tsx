import { Link } from "react-router-dom";
import { UserAvatar } from "../components/UserAvatar";
import type { AdminSecurityContext, ManagedUser } from "../types/admin";
import { displayRoleText, hasElevatedUserAccess } from "../utils/admin-format";

type HomePageProps = {
    currentUser?: ManagedUser;
    adminContext?: AdminSecurityContext | null;
};

export function HomePage({ currentUser, adminContext }: HomePageProps) {
    const canOpenAdmin = hasElevatedUserAccess(currentUser, adminContext);

    return (
        <section className="home-page">
            <div className="page-heading">
                <p className="eyebrow">Аккаунт</p>
                <h2>Добро пожаловать, {currentUser?.name || currentUser?.email}</h2>
                <p className="muted">Это главная страница после авторизации. Отсюда пользователь переходит в доступные разделы.</p>
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
                            <dd>{currentUser?.email}</dd>
                        </div>
                        <div>
                            <dt>Роль</dt>
                            <dd>{displayRoleText(currentUser, adminContext)}</dd>
                        </div>
                    </dl>
                    <Link className="secondary nav-card-link" to="/profile">
                        Настройки профиля
                    </Link>
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

                {!canOpenAdmin && (
                    <article className="panel home-card">
                        <h3>Доступ</h3>
                        <p className="muted">Для админ-панели нужна роль admin. Обычным пользователям этот раздел не показывается.</p>
                    </article>
                )}
            </div>
        </section>
    );
}
