import { useCallback, useState } from "react";

type ConfirmTone = "default" | "danger";

type ConfirmRequest = {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    tone?: ConfirmTone;
};

type PendingConfirm = ConfirmRequest & {
    resolve: (value: boolean) => void;
};

export function useConfirmDialog() {
    const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

    const confirm = useCallback((request: ConfirmRequest) => {
        return new Promise<boolean>((resolve) => {
            setPendingConfirm({ ...request, resolve });
        });
    }, []);

    const close = useCallback(
        (value: boolean) => {
            pendingConfirm?.resolve(value);
            setPendingConfirm(null);
        },
        [pendingConfirm],
    );

    const dialog = pendingConfirm ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => close(false)}>
            <section
                aria-modal="true"
                className="confirm-dialog"
                role="dialog"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <h2>{pendingConfirm.title}</h2>
                <p>{pendingConfirm.message}</p>
                <div className="actions-row">
                    <button className="secondary" type="button" onClick={() => close(false)}>
                        {pendingConfirm.cancelText ?? "Отмена"}
                    </button>
                    <button
                        className={pendingConfirm.tone === "danger" ? "danger" : "primary"}
                        type="button"
                        onClick={() => close(true)}
                    >
                        {pendingConfirm.confirmText ?? "Подтвердить"}
                    </button>
                </div>
            </section>
        </div>
    ) : null;

    return { confirm, dialog };
}
