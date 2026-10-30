import { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const maxW =
    size === "sm"
      ? "sm:max-w-sm"
      : size === "lg"
        ? "sm:max-w-2xl"
        : "sm:max-w-lg";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 animate-fade print:hidden"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative flex max-h-[92vh] w-full ${maxW} flex-col rounded-t-2xl bg-white shadow-2xl animate-pop sm:rounded-2xl print:static print:block print:max-h-none print:w-auto print:max-w-none print:rounded-none print:bg-white print:shadow-none`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 print:hidden">
          <h2 className="text-lg font-bold text-slate-900">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 print:overflow-visible print:p-0">
          {children}
        </div>

        {/* Modal Footer */}
        {footer && (
          <div className="rounded-b-2xl border-t border-slate-200 bg-slate-50 px-5 py-4 print:hidden">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
