
import { useEffect, useState } from "react";
import { Store } from "lucide-react";

import { Navigation, type TabId } from "@/components/Navigation";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastHost } from "@/components/Toast";

import { ensureDefaultSettings, loadSettings } from "@/db/database";
import { seedIfEmpty } from "@/db/seed";

import { DEFAULT_SETTINGS, type AppSettings } from "@/types";

import { PosPage } from "@/features/pos/PosPage";
import { CartProvider } from "@/features/pos/cart-context";
import { InventoryPage } from "@/features/inventory/InventoryPage";

import { WhatsAppPage } from "@/WhatsAppPage";
import { PriceEnginePage } from "@/PriceEnginePage";
import { DebtTrackerPage } from "@/DebtTrackerPage";

import { ProtectedApp } from "@/features/auth/ProtectedApp";

function AppInner() {
  const [tab, setTab] = useState<TabId>(() => {
    const savedTab = localStorage.getItem("eby-tab");

    if (
      savedTab === "pos" ||
      savedTab === "inventory" ||
      savedTab === "whatsapp" ||
      savedTab === "price" ||
      savedTab === "debt"
    ) {
      return savedTab;
    }

    return "pos";
  });

  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem("eby-tab", tab);
  }, [tab]);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      try {
        await ensureDefaultSettings();
        await seedIfEmpty();

        const loadedSettings = await loadSettings();

        if (!cancelled) {
          setSettings(loadedSettings);
          setInitializationError(null);
        }
      } catch (error) {
        console.error("Eby-Gold initialization failed:", error);

        if (!cancelled) {
          setInitializationError(
            "The local POS database could not be initialized. Please reload the application.",
          );
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    };

    void initialize();

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-3">
          <Store className="animate-pulse text-indigo-600" size={48} />
          <p className="font-medium text-slate-500">
            Loading Eby-Gold Superstores...
          </p>
        </div>
      </div>
    );
  }

  if (initializationError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-7 text-center shadow-lg">
          <h1 className="text-lg font-bold text-slate-900">
            Application initialization failed
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            {initializationError}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 w-full rounded-xl bg-indigo-700 px-4 py-3 font-bold text-white hover:bg-indigo-800"
          >
            Reload application
          </button>
        </div>
      </div>
    );
  }

  return (
    <CartProvider>
      <div className="flex min-h-screen bg-slate-100">
        <ToastHost />

        <Navigation tab={tab} onChange={setTab} />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 bg-indigo-700 text-white shadow-md lg:hidden">
            <div className="flex h-14 items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-white/15 p-1.5">
                  <Store size={22} />
                </div>

                <div className="leading-tight">
                  <h1 className="text-base font-bold">
                    {settings.businessName}
                  </h1>
                  <p className="text-[11px] text-indigo-200">
                    POS Super-App
                  </p>
                </div>
              </div>

              <div
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                  online
                    ? "bg-emerald-400/20 text-emerald-100"
                    : "bg-amber-400/20 text-amber-100"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    online ? "bg-emerald-300" : "bg-amber-300"
                  }`}
                />
                {online ? "Online" : "Offline"}
              </div>
            </div>
          </header>

          <header className="sticky top-0 z-20 hidden h-14 items-center justify-between border-b border-slate-200 bg-white px-6 lg:flex">
            <h2 className="font-bold text-slate-900">
              {settings.businessName}
            </h2>

            <div
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                online
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  online ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
              {online ? "Online" : "Offline"}
            </div>
          </header>

          <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 pb-24 sm:px-6 lg:pb-6">
            {tab === "pos" && <PosPage />}
            {tab === "inventory" && <InventoryPage />}
            {tab === "whatsapp" && (
              <WhatsAppPage
                online={online}
                onGoToPos={() => setTab("pos")}
              />
            )}
            {tab === "price" && <PriceEnginePage />}
            {tab === "debt" && <DebtTrackerPage />}
          </main>
        </div>
      </div>
    </CartProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ProtectedApp>
        <AppInner />
      </ProtectedApp>
    </ErrorBoundary>
  );
}
