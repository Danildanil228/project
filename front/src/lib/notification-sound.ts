import type { NotificationSoundKey, NotificationSoundSettings } from "../types/notification-sound";

export const notificationSoundSettingsEvent = "notification-sound-settings-changed";

export const notificationSoundOptions: Array<{ key: Exclude<NotificationSoundKey, "custom">; name: string; description: string }> = [
    { key: "default", name: "Стандартный", description: "Короткий двухтональный сигнал" },
    { key: "soft", name: "Мягкий", description: "Тихий и спокойный" },
    { key: "chime", name: "Колокольчик", description: "Высокий чистый сигнал" },
    { key: "double", name: "Двойной", description: "Два коротких импульса" },
];

type Tone = { frequency: number; offset: number; duration: number; gain: number; wave?: OscillatorType };

const tones: Record<Exclude<NotificationSoundKey, "custom">, Tone[]> = {
    default: [
        { frequency: 784, offset: 0, duration: 0.12, gain: 0.22 },
        { frequency: 1175, offset: 0.1, duration: 0.18, gain: 0.2 },
    ],
    soft: [
        { frequency: 523, offset: 0, duration: 0.2, gain: 0.13 },
        { frequency: 659, offset: 0.12, duration: 0.24, gain: 0.11 },
    ],
    chime: [
        { frequency: 1047, offset: 0, duration: 0.28, gain: 0.16, wave: "triangle" },
        { frequency: 1568, offset: 0.08, duration: 0.34, gain: 0.12, wave: "triangle" },
    ],
    double: [
        { frequency: 880, offset: 0, duration: 0.09, gain: 0.18, wave: "square" },
        { frequency: 880, offset: 0.16, duration: 0.09, gain: 0.18, wave: "square" },
    ],
};

let context: AudioContext | null = null;
let unlockInstalled = false;

function audioContext() {
    if (!context) context = new AudioContext();
    return context;
}

export function installNotificationAudioUnlock() {
    if (unlockInstalled || typeof document === "undefined") return;
    unlockInstalled = true;
    const unlock = () => {
        const current = audioContext();
        if (current.state === "suspended") void current.resume();
        document.removeEventListener("pointerdown", unlock);
        document.removeEventListener("keydown", unlock);
    };
    document.addEventListener("pointerdown", unlock, { once: true });
    document.addEventListener("keydown", unlock, { once: true });
}

async function playBuiltIn(sound: Exclude<NotificationSoundKey, "custom">, volume: number) {
    const current = audioContext();
    if (current.state === "suspended") await current.resume().catch(() => undefined);
    if (current.state !== "running") return;

    const start = current.currentTime + 0.01;
    for (const tone of tones[sound]) {
        const oscillator = current.createOscillator();
        const gain = current.createGain();
        const toneStart = start + tone.offset;
        const toneEnd = toneStart + tone.duration;
        oscillator.type = tone.wave ?? "sine";
        oscillator.frequency.setValueAtTime(tone.frequency, toneStart);
        gain.gain.setValueAtTime(0.0001, toneStart);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, tone.gain * volume), toneStart + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, toneEnd);
        oscillator.connect(gain);
        gain.connect(current.destination);
        oscillator.start(toneStart);
        oscillator.stop(toneEnd + 0.02);
    }
}

export async function playNotificationSound(settings: NotificationSoundSettings, force = false) {
    if (!force && !settings.enabled) return;
    const volume = Math.min(1, Math.max(0, settings.volume));
    if (settings.sound === "custom") {
        if (!settings.customUrl) return;
        const audio = new Audio(settings.customUrl);
        audio.volume = volume;
        await audio.play().catch(() => undefined);
        return;
    }
    await playBuiltIn(settings.sound, volume);
}

export function announceNotificationSoundSettings(settings: NotificationSoundSettings) {
    window.dispatchEvent(new CustomEvent<NotificationSoundSettings>(notificationSoundSettingsEvent, { detail: settings }));
}
