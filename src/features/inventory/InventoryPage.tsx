import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  Archive,
  ArrowLeftRight,
  Boxes,
  ClipboardList,
  Package,
  Plus,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";

import type { Product } from "@/types";

import { naira } from "@/lib/money";

import {
  getInventoryProducts,
  getInventoryStats,
} from "./inventory-service";

import type { InventoryStats } from "./types";

import StockAdjustmentModal from "./StockAdjustmentModal";
import StockMovementsPage from "./StockMovementsPage";

interface InventoryPageProps {
  onBack?: () => void;
}

export function InventoryPage({
  onBack,
}: InventoryPageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] =
    useState<InventoryStats | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [query, setQuery] = useState("");

  const [adjustmentOpen, setAdjustmentOpen] =
    useState(false);

  const [selectedProductId, setSelectedProductId] =
    useState<string | undefined>(undefined);

  const [showMovements, setShowMovements] =
    useState(false);

  /**
   * Load inventory products and statistics.
   */
  const refresh = useCallback(
    async (showRefreshState = false) => {
      try {
        if (showRefreshState) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const [
          inventoryProducts,
          inventoryStats,
        ] = await Promise.all([
          getInventoryProducts(),
          getInventoryStats(),
        ]);

        setProducts(inventoryProducts);
        setStats(inventoryStats);
      } catch (error) {
        console.error(
          "Failed to load inventory:",
          error,
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  /**
   * Initial inventory load.
   */
  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * Search products by:
   * - name
   * - SKU
   * - barcode
   */
  const filteredProducts = useMemo(() => {
    const normalizedQuery =
      query.trim().toLowerCase();

    if (!normalizedQuery) {
      return products;
    }

    return products.filter((product) => {
      const name =
        product.name?.toLowerCase() ?? "";

      const sku =
        product.sku?.toLowerCase() ?? "";

      const barcode =
        product.barcode?.toLowerCase() ?? "";

      return (
        name.includes(normalizedQuery) ||
        sku.includes(normalizedQuery) ||
        barcode.includes(normalizedQuery)
      );
    });
  }, [products, query]);

  /**
   * Open stock adjustment modal.
   */
  const openAdjustment = useCallback(
    (productId?: string) => {
      setSelectedProductId(productId);
      setAdjustmentOpen(true);
    },
    [],
  );

  /**
   * Close stock adjustment modal.
   */
  const closeAdjustment = useCallback(() => {
    setAdjustmentOpen(false);
    setSelectedProductId(undefined);
  }, []);

  /**
   * Refresh inventory after successful adjustment.
   */
  const handleAdjustmentComplete =
    useCallback(async () => {
      closeAdjustment();
      await refresh(true);
    }, [closeAdjustment, refresh]);

  /**
   * Determine product stock state.
   */
  const getStockState = useCallback(
    (product: Product) => {
      const quantity = Number(
        product.stockQuantity ?? 0,
      );

      const threshold = Number(
        product.lowStockThreshold ?? 0,
      );

      if (quantity <= 0) {
        return "out";
      }

      if (quantity <= threshold) {
        return "low";
      }

      return "healthy";
    },
    [],
  );

  /**
   * Inventory movement screen.
   */
  if (showMovements) {
    return (
      <StockMovementsPage
        onBack={() => setShowMovements(false)}
      />
    );
  }

  return (
    <div className="min-h-full bg-slate-50">
      {/* =====================================================
          PAGE HEADER
      ====================================================== */}

      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="mt-1 rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                  aria-label="Go back"
                >
                  ←
                </button>
              )}

              <div>
                <div className="flex items-center gap-2">
                  <Boxes className="h-6 w-6 text-slate-700" />

                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    Inventory
                  </h1>
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  Manage stock levels, adjustments
                  and inventory movements.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void refresh(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    refreshing
                      ? "animate-spin"
                      : ""
                  }`}
                />

                Refresh
              </button>

              <button
                type="button"
                onClick={() =>
                  setShowMovements(true)
                }
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <ArrowLeftRight className="h-4 w-4" />

                Movements
              </button>

              <button
                type="button"
                onClick={() => openAdjustment()}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />

                Adjust Stock
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================
          MAIN CONTENT
      ====================================================== */}

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* ===================================================
            SUMMARY CARDS
        ==================================================== */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Products */}

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Products
                </p>

                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {stats?.activeProducts ?? 0}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Active products
                </p>
              </div>

              <div className="rounded-lg bg-slate-100 p-2.5">
                <Package className="h-5 w-5 text-slate-700" />
              </div>
            </div>
          </div>

          {/* Stock Units */}

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Stock Units
                </p>

                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {stats?.totalStockUnits ?? 0}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Units currently in stock
                </p>
              </div>

              <div className="rounded-lg bg-slate-100 p-2.5">
                <Archive className="h-5 w-5 text-slate-700" />
              </div>
            </div>
          </div>

          {/* Low Stock */}

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-amber-700">
                  Low Stock
                </p>

                <p className="mt-2 text-2xl font-bold text-amber-900">
                  {stats?.lowStockProducts ?? 0}
                </p>

                <p className="mt-1 text-xs text-amber-700">
                  Products requiring attention
                </p>
              </div>

              <div className="rounded-lg bg-amber-100 p-2.5">
                <AlertTriangle className="h-5 w-5 text-amber-700" />
              </div>
            </div>
          </div>

          {/* Out of Stock */}

          <div className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-red-700">
                  Out of Stock
                </p>

                <p className="mt-2 text-2xl font-bold text-red-900">
                  {stats?.outOfStockProducts ?? 0}
                </p>

                <p className="mt-1 text-xs text-red-700">
                  Products with no stock
                </p>
              </div>

              <div className="rounded-lg bg-red-100 p-2.5">
                <XCircle className="h-5 w-5 text-red-700" />
              </div>
            </div>
          </div>
        </div>

        {/* ===================================================
            INVENTORY VALUE
        ==================================================== */}

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Cost Value */}

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Inventory Cost Value
            </p>

            <p className="mt-2 text-xl font-bold text-slate-900">
              {naira(
                stats?.inventoryCostValueKobo ?? 0,
              )}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Estimated value at cost price
            </p>
          </div>

          {/* Selling Value */}

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Inventory Selling Value
            </p>

            <p className="mt-2 text-xl font-bold text-slate-900">
              {naira(
                stats?.inventorySellingValueKobo ?? 0,
              )}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Estimated value at current selling price
            </p>
          </div>

          {/* Potential Profit */}

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-emerald-700">
              Potential Gross Profit
            </p>

            <p className="mt-2 text-xl font-bold text-emerald-900">
              {naira(
                stats?.potentialGrossProfitKobo ?? 0,
              )}
            </p>

            <p className="mt-1 text-xs text-emerald-700">
              Based on current stock and selling prices
            </p>
          </div>
        </div>

        {/* ===================================================
            SEARCH + PRODUCT LIST
        ==================================================== */}

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4 sm:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-slate-700" />

                  <h2 className="text-lg font-semibold text-slate-900">
                    Stock Items
                  </h2>
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  {filteredProducts.length}{" "}
                  {filteredProducts.length === 1
                    ? "product"
                    : "products"}{" "}
                  displayed
                </p>
              </div>

              <div className="relative w-full md:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  type="search"
                  value={query}
                  onChange={(event) =>
                    setQuery(event.target.value)
                  }
                  placeholder="Search name, SKU or barcode..."
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>
            </div>
          </div>

          {/* Loading */}

          {loading ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-slate-500">
                <RefreshCw className="h-6 w-6 animate-spin" />

                <p className="text-sm">
                  Loading inventory...
                </p>
              </div>
            </div>
          ) : filteredProducts.length === 0 ? (
            /* Empty */

            <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
              <div className="rounded-full bg-slate-100 p-4">
                <Package className="h-8 w-8 text-slate-400" />
              </div>

              <h3 className="mt-4 text-base font-semibold text-slate-900">
                {query
                  ? "No matching products"
                  : "No inventory products"}
              </h3>

              <p className="mt-1 max-w-md text-sm text-slate-500">
                {query
                  ? "Try a different product name, SKU or barcode."
                  : "Products will appear here once they are added to the store."}
              </p>

              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="mt-4 text-sm font-medium text-slate-700 underline underline-offset-4 hover:text-slate-900"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            /* Product list */

            <div className="divide-y divide-slate-100">
              {filteredProducts.map((product) => {
                const stockState =
                  getStockState(product);

                const quantity = Number(
                  product.stockQuantity ?? 0,
                );

                const threshold = Number(
                  product.lowStockThreshold ?? 0,
                );

                return (
                  <div
                    key={product.id}
                    className="p-4 transition hover:bg-slate-50 sm:p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      {/* Product */}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded-lg bg-slate-100 p-2.5">
                            <Package className="h-5 w-5 text-slate-600" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate font-semibold text-slate-900">
                                {product.name}
                              </h3>

                              {!product.active && (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                                  Inactive
                                </span>
                              )}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                              <span>
                                SKU:{" "}
                                <span className="font-medium text-slate-700">
                                  {product.sku || "—"}
                                </span>
                              </span>

                              {product.barcode && (
                                <span>
                                  Barcode:{" "}
                                  <span className="font-medium text-slate-700">
                                    {product.barcode}
                                  </span>
                                </span>
                              )}

                              {product.categoryName && (
                                <span>
                                  Category:{" "}
                                  <span className="font-medium text-slate-700">
                                    {product.categoryName}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Stock information */}

                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:min-w-[420px] lg:grid-cols-3">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Stock
                          </p>

                          <div className="mt-1 flex items-center gap-2">
                            <span
                              className={`text-lg font-bold ${
                                stockState === "out"
                                  ? "text-red-700"
                                  : stockState === "low"
                                    ? "text-amber-700"
                                    : "text-slate-900"
                              }`}
                            >
                              {quantity}
                            </span>

                            {product.unit && (
                              <span className="text-xs text-slate-500">
                                {product.unit}
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Reorder Level
                          </p>

                          <p className="mt-1 text-sm font-semibold text-slate-700">
                            {threshold}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Status
                          </p>

                          <div className="mt-1">
                            {stockState === "out" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                                <XCircle className="h-3.5 w-3.5" />
                                Out of stock
                              </span>
                            ) : stockState === "low" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Low stock
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                <Boxes className="h-3.5 w-3.5" />
                                In stock
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Adjustment */}

                      <div className="lg:ml-4">
                        <button
                          type="button"
                          onClick={() =>
                            openAdjustment(
                              product.id,
                            )
                          }
                          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 lg:w-auto"
                        >
                          <Plus className="h-4 w-4" />

                          Adjust
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* =====================================================
          STOCK ADJUSTMENT MODAL
      ====================================================== */}

      {adjustmentOpen && (
        <StockAdjustmentModal
          open={adjustmentOpen}
          onClose={closeAdjustment}
          onSuccess={handleAdjustmentComplete}
          initialProductId={selectedProductId}
        />
      )}
    </div>
  );
}

export default InventoryPage;
