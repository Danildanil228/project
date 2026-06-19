import type { ManagedAuditLog } from "../types/admin";

const actionLabels: Record<string, string> = {
    "request.failed": "Отклонённый запрос",
    "auth.register": "Регистрация",
    "auth.login": "Вход в аккаунт",
    "auth.login.social": "Вход через социальную сеть",
    "auth.logout": "Выход из аккаунта",
    "auth.profile.update": "Обновление профиля",
    "auth.password.change": "Смена пароля",
    "auth.password.reset-request": "Запрос сброса пароля",
    "auth.password.reset-complete": "Завершение сброса пароля",
    "auth.email.change": "Смена email",
    "auth.email.verification-request": "Запрос подтверждения email",
    "auth.user.delete": "Удаление аккаунта",
    "auth.session.revoke": "Отзыв сессии",
    "auth.sessions.revoke-all": "Отзыв всех сессий",
    "auth.sessions.revoke-others": "Отзыв остальных сессий",
    "auth.account.link": "Привязка аккаунта",
    "auth.account.unlink": "Отвязка аккаунта",
    "admin.audit.export": "Экспорт журнала",
    "admin.user.role.update": "Изменение роли",
    "admin.users.bulk-role": "Массовое изменение ролей",
    "admin.users.bulk-ban": "Массовая блокировка",
    "admin.users.bulk-unban": "Массовая разблокировка",
    "admin.users.export": "Экспорт пользователей",
    "admin.account.unlink": "Отвязка аккаунта",
    "admin.user.impersonate": "Вход от имени пользователя",
    "admin.user.stop-impersonating": "Завершение входа от имени пользователя",
    "better-auth.admin.create-user": "Создание пользователя",
    "better-auth.admin.update-user": "Обновление пользователя",
    "better-auth.admin.ban-user": "Блокировка пользователя",
    "better-auth.admin.unban-user": "Разблокировка пользователя",
    "better-auth.admin.remove-user": "Удаление пользователя",
    "better-auth.admin.set-user-password": "Смена пароля администратором",
    "better-auth.admin.revoke-user-session": "Отзыв сессии пользователя",
    "better-auth.admin.revoke-user-sessions": "Отзыв всех сессий пользователя",
    "better-auth.admin.impersonate-user": "Вход от имени пользователя",
    "better-auth.admin.stop-impersonating": "Завершение входа от имени пользователя",
    "better-auth.change-password": "Смена пароля",
    "better-auth.update-user": "Обновление профиля",
    "email.verification.sent": "Отправка подтверждения email",
    "email.password-reset.sent": "Отправка ссылки сброса пароля",
    "user.email.verified": "Подтверждение email",
    "user.password.reset": "Сброс пароля",
    "post.create-draft": "Создание черновика",
    "post.update-draft": "Обновление черновика",
    "post.submit": "Отправка поста на модерацию",
    "post.publish-direct": "Прямая публикация поста",
    "post.delete-own": "Удаление своего поста",
    "post.claim": "Пост взят на модерацию",
    "post.release": "Пост возвращён в очередь",
    "post.approve": "Одобрение поста",
    "post.reject": "Отклонение поста",
    "post.remove": "Удаление поста модератором",
    "post.pin": "Закрепление поста",
    "post.unpin": "Открепление поста",
    "post.moderate-edit": "Редактирование поста модератором",
    "comment.create": "Добавление комментария",
    "comment.delete-own": "Удаление своего комментария",
    "comment.delete-moderate": "Удаление комментария модератором",
    "reaction.set": "Добавление реакции",
    "reaction.change": "Изменение реакции",
    "reaction.remove": "Удаление реакции",
    "report.create": "Создание жалобы",
    "report.resolved": "Подтверждение жалобы",
    "report.rejected": "Отклонение жалобы",
    "notification.read": "Прочтение уведомлений",
    "notification.read-all": "Прочтение всех уведомлений",
    "upload.avatar": "Загрузка аватара",
    "upload.post-image": "Загрузка изображения поста",
    "upload.item-image": "Загрузка изображения предмета",
    "upload.item-model": "Загрузка 3D-модели предмета",
    "admin.fish.create": "Добавление рыбы",
    "admin.fish.update": "Изменение рыбы",
    "admin.fish.delete": "Удаление рыбы",
    "admin.waterbody.create": "Добавление водоёма",
    "admin.waterbody.update": "Изменение водоёма",
    "admin.waterbody.delete": "Удаление водоёма",
    "admin.reels.create": "Добавление катушки",
    "admin.reels.update": "Изменение катушки",
    "admin.reels.delete": "Удаление катушки",
    "admin.rods.create": "Добавление удилища",
    "admin.rods.update": "Изменение удилища",
    "admin.rods.delete": "Удаление удилища",
};

const roleLabels: Record<string, string> = {
    user: "пользователь",
    moderator: "модератор",
    admin: "администратор",
    "super-admin": "супер-администратор",
};

const fieldLabels: Record<string, string> = {
    name: "имя",
    email: "email",
    image: "аватар",
    role: "роль",
    banned: "блокировка",
    banReason: "причина блокировки",
    banExpires: "срок блокировки",
    description: "описание",
    waterbodyId: "водоём",
    point: "точка ловли",
    fishingMethod: "способ ловли",
    income: "доход",
    fishingMinutes: "время ловли",
    catches: "улов",
    media: "изображения",
};

function value(metadata: Record<string, unknown>, key: string) {
    return metadata[key];
}

function numericId(metadata: Record<string, unknown>, key: string) {
    const item = value(metadata, key);
    return typeof item === "number" || typeof item === "string" ? String(item) : null;
}

function body(metadata: Record<string, unknown>) {
    const item = metadata.body;
    return item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
}

function userLabel(name?: string | null, email?: string | null, id?: string | null) {
    if (name && email) return `${name} (${email})`;
    if (name) return name;
    if (email) return email;
    if (id) return `пользователь ${id}`;
    return "система";
}

function targetLabel(log: ManagedAuditLog) {
    return userLabel(log.targetName, log.targetEmail, log.targetUserId);
}

function actorLabel(log: ManagedAuditLog) {
    if (!log.actorId && log.action.startsWith("auth.login")) {
        return log.outcome === "failure" ? "Неизвестный посетитель" : targetLabel(log);
    }
    return userLabel(log.actorName, log.actorEmail, log.actorId);
}

function withTarget(log: ManagedAuditLog, text: string) {
    if (!log.targetUserId && !log.targetEmail && !log.targetName) return text;
    if (log.actorId && log.targetUserId === log.actorId) return `${text} для своего аккаунта`;
    return `${text}: ${targetLabel(log)}`;
}

function entityName(log: ManagedAuditLog) {
    const name = value(log.metadata, "name");
    return typeof name === "string" && name.trim() ? ` «${name}»` : "";
}

export function auditActionText(action: string) {
    if (actionLabels[action]) return actionLabels[action];
    if (action.endsWith(".failed")) {
        const base = action.slice(0, -7);
        return `${actionLabels[base] ?? base}: ошибка`;
    }
    return action;
}

export function auditSummary(log: ManagedAuditLog) {
    const actor = actorLabel(log);
    const postId = numericId(log.metadata, "postId");
    const commentId = numericId(log.metadata, "commentId");
    const reportId = numericId(log.metadata, "reportId");
    const post = postId ? `пост #${postId}` : "пост";
    const action = log.action !== "request.failed" && log.action.endsWith(".failed") ? log.action.slice(0, -7) : log.action;
    const failed = log.outcome === "failure";

    switch (action) {
        case "request.failed": return `${actor} получил отказ при выполнении ${[log.method, log.path].filter(Boolean).join(" ") || "запроса"}`;
        case "auth.register": return failed ? `${actor} не смог зарегистрировать аккаунт ${targetLabel(log)}` : `${actor} зарегистрировал аккаунт`;
        case "auth.login": return failed ? `${actor} не смог войти в аккаунт ${targetLabel(log)}` : `${actor} вошёл в аккаунт`;
        case "auth.login.social": return `${actor} вошёл через социальную сеть`;
        case "auth.logout": return `${actor} вышел из аккаунта`;
        case "auth.profile.update":
        case "better-auth.update-user": return `${actor} обновил свой профиль`;
        case "auth.password.change":
        case "better-auth.change-password": return `${actor} изменил пароль своего аккаунта`;
        case "auth.password.reset-request": return `Система получила запрос на сброс пароля для ${targetLabel(log)}`;
        case "auth.password.reset-complete":
        case "user.password.reset": return `Система завершила сброс пароля для ${targetLabel(log)}`;
        case "auth.email.verification-request":
        case "email.verification.sent": return `Система отправила подтверждение email для ${targetLabel(log)}`;
        case "email.password-reset.sent": return `Система отправила ссылку сброса пароля для ${targetLabel(log)}`;
        case "user.email.verified": return `${targetLabel(log)} подтвердил email`;
        case "auth.session.revoke": return `${actor} отозвал выбранную сессию`;
        case "auth.sessions.revoke-all": return `${actor} отозвал все свои сессии`;
        case "auth.sessions.revoke-others": return `${actor} отозвал остальные сессии`;
        case "auth.account.link": return `${actor} привязал внешний аккаунт`;
        case "auth.account.unlink": return `${actor} отвязал внешний аккаунт`;
        case "admin.user.role.update":
        case "admin.users.bulk-role": return `${actor} изменил роль пользователя ${targetLabel(log)}`;
        case "admin.users.bulk-ban":
        case "better-auth.admin.ban-user": return `${actor} заблокировал пользователя ${targetLabel(log)}`;
        case "admin.users.bulk-unban":
        case "better-auth.admin.unban-user": return `${actor} разблокировал пользователя ${targetLabel(log)}`;
        case "better-auth.admin.create-user": return `${actor} создал пользователя ${targetLabel(log)}`;
        case "better-auth.admin.update-user": return `${actor} обновил данные пользователя ${targetLabel(log)}`;
        case "better-auth.admin.remove-user": return `${actor} удалил пользователя ${targetLabel(log)}`;
        case "better-auth.admin.set-user-password": return `${actor} установил новый пароль пользователю ${targetLabel(log)}`;
        case "better-auth.admin.revoke-user-session": return `${actor} отозвал сессию пользователя ${targetLabel(log)}`;
        case "better-auth.admin.revoke-user-sessions": return `${actor} отозвал все сессии пользователя ${targetLabel(log)}`;
        case "admin.account.unlink": return `${actor} отвязал аккаунт пользователя ${targetLabel(log)}`;
        case "admin.user.impersonate":
        case "better-auth.admin.impersonate-user": return `${actor} вошёл от имени пользователя ${targetLabel(log)}`;
        case "admin.user.stop-impersonating":
        case "better-auth.admin.stop-impersonating": return `${actor} завершил вход от имени другого пользователя`;
        case "admin.users.export": return `${actor} экспортировал список пользователей`;
        case "admin.audit.export": return `${actor} экспортировал журнал действий`;
        case "post.create-draft": return `${actor} создал черновик ${post}`;
        case "post.update-draft": return `${actor} обновил черновик ${post}`;
        case "post.submit": return `${actor} отправил ${post} на модерацию`;
        case "post.publish-direct": return `${actor} опубликовал ${post} без модерации`;
        case "post.delete-own": return `${actor} удалил свой ${post}`;
        case "post.claim": return `${actor} взял ${post} пользователя ${targetLabel(log)} на модерацию`;
        case "post.release": return `${actor} вернул ${post} пользователя ${targetLabel(log)} в очередь`;
        case "post.approve": return `${actor} одобрил ${post} пользователя ${targetLabel(log)}`;
        case "post.reject": return `${actor} отклонил ${post} пользователя ${targetLabel(log)}`;
        case "post.remove": return `${actor} удалил ${post} пользователя ${targetLabel(log)}`;
        case "post.pin": return `${actor} закрепил ${post}`;
        case "post.unpin": return `${actor} открепил ${post}`;
        case "post.moderate-edit": return `${actor} отредактировал ${post} пользователя ${targetLabel(log)}`;
        case "comment.create": return `${actor} добавил комментарий${commentId ? ` #${commentId}` : ""} к ${post}`;
        case "comment.delete-own": return `${actor} удалил свой комментарий${commentId ? ` #${commentId}` : ""} к ${post}`;
        case "comment.delete-moderate": return `${actor} удалил комментарий${commentId ? ` #${commentId}` : ""} пользователя ${targetLabel(log)}`;
        case "reaction.set": return `${actor} поставил реакцию на ${post}`;
        case "reaction.change": return `${actor} изменил реакцию на ${post}`;
        case "reaction.remove": return `${actor} убрал реакцию с ${post}`;
        case "report.create": return `${actor} отправил жалобу${reportId ? ` #${reportId}` : ""} на ${post}`;
        case "report.resolved": return `${actor} подтвердил жалобу${reportId ? ` #${reportId}` : ""}`;
        case "report.rejected": return `${actor} отклонил жалобу${reportId ? ` #${reportId}` : ""}`;
        case "notification.read": return `${actor} отметил выбранные уведомления прочитанными`;
        case "notification.read-all": return `${actor} отметил все уведомления прочитанными`;
        case "upload.avatar": return `${actor} загрузил новый аватар`;
        case "upload.post-image": return `${actor} загрузил изображение для поста`;
        case "upload.item-image": return `${actor} загрузил изображение предмета`;
        case "upload.item-model": return `${actor} загрузил 3D-модель предмета`;
        case "admin.fish.create": return `${actor} добавил рыбу${entityName(log)}`;
        case "admin.fish.update": return `${actor} изменил рыбу${entityName(log)}`;
        case "admin.fish.delete": return `${actor} удалил рыбу${entityName(log)}`;
        case "admin.waterbody.create": return `${actor} добавил водоём${entityName(log)}`;
        case "admin.waterbody.update": return `${actor} изменил водоём${entityName(log)}`;
        case "admin.waterbody.delete": return `${actor} удалил водоём${entityName(log)}`;
        case "admin.reels.create": return `${actor} добавил катушку${entityName(log)}`;
        case "admin.reels.update": return `${actor} изменил катушку${entityName(log)}`;
        case "admin.reels.delete": return `${actor} удалил катушку${entityName(log)}`;
        case "admin.rods.create": return `${actor} добавил удилище${entityName(log)}`;
        case "admin.rods.update": return `${actor} изменил удилище${entityName(log)}`;
        case "admin.rods.delete": return `${actor} удалил удилище${entityName(log)}`;
        default: return withTarget(log, `${actor}: ${auditActionText(log.action).toLowerCase()}`);
    }
}

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function displayValue(key: string, item: unknown) {
    if (key === "role" && typeof item === "string") return roleLabels[item] ?? item;
    if (key === "value" && typeof item === "number") return item === 1 ? "Нравится" : item === -1 ? "Не нравится" : "Удалена";
    if (key === "bytes" && typeof item === "number") return formatBytes(item);
    if (key === "image") return "обновлён";
    if (key === "fields" && Array.isArray(item)) return item.map((field) => fieldLabels[String(field)] ?? String(field)).join(", ");
    if (Array.isArray(item)) return item.join(", ");
    return String(item);
}

export function auditDetails(log: ManagedAuditLog) {
    const details: { label: string; value: string }[] = [];
    const data = { ...log.metadata, ...body(log.metadata) };
    const detailLabels: Record<string, string> = {
        role: "Новая роль",
        reason: "Причина",
        expiresAt: "Блокировка до",
        fields: "Изменённые поля",
        count: "Количество записей",
        updated: "Обновлено",
        value: "Реакция",
        bytes: "Размер файла",
        contentType: "Тип файла",
        providerId: "Провайдер",
        statusCode: "Код ответа",
        email: "Email",
        image: "Аватар",
    };
    const ignored = new Set(["body", "path", "url", "userId", "postId", "commentId", "reportId", "previousValue", "notificationIds", "query", "error", "kind"]);

    if (typeof data.name === "string" && data.name.trim()) {
        details.push({ label: Object.hasOwn(body(log.metadata), "name") ? "Имя" : "Название", value: data.name });
    }

    for (const [key, label] of Object.entries(detailLabels)) {
        const item = data[key];
        if (item !== null && item !== undefined && item !== "" && item !== "[redacted]") {
            details.push({ label, value: displayValue(key, item) });
        }
    }

    for (const [key, item] of Object.entries(data)) {
        if (details.length >= 4 || detailLabels[key] || ignored.has(key) || item === null || item === undefined || item === "" || item === "[redacted]") continue;
        if (typeof item === "object" && !Array.isArray(item)) continue;
        details.push({ label: fieldLabels[key] ?? key, value: displayValue(key, item) });
    }

    return details;
}

export function auditRoleText(role?: string | null) {
    if (!role) return null;
    return role.split(",").map((item) => roleLabels[item.trim()] ?? item.trim()).join(", ");
}

export function auditClientText(userAgent?: string | null) {
    if (!userAgent) return null;
    if (userAgent.includes("WindowsPowerShell")) return "PowerShell";
    if (userAgent.includes("Edg/")) return "Microsoft Edge";
    if (userAgent.includes("Chrome/")) return "Google Chrome";
    if (userAgent.includes("Firefox/")) return "Mozilla Firefox";
    if (userAgent.includes("Safari/")) return "Safari";
    return "API-клиент";
}
