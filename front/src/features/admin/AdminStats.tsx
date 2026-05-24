import type { ManagedUser } from "../../types/admin";

type AdminStatsProps = {
    totalUsers: number;
    visibleUsers: number;
    selectedUser: ManagedUser | null;
};

export function AdminStats({ totalUsers, visibleUsers, selectedUser }: AdminStatsProps) {
    return (
        <section className="stats-grid">
            <div className="stat">
                <span>Всего пользователей</span>
                <strong>{totalUsers}</strong>
            </div>
            <div className="stat">
                <span>На странице</span>
                <strong>{visibleUsers}</strong>
            </div>
            <div className="stat">
                <span>Выбран пользователь</span>
                <strong>{selectedUser ? selectedUser.email : "-"}</strong>
            </div>
        </section>
    );
}

