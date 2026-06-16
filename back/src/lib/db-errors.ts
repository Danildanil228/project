// Translates common Postgres constraint violations into safe HTTP errors.
export function translateDbError(error: unknown): never {
    const code = (error as { code?: string })?.code;
    if (code === "23505") {
        throw Object.assign(new Error("Запись с таким названием уже существует"), { statusCode: 409 });
    }
    if (code === "23514") {
        throw Object.assign(new Error("Значение не проходит проверку ограничений"), { statusCode: 400 });
    }
    if (code === "23503") {
        throw Object.assign(new Error("Связанная запись не найдена"), { statusCode: 400 });
    }
    throw error;
}
