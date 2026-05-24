type AdminMessagesProps = {
    notice: string;
    error: string;
};

export function AdminMessages({ notice, error }: AdminMessagesProps) {
    if (!notice && !error) return null;

    return (
        <div className="messages">
            {notice && <p className="alert success">{notice}</p>}
            {error && <p className="alert error">{error}</p>}
        </div>
    );
}

