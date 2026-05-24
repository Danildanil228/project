import type { UserFormState } from "../../types/admin";

type CreateUserFormProps = {
    form: UserFormState;
    roleOptions: string[];
    onChange: (form: UserFormState) => void;
    onSubmit: () => void;
};

export function CreateUserForm({ form, roleOptions, onChange, onSubmit }: CreateUserFormProps) {
    return (
        <form
            className="create-user"
            onSubmit={(event) => {
                event.preventDefault();
                onSubmit();
            }}
        >
            <h3>Создать пользователя</h3>
            <div className="form-grid">
                <label>
                    Имя
                    <input value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} required />
                </label>
                <label>
                    Email
                    <input type="email" value={form.email} onChange={(event) => onChange({ ...form, email: event.target.value })} required />
                </label>
                <label>
                    Пароль
                    <input
                        type="password"
                        minLength={8}
                        value={form.password}
                        onChange={(event) => onChange({ ...form, password: event.target.value })}
                    />
                </label>
                <label>
                    Роль
                    <select value={form.role} onChange={(event) => onChange({ ...form, role: event.target.value })}>
                        {roleOptions.map((role) => (
                            <option key={role} value={role}>
                                {role}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <button className="primary" type="submit">
                Добавить
            </button>
        </form>
    );
}
