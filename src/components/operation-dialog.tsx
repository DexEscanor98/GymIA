'use client';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
export type Field = {
  name: string;
  label: string;
  type?:
    | 'text'
    | 'email'
    | 'number'
    | 'select'
    | 'checkbox'
    | 'password'
    | 'search-select'
    | 'date'
    | 'datetime-local'
    | 'time'
    | 'color'
    | 'textarea';
  value?: string | number | boolean;
  options?: { value: string; label: string }[];
  required?: boolean;
  min?: number;
  max?: number;
  step?: string;
  hint?: string;
};
export type DialogSpec = {
  title: string;
  description?: string;
  fields: Field[];
  submit: string;
  danger?: boolean;
  onSubmit: (data: Record<string, string | boolean>) => Promise<void>;
};
export function OperationDialog({ spec, onClose }: { spec: DialogSpec; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const data: Record<string, string | boolean> = {};
    spec.fields.forEach((f) => {
      if (f.type === 'checkbox') {
        data[f.name] = fd.has(f.name);
        return;
      }
      const raw = String(fd.get(f.name) || '');
      if (f.type === 'search-select') {
        data[f.name] = f.options?.find((o) => o.label === raw || o.value === raw)?.value || raw;
        return;
      }
      data[f.name] = raw;
    });
    try {
      await spec.onSubmit(data);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
    >
      <div className="dialog-head">
        <h2>{spec.title}</h2>
        <button className="icon-button" aria-label="Cerrar" onClick={onClose} disabled={busy}>
          <X />
        </button>
      </div>
      {spec.description && <p className="muted">{spec.description}</p>}
      <form onSubmit={submit}>
        <div className="form-fields">
          {spec.fields.map((f) => (
            <label key={f.name} className={f.type === 'checkbox' ? 'check-label' : ''}>
              {f.type === 'checkbox' ? (
                <>
                  <input
                    type="checkbox"
                    name={f.name}
                    defaultChecked={Boolean(f.value)}
                    required={f.required}
                  />
                  {f.label}
                </>
              ) : (
                <>
                  {f.label}
                  {f.type === 'search-select' ? (
                    <>
                      <input
                        name={f.name}
                        list={`${f.name}-options`}
                        defaultValue={
                          f.options?.find((o) => o.value === String(f.value ?? ''))?.label ||
                          String(f.value ?? '')
                        }
                        required={f.required !== false}
                        placeholder="Escribe para buscar..."
                      />
                      <datalist id={`${f.name}-options`}>
                        {f.options?.map((o) => (
                          <option key={o.value} value={o.label} />
                        ))}
                      </datalist>
                    </>
                  ) : f.type === 'select' ? (
                    <select
                      name={f.name}
                      defaultValue={String(f.value ?? '')}
                      required={f.required !== false}
                    >
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea
                      name={f.name}
                      defaultValue={String(f.value ?? '')}
                      required={f.required !== false}
                      maxLength={1000}
                    />
                  ) : (
                    <input
                      name={f.name}
                      type={f.type || 'text'}
                      defaultValue={String(f.value ?? '')}
                      required={f.required !== false}
                      min={f.min}
                      max={f.max}
                      step={f.step}
                    />
                  )}
                </>
              )}
              {f.hint && <small>{f.hint}</small>}
            </label>
          ))}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="button secondary" onClick={onClose} disabled={busy}>
            Volver
          </button>
          <button className={`button ${spec.danger ? 'danger' : 'primary'}`} disabled={busy}>
            {busy ? 'Guardando…' : spec.submit}
          </button>
        </div>
      </form>
    </dialog>
  );
}
