import { useState } from "react";
import type { ManagedUser } from "../types/admin";

type UserAvatarProps = {
    user?: Pick<ManagedUser, "name" | "email" | "image"> | null;
    size?: "sm" | "md" | "lg";
};

function getInitials(user?: UserAvatarProps["user"]) {
    const source = user?.name?.trim() || user?.email?.trim() || "?";
    const parts = source.split(/\s+/).filter(Boolean);

    if (parts.length > 1) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return source.slice(0, 2).toUpperCase();
}

export function UserAvatar({ user, size = "md" }: UserAvatarProps) {
    const [failedImage, setFailedImage] = useState("");
    const image = user?.image?.trim();
    const shouldShowImage = Boolean(image && image !== failedImage);

    return (
        <span className={`user-avatar user-avatar-${size}`} aria-hidden="true">
            {shouldShowImage ? (
                <img src={image} alt="" onError={() => setFailedImage(image ?? "")} />
            ) : (
                <span>{getInitials(user)}</span>
            )}
        </span>
    );
}
