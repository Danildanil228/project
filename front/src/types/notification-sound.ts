export type NotificationSoundKey = "default" | "soft" | "chime" | "double" | "custom";

export type NotificationSoundSettings = {
    enabled: boolean;
    sound: NotificationSoundKey;
    volume: number;
    customUrl: string | null;
};

export const defaultNotificationSoundSettings: NotificationSoundSettings = {
    enabled: true,
    sound: "default",
    volume: 0.65,
    customUrl: null,
};
