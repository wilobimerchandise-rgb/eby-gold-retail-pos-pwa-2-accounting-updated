import type { LucideIcon } from "lucide-react";

interface PlaceholderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  accent: "indigo" | "emerald" | "amber" | "rose";
}

const ACCENTS: Record<PlaceholderProps["accent"], string> = {
  indigo: "bg-indigo-50 text-indigo-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  rose: "bg-rose-50 text-rose-600",
};

export function Placeholder({ icon: Icon, title, description, accent }: PlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade">
      <div className={`rounded-2xl p-5 mb-4 ${ACCENTS[accent]}`}>
        <Icon size={40} />
      </div>
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-500 max-w-sm mt-1">{description}</p>
      <div className="mt-6 text-sm text-slate-400 font-medium">Coming in a later phase</div>
    </div>
  );
}
