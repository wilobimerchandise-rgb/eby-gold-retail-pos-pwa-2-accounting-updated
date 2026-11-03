
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ClipboardCheck,
  Loader2,
  Package,
  Search,
  X,
} from "lucide-react";

import { db } from "@/db/database";
import { useAuth } from "@/features/auth/AuthProvider";
import type { Product } from "@/types";

import { Modal } from "@/components/Modal";
import { toast } from "@/components/Toast";

import {
  adjustStock,
  applyStockCount,
} from "./inventory-service";

import type {
  StockAdjustmentDirection,
  StockAdjustmentReason,
} from "./types";

interface StockAdjustmentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialProductId?: string;
}

type AdjustmentMode = "adjustment" | "stock_count";

const REASONS: {
  value: StockAdjustmentReason;
  label: string;
  direction?: StockAdjustmentDirection;
}[] = [
  { value: "restock", label: "New Stock / Restock", direction: "in" },
  { value: "supplier_return", label: "Supplier Return", direction: "out" },
  { value: "damage", label: "Damaged Goods", direction: "out" },
  { value: "expiry", label: "Expired Goods", direction: "out" },
  { value: "loss", label: "Lost / Missing Stock", direction: "out" },
  { value: "found", label: "Found Stock", direction: "in" },
  { value: "correction", label: "Inventory Correction" },
  { value: "other", label: "Other" },
];

export function StockAdjustmentModal({
  open,
  onClose,
  onSuccess,
  initialProductId,
}: StockAdjustmentModalProps) {
  const { profile } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<AdjustmentMode>("adjustment");
  const [search, setSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState(
    initialProductId ?? "",
  );
  const [direction, setDirection] =
    useState<StockAdjustmentDirection>("in");
  const [reason, setReason] =
    useState<StockAdjustmentReason>("restock");
  const [quantity, setQuantity] = useState("");
  const [physicalQuantity, setPhysicalQuantity] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedProductId(initialProductId ?? "");

    let cancelled = false;

    const loadProducts = async () => {
      try {
        setLoadingProducts(true);

        const all = await db.products.orderBy("name").toArray();

        if (!cancelled) {
          setProducts(all.filter((product) => product.active));
        }
      } catch (error) {
        console.error("Failed to load products:", error);
        toast("error", "Failed to load products");
      } finally {
        if (!cancelled) {
          setLoadingProducts(false);
        }
      }
    };

    void loadProducts();

    return () => {
      cancelled = true;
    };
  }, [open, initialProductId]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setQuantity("");
      setPhysicalQuantity("");
      setNote("");
      setMode("adjustment");
      setDirection("in");
      setReason("restock");
      setSelectedProductId("");
    }
  }, [open]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return products;
    }

    return products.filter((product) => {
      const name = product.name?.toLowerCase() ?? "";
      const sku = product.sku?.toLowerCase() ?? "";
      const barcode = product.barcode?.toLowerCase() ?? "";

      return (
        name.includes(query) ||
        sku.includes(query) ||
        barcode.includes(query)
      );
    });
  }, [products, search]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId),
    [products, selectedProductId],
  );

  const handleReasonChange = (value: StockAdjustmentReason) => {
    setReason(value);

    const selectedReason = REASONS.find((item) => item.value === value);

    if (selectedReason?.direction) {
      setDirection(selectedReason.direction);
    }
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProductId(product.id);
    setSearch(product.name);
  };

  const parsedQuantity = Number(quantity);
  const parsedPhysicalQuantity = Number(physicalQuantity);

  const handleSubmit = async () => {
    if (!selectedProduct) {
      toast("error", "Please select a product");
      return;
    }

    if (
      !profile?.id ||
      !profile.email ||
      !profile.organization_id ||
      !profile.branch_id
    ) {
      toast(
        "error",
        "Your staff identity or branch could not be verified. Please sign in again.",
      );
      return;
    }

    const staffName = profile.full_name?.trim() || profile.email;

    try {
      setSubmitting(true);

      if (mode === "stock_count") {
        if (
          !Number.isFinite(parsedPhysicalQuantity) ||
          parsedPhysicalQuantity < 0
        ) {
          toast("error", "Enter a valid physical stock quantity");
          return;
        }

        const result = await applyStockCount({
          productId: selectedProduct.id,
          physicalQuantity: Math.round(parsedPhysicalQuantity),
          note: note.trim() || undefined,
          performedBy: staffName,
          staffId: profile.id,
          branchId: profile.branch_id,
        });

        if (!result) {
          toast(
            "success",
            "Physical count matches the current inventory",
          );

          onSuccess?.();
          onClose();
          return;
        }

        toast(
          "success",
          `${selectedProduct.name} inventory updated successfully`,
        );

        onSuccess?.();
        onClose();
        return;
      }

      if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
        toast("error", "Enter a valid quantity greater than zero");
        return;
      }

      const adjustmentQuantity = Math.round(parsedQuantity);

      if (
        direction === "out" &&
        adjustmentQuantity >
          Number(selectedProduct.stockQuantity ?? 0)
      ) {
        toast(
          "error",
          `Cannot remove ${adjustmentQuantity} units. Only ${selectedProduct.stockQuantity} units are currently in stock.`,
        );
        return;
      }

      await adjustStock({
        productId: selectedProduct.id,
        direction,
        quantity: adjustmentQuantity,
        reason,
        note: note.trim() || undefined,
        performedBy: staffName,
        staffId: profile.id,
        branchId: profile.branch_id,
      });

      toast(
        "success",
        `${selectedProduct.name} stock updated successfully`,
      );

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Stock adjustment failed:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Stock adjustment failed";

      toast("error", message);
    } finally {
      setSubmitting(false);
    }
  };

  const projectedQuantity = useMemo(() => {
    if (!selectedProduct) {
      return null;
    }

    const currentQuantity = Number(
      selectedProduct.stockQuantity ?? 0,
    );

    if (mode === "stock_count") {
      if (
        !Number.isFinite(parsedPhysicalQuantity) ||
        parsedPhysicalQuantity < 0
      ) {
        return null;
      }

      return Math.round(parsedPhysicalQuantity);
    }

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      return currentQuantity;
    }

    const adjustmentQuantity = Math.round(parsedQuantity);

    return direction === "in"
      ? currentQuantity + adjustmentQuantity
      : Math.max(0, currentQuantity - adjustmentQuantity);
  }, [
    selectedProduct,
    mode,
    direction,
    parsedQuantity,
    parsedPhysicalQuantity,
  ]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Stock Adjustment"
      size="lg"
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-xl border border-slate-200 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || loadingProducts}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Saving...
              </>
            ) : mode === "stock_count" ? (
              <>
                <ClipboardCheck size={18} />
                Apply Stock Count
              </>
            ) : (
              <>
                <Package size={18} />
                Save Adjustment
              </>
            )}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">
            Adjustment Type
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("adjustment")}
              className={`rounded-xl border p-3 text-sm font-semibold transition ${
                mode === "adjustment"
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Manual Adjustment
            </button>

            <button
              type="button"
              onClick={() => setMode("stock_count")}
              className={`rounded-xl border p-3 text-sm font-semibold transition ${
                mode === "stock_count"
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Physical Stock Count
            </button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">
            Product
          </p>

          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSelectedProductId("");
              }}
              placeholder="Search product or SKU..."
              className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-10 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />

            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSelectedProductId("");
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                aria-label="Clear product search"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {!selectedProduct && search && !loadingProducts && (
            <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              {filteredProducts.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">
                  No products found
                </div>
              ) : (
                filteredProducts.slice(0, 20).map((product) => (
                  <button
                    type="button"
                    key={product.id}
                    onClick={() => handleSelectProduct(product)}
                    className="w-full border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-indigo-50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {product.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          SKU: {product.sku}
                        </p>
                      </div>

                      <span className="text-xs font-bold text-slate-600">
                        {product.stockQuantity} in stock
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {selectedProduct && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900">
                    {selectedProduct.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    SKU: {selectedProduct.sku}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedProductId("");
                    setSearch("");
                  }}
                  className="text-slate-400 hover:text-rose-500"
                  aria-label="Remove selected product"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-100 bg-white p-3">
                  <p className="text-xs text-slate-500">Current Stock</p>
                  <p className="text-xl font-bold text-slate-900">
                    {selectedProduct.stockQuantity}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-100 bg-white p-3">
                  <p className="text-xs text-slate-500">Reorder Level</p>
                  <p className="text-xl font-bold text-slate-900">
                    {selectedProduct.lowStockThreshold}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {mode === "adjustment" && (
          <>
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">
                Stock Direction
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDirection("in")}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-3 font-semibold transition ${
                    direction === "in"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 text-slate-600"
                  }`}
                >
                  <ArrowUp size={18} />
                  Stock In
                </button>

                <button
                  type="button"
                  onClick={() => setDirection("out")}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-3 font-semibold transition ${
                    direction === "out"
                      ? "border-rose-500 bg-rose-50 text-rose-700"
                      : "border-slate-200 text-slate-600"
                  }`}
                >
                  <ArrowDown size={18} />
                  Stock Out
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Reason
              </label>

              <select
                value={reason}
                onChange={(event) =>
                  handleReasonChange(
                    event.target.value as StockAdjustmentReason,
                  )
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {REASONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Adjustment Quantity
              </label>

              <input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="Enter quantity"
                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </>
        )}

        {mode === "stock_count" && (
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Physical Quantity Counted
            </label>

            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={physicalQuantity}
              onChange={(event) =>
                setPhysicalQuantity(event.target.value)
              }
              placeholder="Enter physical quantity"
              className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />

            <p className="mt-2 text-xs text-slate-500">
              The system will automatically calculate the difference
              between the physical count and the recorded inventory.
            </p>
          </div>
        )}

        {selectedProduct && projectedQuantity !== null && (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle
                size={20}
                className="mt-0.5 shrink-0 text-indigo-600"
              />

              <div>
                <p className="font-semibold text-indigo-900">
                  Inventory Preview
                </p>

                <div className="mt-2 flex items-center gap-3 text-sm">
                  <span className="text-slate-600">
                    Current:
                    <strong className="ml-1 text-slate-900">
                      {selectedProduct.stockQuantity}
                    </strong>
                  </span>

                  <span className="text-slate-400">→</span>

                  <span className="text-slate-600">
                    New:
                    <strong className="ml-1 text-indigo-700">
                      {projectedQuantity}
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-700">
            Recorded By
          </p>

          <p className="mt-1 text-sm text-slate-900">
            {profile?.full_name?.trim() || profile?.email || "Loading staff identity..."}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            This operation will be attributed to your signed-in staff
            account and assigned branch.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Notes
            <span className="font-normal text-slate-400"> (Optional)</span>
          </label>

          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Add additional information..."
            rows={3}
            className="w-full resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>
    </Modal>
  );
}

export default StockAdjustmentModal;
