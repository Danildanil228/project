export type SessionDeviceType = "desktop" | "mobile" | "tablet";

export type SessionClientInfo = {
    browser: string;
    operatingSystem: string;
    deviceType: SessionDeviceType;
    title: string;
};

function version(value?: string) {
    return value?.replaceAll("_", ".");
}

function browserName(userAgent: string) {
    const browsers: Array<[RegExp, string]> = [
        [/Edg(?:A|iOS)?\/([\d.]+)/, "Microsoft Edge"],
        [/OPR\/([\d.]+)/, "Opera"],
        [/YaBrowser\/([\d.]+)/, "Яндекс Браузер"],
        [/SamsungBrowser\/([\d.]+)/, "Samsung Internet"],
        [/FxiOS\/([\d.]+)/, "Firefox"],
        [/Firefox\/([\d.]+)/, "Firefox"],
        [/CriOS\/([\d.]+)/, "Google Chrome"],
        [/Chrome\/([\d.]+)/, "Google Chrome"],
        [/Version\/([\d.]+).*Safari\//, "Safari"],
    ];

    for (const [pattern, name] of browsers) {
        const match = userAgent.match(pattern);
        if (match?.[1]) return `${name} ${match[1]}`;
    }

    return "Неизвестный браузер";
}

export function sessionClientInfo(userAgent?: string | null): SessionClientInfo {
    if (!userAgent) {
        return {
            browser: "Браузер не определён",
            operatingSystem: "Устройство не определено",
            deviceType: "desktop",
            title: "Неизвестное устройство",
        };
    }

    const browser = browserName(userAgent);

    const iosVersion = version(userAgent.match(/(?:iPhone|CPU) OS ([\d_]+)/)?.[1]);
    const androidVersion = userAgent.match(/Android ([\d.]+)/)?.[1];
    const macVersion = version(userAgent.match(/Mac OS X ([\d_]+)/)?.[1]);
    const windowsVersion = userAgent.match(/Windows NT ([\d.]+)/)?.[1];
    const windowsNames: Record<string, string> = {
        "10.0": "Windows 10/11",
        "6.3": "Windows 8.1",
        "6.2": "Windows 8",
        "6.1": "Windows 7",
    };

    const operatingSystem =
        iosVersion ? `iOS ${iosVersion}` :
        androidVersion ? `Android ${androidVersion}` :
        windowsVersion ? (windowsNames[windowsVersion] ?? "Windows") :
        macVersion ? `macOS ${macVersion}` :
        userAgent.includes("Linux") ? "Linux" :
        "Неизвестная ОС";

    const deviceType: SessionDeviceType =
        /iPad|Tablet/i.test(userAgent) ? "tablet" :
        /iPhone|Mobile/i.test(userAgent) ? "mobile" :
        "desktop";

    return {
        browser,
        operatingSystem,
        deviceType,
        title: `${browser} · ${operatingSystem}`,
    };
}
