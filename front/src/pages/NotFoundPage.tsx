import { Link } from "react-router-dom";

export function NotFoundPage() {
    return (
        <section className="home-page">
            <div className="panel home-card">
                <h2>Страница не найдена</h2>
                <p className="muted">Такого раздела в приложении нет.</p>
                <Link className="secondary nav-card-link" to="/">
                    На главную
                </Link>
            </div>
        </section>
    );
}

