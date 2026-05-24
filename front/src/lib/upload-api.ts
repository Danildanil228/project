async function readError(response: Response) {
    const data = await response.json().catch(() => null);
    return data?.message || `Request failed with ${response.status}`;
}

export async function uploadAvatar(file: File) {
    const response = await fetch("/api/uploads/avatar", {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": file.type,
        },
        body: file,
    });

    if (!response.ok) {
        throw new Error(await readError(response));
    }

    return response.json() as Promise<{ url: string }>;
}
