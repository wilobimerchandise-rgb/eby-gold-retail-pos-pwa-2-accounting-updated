import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastKind = "success" | "error" | "info";
export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

let pushFn: ((kind: ToastKind, message: string) => void) | null = null;

export function toast(kind: ToastKind, message: string): void {
  pushFn?.(kind, message);
}

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    pushFn = (kind, message) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, kind, message }]);
      setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, 3500);
    };
    return () => {
      pushFn = null;
    };
  }, []);

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 w-[92%] max-w-sm">
      {toasts.map((t) => {
        const Icon =
          t.kind === "success" ? CheckCircle2 : t.kind === "error" ? AlertCircle : Info;
        const tone =
          t.kind === "success"
            ? "bg-emerald-600"
            : t.kind === "error"
            ? "bg-rose-600"
            : "bg-slate-800";
        return (
          <div
            key={t.id}
            className={`${tone} text-white px-4 py-3 rounded-xl shadow-lg flex items-start gap-2 animate-pop`}
            role="alert"
          >
            <Icon size={20} className="mt-0.5 shrink-0" />
            <p className="text-sm font-medium flex-1">{t.message}</p>
            <button
              onClick={() => setToasts((arr) => arr.filter((x) => x.id !== t.id))}
              className="text-white/80 hover:text-white"
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
