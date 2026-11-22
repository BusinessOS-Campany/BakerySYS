"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n/dictionary";

export type DialogTone = "primary" | "danger";

export type AlertOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  tone?: DialogTone;
};

export type ConfirmOptions = AlertOptions & {
  cancelLabel?: string;
};

export type PromptOptions = ConfirmOptions & {
  defaultValue?: string;
  inputLabel?: string;
  inputType?: "text" | "number";
  placeholder?: string;
};

type DialogRequest = {
  kind: "alert" | "confirm" | "prompt";
  options: AlertOptions | ConfirmOptions | PromptOptions;
  resolve: (value: boolean | string | null) => void;
};

type DialogApi = {
  alert: (options: AlertOptions | string) => Promise<void>;
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
};

const DialogContext = createContext<DialogApi | null>(null);

function normalize<T extends AlertOptions>(input: T | string): T {
  return typeof input === "string" ? { message: input } as T : input;
}

/** Global in-app modal host. Replaces native alert/confirm/prompt dialogs. */
export function DialogProvider({ children, locale }: { children: ReactNode; locale: Locale }) {
  const [current, setCurrent] = useState<DialogRequest | null>(null);
  const [value, setValue] = useState("");
  const active = useRef<DialogRequest | null>(null);
  const queue = useRef<DialogRequest[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const show = useCallback((request: DialogRequest) => {
    if (active.current) {
      queue.current.push(request);
      return;
    }
    active.current = request;
    setCurrent(request);
    setValue(request.kind === "prompt" ? (request.options as PromptOptions).defaultValue ?? "" : "");
  }, []);

  const finish = useCallback((result: boolean | string | null) => {
    const request = active.current;
    active.current = null;
    request?.resolve(result);
    const next = queue.current.shift() ?? null;
    if (next) {
      active.current = next;
      setCurrent(next);
      setValue(next.kind === "prompt" ? (next.options as PromptOptions).defaultValue ?? "" : "");
    } else {
      setCurrent(null);
    }
  }, []);

  const api: DialogApi = {
    alert: (input) => new Promise<void>((resolve) => {
      show({ kind: "alert", options: normalize(input), resolve: () => resolve() });
    }),
    confirm: (input) => new Promise<boolean>((resolve) => {
      show({ kind: "confirm", options: normalize(input), resolve: (result) => resolve(Boolean(result)) });
    }),
    prompt: (options) => new Promise<string | null>((resolve) => {
      show({ kind: "prompt", options, resolve: (result) => resolve(typeof result === "string" ? result : null) });
    }),
  };

  const dismiss = useCallback(() => {
    if (!active.current) return;
    finish(active.current.kind === "confirm" ? false : null);
  }, [finish]);

  const submit = useCallback(() => {
    if (!active.current) return;
    finish(active.current.kind === "confirm" ? true : active.current.kind === "alert" ? true : value);
  }, [finish, value]);

  useEffect(() => {
    if (!current) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, dismiss]);

  useEffect(() => {
    if (current?.kind === "prompt") inputRef.current?.focus();
  }, [current]);

  useEffect(() => {
    if (!current) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [current]);

  const options = current?.options;
  const kind = current?.kind;
  const defaultTitle = kind === "confirm"
    ? (locale === "ar" ? "تأكيد الإجراء" : "Confirm action")
    : kind === "prompt"
      ? (locale === "ar" ? "إدخال قيمة" : "Enter value")
      : (locale === "ar" ? "تنبيه" : "Notice");
  const confirmLabel = options?.confirmLabel ?? (locale === "ar" ? "تأكيد" : "Confirm");
  const cancelLabel = locale === "ar" ? "إلغاء" : "Cancel";

  return (
    <DialogContext.Provider value={api}>
      {children}
      {current && options ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => { if (event.target === event.currentTarget) dismiss(); }}
        >
          <div
            aria-labelledby="app-dialog-title"
            aria-modal="true"
            className="card w-full max-w-md space-y-4 p-5 shadow-2xl"
            role="dialog"
          >
            <h2 className="text-lg font-bold" id="app-dialog-title">{options.title ?? defaultTitle}</h2>
            <p className="whitespace-pre-line text-sm text-[var(--text-muted)]">{options.message}</p>
            {kind === "prompt" ? (
              <label className="block space-y-1">
                {(options as PromptOptions).inputLabel ? (
                  <span className="text-sm font-medium">{(options as PromptOptions).inputLabel}</span>
                ) : null}
                <input
                  className="input w-full"
                  onChange={(event) => setValue(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") submit(); }}
                  placeholder={(options as PromptOptions).placeholder}
                  ref={inputRef}
                  type={(options as PromptOptions).inputType ?? "text"}
                  value={value}
                />
              </label>
            ) : null}
            <div className="flex justify-end gap-2">
              {kind !== "alert" ? (
                <button className="btn btn-secondary" onClick={dismiss} type="button">{cancelLabel}</button>
              ) : null}
              <button
                className={options.tone === "danger" ? "btn btn-danger" : "btn btn-primary"}
                onClick={submit}
                type="button"
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DialogContext.Provider>
  );
}

/** Returns the global modal API. Falls back to native dialogs outside the provider. */
export function useDialog(): DialogApi {
  const context = useContext(DialogContext);
  if (context) return context;
  return {
    alert: async (input) => { window.alert(typeof input === "string" ? input : input.message); },
    confirm: async (input) => window.confirm(typeof input === "string" ? input : input.message),
    prompt: async (options) => window.prompt(options.message, options.defaultValue ?? ""),
  };
}
