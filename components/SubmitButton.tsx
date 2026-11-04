"use client";

import { useFormStatus } from "react-dom";

export default function SubmitButton({
    children,
    className = "btn btn-primary",
    pending = "Working…",
    confirm,
    formAction,
}: {
    children: React.ReactNode;
    className?: string;
    pending?: string;
    confirm?: string;
    formAction?: (formData: FormData) => void | Promise<void>;
}) {
    const { pending: busy } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={busy}
            formAction={formAction}
            formNoValidate={!!formAction}
            className={`${className} disabled:opacity-50`}
            onClick={(e) => {
                if (confirm && !window.confirm(confirm)) e.preventDefault();
            }}
        >
            {busy ? pending : children}
        </button>
    );
}
