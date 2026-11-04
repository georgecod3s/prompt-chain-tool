import type { Model, Step } from "@/lib/types";

export default function StepFields({ step, models, idPrefix }: { step?: Partial<Step>; models: Model[]; idPrefix: string }) {
    return (
        <div className="grid gap-3 md:grid-cols-6">
            <label className="block text-sm md:col-span-3">
                <span className="text-muted">Step name *</span>
                <input name="name" required maxLength={80} defaultValue={step?.name ?? ""} placeholder="e.g. Describe the image" className="input mt-1" />
            </label>
            <label className="block text-sm">
                <span className="text-muted">Input</span>
                <select name="input_type" defaultValue={step?.input_type ?? "text"} className="input mt-1">
                    <option value="image">Image + prompt</option>
                    <option value="text">Text (prompt)</option>
                </select>
            </label>
            <label className="block text-sm">
                <span className="text-muted">Output</span>
                <select name="output_type" defaultValue={step?.output_type ?? "text"} className="input mt-1">
                    <option value="text">Text</option>
                    <option value="json_list">List of captions</option>
                </select>
            </label>
            <label className="block text-sm">
                <span className="text-muted">Temperature</span>
                <input name="temperature" type="number" min={0} max={2} step={0.1} defaultValue={step?.temperature ?? ""} placeholder="model default" className="input mt-1" />
            </label>
            <label className="block text-sm md:col-span-6">
                <span className="text-muted">Model</span>
                <select name="model_id" defaultValue={step?.model_id ? String(step.model_id) : ""} className="input mt-1">
                    <option value="">Default (highest-priority active model)</option>
                    {models.map((m) => (
                        <option key={m.id} value={m.id}>
                            {m.name} — {m.model_id}
                            {m.is_active ? "" : " (inactive)"}
                        </option>
                    ))}
                </select>
            </label>
            <label className="block text-sm md:col-span-6" htmlFor={`${idPrefix}-prompt`}>
                <span className="text-muted">Prompt *</span>
                <textarea
                    id={`${idPrefix}-prompt`}
                    name="prompt"
                    required
                    rows={6}
                    defaultValue={step?.prompt ?? ""}
                    placeholder={'e.g. Here is a description of a photo:\n"""{{previous}}"""\nWrite five short, funny captions. Return ONLY a JSON array of 5 strings.'}
                    className="input mt-1"
                />
                <span className="mt-1 block text-xs text-muted">
                    Placeholders: <code className="text-accent">{"{{previous}}"}</code> (last step&apos;s output),{" "}
                    <code className="text-accent">{"{{step1}}"}</code>, <code className="text-accent">{"{{step2}}"}</code>… (any earlier step),{" "}
                    <code className="text-accent">{"{{description}}"}</code>, <code className="text-accent">{"{{terms}}"}</code>,{" "}
                    <code className="text-accent">{"{{examples}}"}</code>. The last step&apos;s output becomes the captions.
                </span>
            </label>
        </div>
    );
}
