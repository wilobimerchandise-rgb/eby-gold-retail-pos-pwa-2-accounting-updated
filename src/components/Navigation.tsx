import type { LucideIcon } from "lucide-react";

import {
  ShoppingCart,
  Package,
  MessageCircle,
  Tags,
  Wallet,
} from "lucide-react";

/**
 * All application navigation tabs.
 *
 * Keep this type synchronized with App.tsx.
 */
export type TabId =
  | "pos"
  | "inventory"
  | "whatsapp"
  | "price"
  | "debt";

interface NavigationTab {
  id: TabId;
  label: string;
  icon: LucideIcon;
}

/**
 * Permanent application navigation.
 *
 * IMPORTANT:
 * When new modules are added, add them here instead of
 * conditionally hiding buttons elsewhere.
 */
export const TABS: NavigationTab[] = [
  {
    id: "pos",
    label: "POS & Sales",
    icon: ShoppingCart,
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: Package,
  },
  {
    id: "whatsapp",
    label: "WhatsApp AI",
    icon: MessageCircle,
  },
  {
    id: "price",
    label: "Price Engine",
    icon: Tags,
  },
  {
    id: "debt",
    label: "Debt Tracker",
    icon: Wallet,
  },
];

interface NavProps {
  tab: TabId;
  onChange: (tab: TabId) => void;
}

export function Navigation({
  tab,
  onChange,
}: NavProps) {
  return (
    <>
      {/* ========================================= */}
      {/* DESKTOP SIDEBAR */}
      {/* ========================================= */}

      <aside className="hidden lg:flex flex-col w-60 bg-indigo-700 text-white shrink-0 h-screen sticky top-0">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-indigo-600">
          <h1 className="font-bold text-lg leading-tight">
            Eby-Gold
          </h1>

          <p className="text-xs text-indigo-200">
            Superstores POS
          </p>
        </div>

        {/* Navigation */}
        <nav
          className="flex-1 px-3 py-4 space-y-1 overflow-y-auto"
          aria-label="Main navigation"
        >
          {TABS.map((item) => {
            const Icon = item.icon;

            const active =
              tab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all ${
                  active
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-indigo-100 hover:bg-indigo-600 hover:text-white"
                }`}
                aria-current={
                  active
                    ? "page"
                    : undefined
                }
              >
                <Icon
                  size={20}
                  strokeWidth={
                    active ? 2.4 : 2
                  }
                />

                <span>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="px-5 py-4 border-t border-indigo-600">
          <p className="text-[10px] text-indigo-300">
            Eby-Gold Retail System
          </p>

          <p className="text-[10px] text-indigo-400 mt-0.5">
            Inventory • Sales • Pricing
          </p>
        </div>
      </aside>

      {/* ========================================= */}
      {/* MOBILE BOTTOM NAVIGATION */}
      {/* ========================================= */}

      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] z-30"
        aria-label="Mobile navigation"
      >
        <div className="grid grid-cols-5">
          {TABS.map((item) => {
            const Icon = item.icon;

            const active =
              tab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                className={`relative flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 transition-colors ${
                  active
                    ? "text-indigo-600"
                    : "text-slate-500"
                }`}
                aria-current={
                  active
                    ? "page"
                    : undefined
                }
              >
                {/* Active indicator */}
                {active && (
                  <span className="absolute top-0 h-0.5 w-8 bg-indigo-600 rounded-full" />
                )}

                <Icon
                  size={21}
                  strokeWidth={
                    active ? 2.4 : 2
                  }
                />

                <span
                  className={`text-[9px] sm:text-[10px] font-semibold truncate max-w-full ${
                    active
                      ? "text-indigo-600"
                      : "text-slate-500"
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
