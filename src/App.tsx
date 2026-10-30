
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

  const [settings, setSettings] =
    useState<AppSettings>(DEFAULT_SETTINGS);

  /**
   * Persist the currently selected page.
   */
  useEffect(() => {
    localStorage.setItem("eby-tab", tab);
  }, [tab]);

  /**
   * Initialize the application.
   */
  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      try {
        /**
         * Ensure application settings exist.
         */
        await ensureDefaultSettings();

        /**
         * Seed initial data only when the
         * local database is empty.
         */
        await seedIfEmpty();

        /**
         * Load saved business settings.
         */
        const loadedSettings = await loadSettings();

        if (!cancelled) {
          setSettings(loadedSettings);
        }
      } catch (error) {
        console.error(
          "Eby-Gold initialization failed:",
          error,
        );
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    };

    initialize();

    /**
     * Network status listeners.
     */
    const handleOnline = () => {
      setOnline(true);
    };

    const handleOffline = () => {
      setOnline(false);
    };

    window.addEventListener(
      "online",
      handleOnline,
    );

    window.addEventListener(
      "offline",
      handleOffline,
    );

    return () => {
      cancelled = true;

      window.removeEventListener(
        "online",
        handleOnline,
      );

      window.removeEventListener(
        "offline",
        handleOffline,
      );
    };
  }, []);

  /**
   * Application loading screen.
   */
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-3">
          <Store
            className="text-indigo-600 animate-pulse"
            size={48}
          />

          <p className="text-slate-500 font-medium">
            Loading Eby-Gold Superstores...
          </p>
        </div>
      </div>
    );
  }

  return (
    <CartProvider>
      <div className="min-h-screen bg-slate-100 flex">
        {/* Global notifications */}
        <ToastHost />

        {/* Application navigation */}
        <Navigation
          tab={tab}
          onChange={setTab}
        />

        <div className="flex-1 flex flex-col min-w-0">
          {/* ========================================= */}
          {/* MOBILE HEADER */}
          {/* ========================================= */}

          <header className="lg:hidden bg-indigo-700 text-white shadow-md sticky top-0 z-20">
            <div className="px-4 h-14 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-white/15 p-1.5 rounded-lg">
                  <Store size={22} />
                </div>

                <div className="leading-tight">
                  <h1 className="font-bold text-base">
                    {settings.businessName}
                  </h1>

                  <p className="text-[11px] text-indigo-200">
                    POS Super-App
                  </p>
                </div>
              </div>

              {/* Network status */}
              <div
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                  online
                    ? "bg-emerald-400/20 text-emerald-100"
                    : "bg-amber-400/20 text-amber-100"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    online
                      ? "bg-emerald-300"
                      : "bg-amber-300"
                  }`}
                />

                {online ? "Online" : "Offline"}
              </div>
            </div>
          </header>

          {/* ========================================= */}
          {/* DESKTOP HEADER */}
          {/* ========================================= */}

          <header className="hidden lg:flex items-center justify-between px-6 h-14 bg-white border-b border-slate-200 sticky top-0 z-20">
            <div>
              <h2 className="font-bold text-slate-900">
                {settings.businessName}
              </h2>
            </div>

            {/* Network status */}
            <div
              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                online
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  online
                    ? "bg-emerald-500"
                    : "bg-amber-500"
                }`}
              />

              {online ? "Online" : "Offline"}
            </div>
          </header>

          {/* ========================================= */}
          {/* MAIN APPLICATION CONTENT */}
          {/* ========================================= */}

          <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 pb-24 lg:pb-6">
            {/* POS & SALES */}
            {tab === "pos" && (
              <PosPage />
            )}

            {/* INVENTORY MANAGEMENT */}
            {tab === "inventory" && (
              <InventoryPage />
            )}

            {/* WHATSAPP AI */}
            {tab === "whatsapp" && (
              <WhatsAppPage
                online={online}
                onGoToPos={() => setTab("pos")}
              />
            )}

            {/* PRICE ENGINE */}
            {tab === "price" && (
              <PriceEnginePage />
            )}

            {/* DEBT TRACKER */}
            {tab === "debt" && (
              <DebtTrackerPage />
            )}
          </main>
        </div>
      </div>
    </CartProvider>
  );
}

/**
 * Root application component.
 */
export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
