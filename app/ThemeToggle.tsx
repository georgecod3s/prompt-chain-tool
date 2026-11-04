"use client";

import { useEffect, useSyncExternalStore } from "react";

type Mode = "light" | "dark" | "system";

const OPTIONS: { mode: Mode; label: string; icon: string }[] = [
    { mode: "light", label: "Light", icon: "☀" },
    { mode: "dark", label: "Dark", icon: "☾" },
    { mode: "system", label: "System", icon: "◐" },
];

function apply(mode: Mode) {
    const dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.dataset.theme = mode;
}

// tiny store over localStorage so every toggle on the page stays in sync
const listeners = new Set<() => void>();
function read(): Mode {
    try {
        return (localStorage.getItem("theme") as Mode) || "system";
    } catch {
        return "system";
    }
}
function subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
}

export default function ThemeToggle() {
    const mode = useSyncExternalStore(subscribe, read, () => "system" as Mode);

    // follow OS changes while in system mode
    useEffect(() => {
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        const onChange = () => mode === "system" && apply("system");
        mq.addEventListener("change", onChange);
        return () => mq.removeEventListener("change", onChange);
    }, [mode]);

    const choose = (m: Mode) => {
        try {
            localStorage.setItem("theme", m);
        } catch {}
        apply(m);
        listeners.forEach((l) => l());
    };

    return (
        <div role="radiogroup" aria-label="Color theme" className="inline-flex rounded-xl border border-line bg-surface-2 p-0.5">
            {OPTIONS.map((o) => (
                <button
                    key={o.mode}
                    role="radio"
                    aria-checked={mode === o.mode}
                    title={`${o.label} mode`}
                    onClick={() => choose(o.mode)}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        mode === o.mode ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg"
                    }`}
                >
                    <span aria-hidden>{o.icon}</span>
                    <span>{o.label}</span>
                </button>
            ))}
        </div>
    );
}
