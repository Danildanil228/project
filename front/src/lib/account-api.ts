// Account self-service: check whether the signed-in user has a password credential
// (email/password vs OAuth-only) and request/confirm a password change via the email-code flow.

async function readError(response: Response) {
    try {
        const data = await response.json() as { message?: string };
        return data.message || response.statusText;
    } catch {
        return response.statusText;
    }
}

export async function hasPasswordCredential(): Promise<boolean> {
    const response = await fetch("/api/account/has-password", { credentials: "include" });
    if (!response.ok) throw new Error(await readError(response));
    const data = await response.json() as { hasPassword: boolean };
    return Boolean(data.hasPassword);
}

export async function requestPasswordChange(currentPassword: string, newPassword: string): Promise<void> {
    const response = await fetch("/api/account/password/request", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!response.ok) throw new Error(await readError(response));
}

export async function confirmPasswordChange(code: string): Promise<void> {
    const response = await fetch("/api/account/password/confirm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
    });
    if (!response.ok) throw new Error(await readError(response));
}
