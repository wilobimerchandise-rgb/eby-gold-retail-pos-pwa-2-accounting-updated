import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowDownCircle,
  ArrowUpCircle,
  ClipboardList,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { db } from "@/db/database";

import type { Product } from "@/types";

import type {
  StockMovement,
  StockMovementType,
} from "./types";

import {
  getStockMovementLabel,
} from "./inventory-service";

interface StockMovementsPageProps {
  onBack?: () => void;
}

const MOVEMENT_TYPES: Array<{
  value: StockMovementType | "all";
  label: string;
}> = [
  {
    value: "all",
    label: "All movements",
  },
  {
    value: "opening_stock",
    label: "Opening Stock",
  },
  {
    value: "purchase",
    label: "Purchases",
  },
  {
    value: "sale",
    label: "Sales",
  },
  {
    value: "sale_return",
    label: "Sale Returns",
  },
  {
    value: "customer_return",
    label: "Customer Returns",
  },
  {
    value: "adjustment_in",
    label: "Stock Increase",
  },
  {
    value: "adjustment_out",
    label: "Stock Decrease",
  },
  {
    value: "damage",
    label: "Damage",
  },
  {
    value: "expired",
    label: "Expired",
  },
  {
    value: "transfer_in",
    label: "Transfer In",
  },
  {
    value: "transfer_out",
    label: "Transfer Out",
  },
  {
    value: "stock_count",
    label: "Stock Count",
  },
];

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getMovementDirection(
  type: StockMovementType,
): "increase" | "decrease" {
  switch (type) {
    case "opening_stock":
    case "purchase":
    case "sale_return":
    case "customer_return":
    case "adjustment_in":
    case "transfer_in":
      return "increase";

    case "sale":
    case "adjustment_out":
    case "damage":
    case "expired":
    case "transfer_out":
      return "decrease";

    case "stock_count":
      return "increase";

    default:
      return "increase";
  }
}

function getMovementIcon(
  type: StockMovementType,
) {
  const direction =
    getMovementDirection(type);

  if (direction === "increase") {
    return ArrowUpCircle;
  }

  return ArrowDownCircle;
}

export function StockMovementsPage({
  onBack,
}: StockMovementsPageProps) {
  const [movements, setMovements] =
    useState<StockMovement[]>([]);

  const [products, setProducts] =
    useState<Record<string, Product>>({});

  const [loading, setLoading] =
    useState(true);

  const [query, setQuery] =
    useState("");

  const [movementType, setMovementType] =
    useState<
      StockMovementType | "all"
    >("all");

  /**
   * Load stock movements and products.
   */
  const refresh = useCallback(
    async () => {
      setLoading(true);

      try {
        const [
          movementRows,
          productRows,
        ] = await Promise.all([
          db.stockMovements
            .orderBy("createdAt")
            .reverse()
            .toArray(),

          db.products.toArray(),
        ]);

        const productMap =
          productRows.reduce<
            Record<string, Product>
          >(
            (acc, product) => {
              acc[product.id] =
                product;

              return acc;
            },
            {},
          );

        setProducts(productMap);
        setMovements(movementRows);
      } catch (error) {
        console.error(
          "Failed to load stock movements:",
          error,
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /**
   * Initial load.
   */
  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * Filter movements.
   */
  const filteredMovements =
    useMemo(() => {
      const normalizedQuery =
        query.trim().toLowerCase();

      return movements.filter(
        (movement) => {
          const product =
            products[
              movement.productId
            ];

          const matchesType =
            movementType === "all" ||
            movement.type ===
              movementType;

          if (!matchesType) {
            return false;
          }

          if (!normalizedQuery) {
            return true;
          }

          const searchableText = [
            movement.productNameSnapshot,
            product?.name,
            product?.sku,
            product?.barcode,
            movement.reason,
            movement.referenceId,
            movement.staffName,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchableText.includes(
            normalizedQuery,
          );
        },
      );
    }, [
      movements,
      products,
      query,
      movementType,
    ]);

  /**
   * Total stock increases.
   */
  const totalIncrease =
    useMemo(() => {
      return filteredMovements.reduce(
        (total, movement) => {
          return movement.quantityChange >
            0
            ? total +
                movement.quantityChange
            : total;
        },
        0,
      );
    }, [filteredMovements]);

  /**
   * Total stock decreases.
   */
  const totalDecrease =
    useMemo(() => {
      return filteredMovements.reduce(
        (total, movement) => {
          return movement.quantityChange <
            0
            ? total +
                Math.abs(
                  movement.quantityChange,
                )
            : total;
        },
        0,
      );
    }, [filteredMovements]);

  return (
    <div className="space-y-5">
      {/* Header */}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList
              size={26}
              className="text-indigo-600"
            />

            <h1 className="text-xl font-bold text-slate-900">
              Stock Movements
            </h1>
          </div>

          <p className="mt-1 text-sm text-slate-500">
            Complete history of inventory
            changes across your store.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back
            </button>
          )}

          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            <RefreshCw
              size={17}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />

            Refresh
          </button>
        </div>
      </div>

      {/* Summary */}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Total Movements
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {filteredMovements.length}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
            Stock Added
          </p>

          <p className="mt-2 text-2xl font-bold text-emerald-700">
            +{totalIncrease}
          </p>
        </div>

        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">
            Stock Removed
          </p>

          <p className="mt-2 text-2xl font-bold text-rose-700">
            -{totalDecrease}
          </p>
        </div>
      </div>

      {/* Filters */}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_240px]">
          <div className="relative">
            <Search
              size={19}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={query}
              onChange={(event) =>
                setQuery(
                  event.target.value,
                )
              }
              placeholder="Search product, SKU, staff or reference..."
              className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div className="relative">
            <SlidersHorizontal
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <select
              value={movementType}
              onChange={(event) =>
                setMovementType(
                  event.target
                    .value as
                    | StockMovementType
                    | "all",
                )
              }
              className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              {MOVEMENT_TYPES.map(
                (type) => (
                  <option
                    key={type.value}
                    value={type.value}
                  >
                    {type.label}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Movement list */}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center">
            <RefreshCw
              size={30}
              className="animate-spin text-indigo-500"
            />
          </div>
        ) : filteredMovements.length ===
          0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
            <ClipboardList
              size={48}
              className="mb-3 text-slate-300"
            />

            <h3 className="font-semibold text-slate-700">
              No stock movements found
            </h3>

            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Stock movements will appear
              here whenever inventory is
              added, adjusted, sold, returned,
              damaged, or expired.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredMovements.map(
              (movement) => {
                const Icon =
                  getMovementIcon(
                    movement.type,
                  );

                const isIncrease =
                  movement.quantityChange >
                  0;

                const product =
                  products[
                    movement.productId
                  ];

                return (
                  <div
                    key={movement.id}
                    className="flex flex-col gap-3 px-4 py-4 transition hover:bg-slate-50 sm:flex-row sm:items-center"
                  >
                    {/* Icon */}

                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        isIncrease
                          ? "bg-emerald-100 text-emerald-600"
                          : "bg-rose-100 text-rose-600"
                      }`}
                    >
                      <Icon size={21} />
                    </div>

                    {/* Product */}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">
                          {movement.productNameSnapshot ||
                            product?.name ||
                            "Unknown Product"}
                        </p>

                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                          {getStockMovementLabel(
                            movement.type,
                          )}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                        {product?.sku && (
                          <span>
                            SKU:{" "}
                            {product.sku}
                          </span>
                        )}

                        {movement.staffName && (
                          <span>
                            Staff:{" "}
                            {
                              movement.staffName
                            }
                          </span>
                        )}

                        {movement.referenceId && (
                          <span>
                            Ref:{" "}
                            {
                              movement.referenceId
                            }
                          </span>
                        )}
                      </div>

                      {movement.reason && (
                        <p className="mt-1 text-xs text-slate-500">
                          {movement.reason}
                        </p>
                      )}
                    </div>

                    {/* Quantity */}

                    <div className="flex items-center justify-between gap-4 sm:block sm:text-right">
                      <div>
                        <p
                          className={`text-lg font-bold ${
                            isIncrease
                              ? "text-emerald-600"
                              : "text-rose-600"
                          }`}
                        >
                          {isIncrease
                            ? "+"
                            : ""}
                          {
                            movement.quantityChange
                          }
                        </p>

                        <p className="text-xs text-slate-500">
                          {
                            movement.quantityBefore
                          }{" "}
                          →{" "}
                          {
                            movement.quantityAfter
                          }
                        </p>
                      </div>

                      <p className="text-xs text-slate-400 sm:mt-1">
                        {formatDate(
                          movement.createdAt,
                        )}
                      </p>
                    </div>
                  </div>
                );
              },
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default StockMovementsPage;
