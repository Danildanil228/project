import type { AuthClientResult } from "../types/admin";

export async function unwrapAuthResult<T>(promise: Promise<AuthClientResult<T> | T>) {
    const result = await promise;
    const maybeResult = result as AuthClientResult<T>;

    if (maybeResult?.error) {
        throw new Error(maybeResult.error.message || maybeResult.error.code || "Ошибка Better Auth");
    }

    return (maybeResult?.data ?? result) as T;
}

