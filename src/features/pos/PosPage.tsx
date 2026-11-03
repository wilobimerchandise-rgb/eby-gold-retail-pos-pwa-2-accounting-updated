
import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";

import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  X,
  CreditCard,
  AlertTriangle,
  Package,
  Clock,
  ClipboardCheck,
  Tag,
} from "lucide-react";

import {
  db,
  nextReceiptNo,
  logAuditEvent,
} from "@/db/database";

import type {
  Product,
  PaymentMethod,
  Sale,
  SaleItem,
  PricingRule,
  CartItem,
  StockMovement,
} from "@/types";

import {
  naira,
  mulKobo,
  addKobo,
} from "@/lib/money";

import {
  calculateProductPrice,
} from "@/lib/price-engine";

import { toast } from "@/components/Toast";
import { useCart } from "./cart-context";
import { useAuth } from "@/features/auth/AuthProvider";
import { CheckoutModal } from "./CheckoutModal";
import { ReceiptModal } from "./ReceiptModal";
import { SalesHistory } from "./SalesHistory";
import { StaffAuditModal } from "./StaffAuditModal";

import { v4 as uuid } from "uuid";

/* =========================================================
   POS PAGE
   ========================================================= */

export function PosPage() {
  const {
    cart,
    setCart,
    prefillCustomer,
    setPrefillCustomer,
  } = useCart();

  const { profile, deviceId } = useAuth();

  /* =======================================================
     STATE
     ======================================================= */

  const [products, setProducts] =
    useState<Product[]>([]);

  const [pricingRules, setPricingRules] =
    useState<PricingRule[]>([]);

  const [query, setQuery] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [checkoutOpen, setCheckoutOpen] =
    useState(false);

  const [receipt, setReceipt] =
    useState<{
      sale: Sale;
      items: SaleItem[];
    } | null>(null);

  const [showHistory, setShowHistory] =
    useState(false);

  const [auditOpen, setAuditOpen] =
    useState(false);

  const checkoutInProgress = useRef(false);

  /* =======================================================
     LOAD POS DATA
     ======================================================= */

  const refresh = useCallback(
    async () => {
      setLoading(true);

      try {
        const [
          allProducts,
          allPricingRules,
        ] = await Promise.all([
          db.products
            .orderBy("name")
            .toArray(),

          db.pricingRules
            .toArray(),
        ]);

        setProducts(allProducts);
        setPricingRules(allPricingRules);
      } catch (error) {
        console.error(
          "Failed to load POS data:",
          error,
        );

        toast(
          "error",
          "Failed to load POS data",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /* =======================================================
     PRODUCT HELPERS
     ======================================================= */

  const getProduct = useCallback(
    (
      productId: string,
    ): Product | undefined => {
      return products.find(
        (product) =>
          product.id === productId,
      );
    },
    [products],
  );

  /**
   * Gets the effective selling price.
   */
  const getEffectivePrice = useCallback(
    (
      product: Product,
      quantity = 1,
    ) => {
      return calculateProductPrice(
        product,
        pricingRules,
        quantity,
      );
    },
    [pricingRules],
  );

  /* =======================================================
     PRODUCT SEARCH
     ======================================================= */

  const filteredProducts = useMemo(() => {
    const normalizedQuery =
      query
        .trim()
        .toLowerCase();

    const activeProducts =
      products.filter(
        (product) =>
          product.active,
      );

    if (!normalizedQuery) {
      return activeProducts;
    }

    return activeProducts.filter(
      (product) => {
        const nameMatches =
          product.name
            .toLowerCase()
            .includes(normalizedQuery);

        const skuMatches =
          product.sku
            .toLowerCase()
            .includes(normalizedQuery);

        const barcodeMatches =
          product.barcode
            ?.toLowerCase()
            .includes(normalizedQuery) ?? false;

        return (
          nameMatches ||
          skuMatches ||
          barcodeMatches
        );
      },
    );
  }, [
    products,
    query,
  ]);

  /* =======================================================
     CART PRICE RECALCULATION
     ======================================================= */

  const recalculateCartPrices =
    useCallback(
      (
        items: CartItem[],
        latestProducts: Product[] = products,
      ): CartItem[] => {
        const recalculatedItems: (
          CartItem | null
        )[] = items.map((item) => {
          const product =
            latestProducts.find(
              (candidate) =>
                candidate.id === item.productId,
            );

          if (!product) {
            return null;
          }

          const calculation =
            calculateProductPrice(
              product,
              pricingRules,
              item.qty,
            );

          const updatedItem: CartItem = {
            ...item,
            name: product.name,
            priceKobo:
              calculation.finalPriceKobo,
            basePriceKobo:
              calculation.basePriceKobo,
            stockQuantity:
              product.stockQuantity,
            costPriceKobo:
              product.costPriceKobo,
          };

          return updatedItem;
        });

        return recalculatedItems.filter(
          (item): item is CartItem =>
            item !== null,
        );
      },
      [
        products,
        pricingRules,
      ],
    );

  /**
   * Synchronize cart when product prices
   * or inventory change.
   */
  useEffect(() => {
    if (cart.length === 0) {
      return;
    }

    setCart((previous) =>
      recalculateCartPrices(previous),
    );
  }, [
    cart.length,
    products,
    pricingRules,
    recalculateCartPrices,
    setCart,
  ]);

  /* =======================================================
     ADD TO CART
     ======================================================= */

  const addToCart = (
    product: Product,
  ) => {
    if (product.stockQuantity <= 0) {
      toast(
        "error",
        `${product.name} is out of stock`,
      );

      return;
    }

    setCart((previous) => {
      const existing =
        previous.find(
          (item) =>
            item.productId === product.id,
        );

      /* Existing cart item */

      if (existing) {
        const nextQuantity =
          existing.qty + 1;

        if (
          nextQuantity >
          product.stockQuantity
        ) {
          toast(
            "error",
            `Only ${product.stockQuantity} of ${product.name} available`,
          );

          return previous;
        }

        const calculation =
          calculateProductPrice(
            product,
            pricingRules,
            nextQuantity,
          );

        return previous.map(
          (item) =>
            item.productId === product.id
              ? {
                  ...item,
                  qty: nextQuantity,
                  priceKobo:
                    calculation.finalPriceKobo,
                  basePriceKobo:
                    calculation.basePriceKobo,
                  stockQuantity:
                    product.stockQuantity,
                  costPriceKobo:
                    product.costPriceKobo,
                }
              : item,
        );
      }

      /* New cart item */

      const calculation =
        calculateProductPrice(
          product,
          pricingRules,
          1,
        );

      return [
        ...previous,
        {
          productId: product.id,
          name: product.name,
          priceKobo:
            calculation.finalPriceKobo,
          basePriceKobo:
            calculation.basePriceKobo,
          qty: 1,
          stockQuantity:
            product.stockQuantity,
          costPriceKobo:
            product.costPriceKobo,
        },
      ];
    });
  };

  /* =======================================================
     CHANGE QUANTITY
     ======================================================= */

  const changeQty = (
    productId: string,
    delta: number,
  ) => {
    setCart((previous) =>
      previous
        .map((item) => {
          if (item.productId !== productId) {
            return item;
          }

          const product =
            getProduct(productId);

          if (!product) {
            return item;
          }

          const nextQuantity =
            item.qty + delta;

          if (
            nextQuantity >
            product.stockQuantity
          ) {
            toast(
              "error",
              `Only ${product.stockQuantity} in stock`,
            );

            return item;
          }

          if (nextQuantity <= 0) {
            return {
              ...item,
              qty: 0,
            };
          }

          const calculation =
            calculateProductPrice(
              product,
              pricingRules,
              nextQuantity,
            );

          return {
            ...item,
            qty: nextQuantity,
            priceKobo:
              calculation.finalPriceKobo,
            basePriceKobo:
              calculation.basePriceKobo,
            stockQuantity:
              product.stockQuantity,
            costPriceKobo:
              product.costPriceKobo,
          };
        })
        .filter(
          (item) =>
            item.qty > 0,
        ),
    );
  };

  /* =======================================================
     SET EXACT QUANTITY
     ======================================================= */

  const setQtyExact = (
    productId: string,
    quantity: number,
  ) => {
    setCart((previous) =>
      previous
        .map((item) => {
          if (item.productId !== productId) {
            return item;
          }

          const product =
            getProduct(productId);

          if (!product) {
            return item;
          }

          const nextQuantity =
            Math.max(
              0,
              Math.min(
                quantity,
                product.stockQuantity,
              ),
            );

          if (nextQuantity === 0) {
            return {
              ...item,
              qty: 0,
            };
          }

          const calculation =
            calculateProductPrice(
              product,
              pricingRules,
              nextQuantity,
            );

          return {
            ...item,
            qty: nextQuantity,
            priceKobo:
              calculation.finalPriceKobo,
            basePriceKobo:
              calculation.basePriceKobo,
            stockQuantity:
              product.stockQuantity,
            costPriceKobo:
              product.costPriceKobo,
          };
        })
        .filter(
          (item) =>
            item.qty > 0,
        ),
    );
  };

  /* =======================================================
     REMOVE ITEM
     ======================================================= */

  const removeItem = (
    productId: string,
  ) => {
    setCart((previous) =>
      previous.filter(
        (item) =>
          item.productId !== productId,
      ),
    );
  };

  /* =======================================================
     CLEAR CART
     ======================================================= */

  const clearCart = () => {
    if (cart.length === 0) {
      return;
    }

    if (
      window.confirm(
        "Clear all items from the cart?",
      )
    ) {
      setCart([]);
    }
  };

  /* =======================================================
     CART TOTAL
     ======================================================= */

  const totalKobo = useMemo(() => {
    return cart.reduce(
      (total, item) =>
        addKobo(
          total,
          mulKobo(
            item.priceKobo,
            item.qty,
          ),
        ),
      0,
    );
  }, [cart]);

  const itemCount = useMemo(() => {
    return cart.reduce(
      (total, item) =>
        total + item.qty,
      0,
    );
  }, [cart]);

  /* =======================================================
     COMPLETE CHECKOUT
     ======================================================= */

  const completeCheckout = async (
    method: PaymentMethod,
    amountPaidKobo: number,
    customerName: string,
    customerPhone: string,
    initialPaymentMethod: Exclude<PaymentMethod, "credit">,
  ) => {
    if (checkoutInProgress.current) return;

    const authenticatedProfile = profile;

    if (
      !authenticatedProfile?.id ||
      !authenticatedProfile.organization_id ||
      !authenticatedProfile.branch_id
    ) {
      toast(
        "error",
        "Your staff profile is incomplete. Refresh your profile before completing a sale.",
      );
      return;
    }

    const cashierName =
      authenticatedProfile.full_name?.trim() ||
      authenticatedProfile.email;

    if (cart.length === 0) {
      toast(
        "error",
        "Cart is empty",
      );

      return;
    }

    if (!Number.isSafeInteger(amountPaidKobo) || amountPaidKobo < 0) {
      toast("error", "Payment amount is invalid.");
      return;
    }

    if (
      method === "credit" &&
      !["cash", "transfer", "card", "qr"].includes(initialPaymentMethod)
    ) {
      toast("error", "Select a valid method for the initial deposit.");
      return;
    }

    checkoutInProgress.current = true;

    try {
      const receiptNo =
        await nextReceiptNo();

      const now =
        new Date().toISOString();

      const result =
        await db.transaction(
          "rw",

          [
            db.sales,
            db.saleItems,
            db.salePayments,
            db.products,
            db.debts,
            db.debtPayments,
            db.stockMovements,
            db.pricingRules,
          ],

          async () => {
            /* =============================================
               LOAD FRESH PRODUCTS
               ============================================= */

            const productIds =
              cart.map(
                (item) =>
                  item.productId,
              );

            const freshProducts =
              await db.products.bulkGet(
                productIds,
              );

            /* =============================================
               LOAD CURRENT PRICING RULES
               ============================================= */

            const freshRules =
              await db.pricingRules.toArray();

            /* =============================================
               VALIDATE STOCK
               ============================================= */

            for (const cartItem of cart) {
              if (!Number.isSafeInteger(cartItem.qty) || cartItem.qty <= 0) {
                throw new Error(`Invalid quantity for ${cartItem.name}.`);
              }

              const product =
                freshProducts.find(
                  (candidate) =>
                    candidate?.id === cartItem.productId,
                );

              if (!product) {
                throw new Error(
                  `${cartItem.name} no longer exists. Please review the cart.`,
                );
              }

              if (!product.active) {
                throw new Error(
                  `${product.name} is no longer available.`,
                );
              }

              if (
                product.stockQuantity <
                cartItem.qty
              ) {
                throw new Error(
                  `Insufficient stock for ${product.name}. Only ${product.stockQuantity} left.`,
                );
              }
            }

            /* =============================================
               CREATE SALE
               ============================================= */

            const saleId = uuid();

            let subtotalKobo = 0;

            const saleItems: SaleItem[] = [];

            const stockMovements: StockMovement[] = [];

            /* =============================================
               PROCESS CART ITEMS
               ============================================= */

            for (const cartItem of cart) {
              const product =
                freshProducts.find(
                  (candidate) =>
                    candidate?.id === cartItem.productId,
                )!;

              /*
               * Recalculate the selling price inside
               * the transaction rather than trusting
               * the browser's cart price.
               */

              const calculation =
                calculateProductPrice(
                  product,
                  freshRules,
                  cartItem.qty,
                  new Date(),
                );

              const unitPriceKobo =
                calculation.finalPriceKobo;

              const lineTotalKobo =
                mulKobo(
                  unitPriceKobo,
                  cartItem.qty,
                );

              subtotalKobo =
                addKobo(
                  subtotalKobo,
                  lineTotalKobo,
                );

              /* SALE ITEM */

              saleItems.push({
                id: uuid(),
                saleId,
                productId: product.id,
                productNameSnapshot: product.name,
                skuSnapshot: product.sku,
                barcodeSnapshot: product.barcode,
                unitPriceKobo,
                costPriceKobo: product.costPriceKobo,
                quantity: cartItem.qty,
                lineTotalKobo,
                createdAt: now,
              });

              /* INVENTORY UPDATE */

              const quantityBefore =
                product.stockQuantity;

              const quantityChange =
                -cartItem.qty;

              const quantityAfter =
                quantityBefore + quantityChange;

              /* STOCK MOVEMENT */

              stockMovements.push({
                id: uuid(),
                productId: product.id,
                productNameSnapshot: product.name,
                type: "sale",
                quantityChange,
                quantityBefore,
                quantityAfter,
                unitCostKobo: product.costPriceKobo,
                unitPriceKobo,
                referenceId: saleId,
                referenceType: "sale",
                reason: `Sale ${receiptNo}`,
                staffId: authenticatedProfile.id,
                staffName: cashierName,
                branchId: authenticatedProfile.branch_id,
                createdAt: now,
              });

              /* UPDATE PRODUCT STOCK */

              await db.products.update(
                product.id,
                {
                  stockQuantity: quantityAfter,
                  updatedAt: now,
                },
              );
            }

            if (method === "credit") {
              if (amountPaidKobo > subtotalKobo) {
                throw new Error("Initial deposit cannot exceed the final sale total.");
              }
            } else if (amountPaidKobo < subtotalKobo) {
              throw new Error("Payment amount does not cover the final sale total.");
            }

            /* =============================================
               CREATE SALE RECORD
               ============================================= */

            const sale: Sale = {
              id: saleId,
              receiptNo,
              createdAt: now,
              subtotalKobo,
              totalKobo: subtotalKobo,
              paymentMethod: method,
              status:
                method === "credit"
                  ? "credit"
                  : "completed",
              customerName:
                customerName || undefined,
              customerPhone:
                customerPhone || undefined,
              cashierId: authenticatedProfile.id,
              cashierName,
              branchId: authenticatedProfile.branch_id,
            };

            await db.sales.add(sale);

            /* SAVE SALE ITEMS */

            await db.saleItems.bulkAdd(saleItems);

            /* SAVE INVENTORY MOVEMENTS */

            await db.stockMovements.bulkAdd(
              stockMovements,
            );

            /* =============================================
               RECORD PAYMENT(S) AND CREDIT DEBT
               ============================================= */

            const actualPaymentMethod =
              method === "credit" ? initialPaymentMethod : method;

            const amountToRecord =
              method === "credit" ? amountPaidKobo : subtotalKobo;

            if (amountToRecord > 0) {
              await db.salePayments.add({
                id: uuid(),
                saleId,
                method: actualPaymentMethod,
                amountKobo: amountToRecord,
                createdAt: now,
              });
            }

            if (method === "credit") {
              const debtId = uuid();
              const remainingBalance = subtotalKobo - amountPaidKobo;
              const debtStatus =
                remainingBalance === 0
                  ? "paid"
                  : amountPaidKobo === 0
                    ? "unpaid"
                    : "partially_paid";

              await db.debts.add({
                id: debtId,
                saleId,
                customerName: customerName || "Walk-in customer",
                customerPhone: customerPhone || undefined,
                originalAmountKobo: subtotalKobo,
                amountPaidKobo,
                balanceKobo: remainingBalance,
                status: debtStatus,
                createdAt: now,
                updatedAt: now,
              });

              if (amountPaidKobo > 0) {
                await db.debtPayments.add({
                  id: uuid(),
                  debtId,
                  amountKobo: amountPaidKobo,
                  paymentMethod: initialPaymentMethod,
                  createdAt: now,
                });
              }

              await db.sales.update(saleId, { debtId });
              sale.debtId = debtId;
            }

            return {
              saleId,
              sale,
              items: saleItems,
              totalKobo: subtotalKobo,
            };
          },
        );

      /* ===============================================
         AUDIT LOG
         =============================================== */

      await logAuditEvent(
        "sale",
        `Sale ${receiptNo} completed`,
        {
          saleId: result.saleId,
          receiptNo,
          paymentMethod: method,
          totalKobo: result.totalKobo,
          amountPaidKobo,
          itemCount: cart.length,
          cashierId: authenticatedProfile.id,
          cashierName,
          organizationId: authenticatedProfile.organization_id,
          branchId: authenticatedProfile.branch_id,
          deviceId: deviceId ?? undefined,
        },
      );

      /* ===============================================
         UPDATE UI
         =============================================== */

      setReceipt({
        sale: result.sale,
        items: result.items,
      });

      setCart([]);
      setPrefillCustomer(null);
      setCheckoutOpen(false);

      await refresh();

      toast(
        "success",
        `Sale ${receiptNo} completed`,
      );
    } catch (error) {
      console.error(
        "Checkout failed:",
        error,
      );

      const message =
        error instanceof Error
          ? error.message
          : "Checkout failed";

      toast(
        "error",
        message,
      );

      await refresh();
    } finally {
      checkoutInProgress.current = false;
    }
  };

  /* =======================================================
     UI
     ======================================================= */

  return (
    <div className="space-y-4">
      {/* ACTION BAR */}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() =>
            setShowHistory(true)
          }
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-50"
        >
          <Clock size={16} />
          Sales History
        </button>

        <button
          onClick={() =>
            setAuditOpen(true)
          }
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-50"
        >
          <ClipboardCheck size={16} />
          Staff Audit
        </button>
      </div>

      {/* MAIN POS GRID */}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-3">
        {/* PRODUCTS */}

        <section className="flex flex-col">
          <div className="relative mb-3">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={20}
            />

            <input
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="Search products, SKU or barcode..."
              className="w-full pl-11 pr-10 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Package
                className="text-slate-300 animate-pulse"
                size={40}
              />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Package
                size={40}
                className="mb-2"
              />
              <p className="font-medium">
                No products found
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {filteredProducts.map((product) => {
                const outOfStock =
                  product.stockQuantity <= 0;

                const lowStock =
                  product.stockQuantity > 0 &&
                  product.stockQuantity <=
                    product.lowStockThreshold;

                const calculation =
                  getEffectivePrice(product, 1);

                const hasAdjustment =
                  calculation.hasAdjustment;

                return (
                  <button
                    key={product.id}
                    onClick={() =>
                      addToCart(product)
                    }
                    disabled={outOfStock}
                    className={`relative text-left bg-white rounded-xl p-3 border transition-all active:scale-[0.97] ${
                      outOfStock
                        ? "border-slate-200 opacity-50 cursor-not-allowed"
                        : "border-slate-200 hover:border-indigo-400 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="text-sm font-semibold text-slate-900 leading-tight line-clamp-2">
                        {product.name}
                      </h3>

                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                        {product.sku}
                      </span>
                    </div>

                    <div className="mt-1.5">
                      {hasAdjustment && (
                        <p className="text-xs text-slate-400 line-through">
                          {naira(
                            calculation.basePriceKobo,
                          )}
                        </p>
                      )}

                      <p className="text-indigo-600 font-bold text-base">
                        {naira(
                          calculation.finalPriceKobo,
                        )}
                      </p>
                    </div>

                    {hasAdjustment && (
                      <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-emerald-600">
                        <Tag size={11} />
                        Promotion applied
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-1.5">
                      <span
                        className={`text-[11px] font-semibold flex items-center gap-1 ${
                          outOfStock
                            ? "text-rose-600"
                            : lowStock
                              ? "text-amber-600"
                              : "text-slate-500"
                        }`}
                      >
                        {outOfStock ? (
                          <>Out of stock</>
                        ) : (
                          <>
                            {product.stockQuantity} left

                            {lowStock && (
                              <AlertTriangle size={11} />
                            )}
                          </>
                        )}
                      </span>

                      {!outOfStock && (
                        <span className="bg-indigo-600 text-white rounded-full p-1">
                          <Plus size={14} />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* CART */}

        <section className="bg-white rounded-2xl border border-slate-200 flex flex-col lg:sticky lg:top-[72px] lg:max-h-[calc(100vh-88px)]">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart
                size={20}
                className="text-indigo-600"
              />

              <h2 className="font-bold text-slate-900">
                Cart
              </h2>

              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {itemCount}
              </span>
            </div>

            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-rose-500 text-xs font-semibold flex items-center gap-1 hover:text-rose-700"
              >
                <Trash2 size={14} />
                Clear
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2 min-h-[200px]">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-300 py-10">
                <ShoppingCart
                  size={48}
                  className="mb-2"
                />

                <p className="text-sm text-slate-400 font-medium">
                  Tap a product to add it
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {cart.map((item) => {
                  const product =
                    getProduct(item.productId);

                  const calculation =
                    product
                      ? calculateProductPrice(
                          product,
                          pricingRules,
                          item.qty,
                        )
                      : null;

                  return (
                    <li
                      key={item.productId}
                      className="flex items-center gap-2 bg-slate-50 rounded-xl p-2 animate-pop"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {item.name}
                        </p>

                        {calculation?.hasAdjustment && (
                          <p className="text-[11px] text-slate-400 line-through">
                            {naira(
                              calculation.basePriceKobo,
                            )}
                          </p>
                        )}

                        <p className="text-xs text-indigo-600 font-semibold">
                          {naira(item.priceKobo)} each
                        </p>
                      </div>

                      <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200">
                        <button
                          onClick={() =>
                            changeQty(
                              item.productId,
                              -1,
                            )
                          }
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-l-lg"
                        >
                          <Minus size={16} />
                        </button>

                        <input
                          type="number"
                          min="0"
                          max={item.stockQuantity}
                          value={item.qty}
                          onChange={(event) =>
                            setQtyExact(
                              item.productId,
                              Number(event.target.value) || 0,
                            )
                          }
                          className="w-10 text-center text-sm font-bold text-slate-900 bg-transparent outline-none"
                        />

                        <button
                          onClick={() =>
                            changeQty(
                              item.productId,
                              1,
                            )
                          }
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-r-lg"
                        >
                          <Plus size={16} />
                        </button>
                      </div>

                      <div className="text-right w-20">
                        <p className="text-sm font-bold text-slate-900">
                          {naira(
                            mulKobo(
                              item.priceKobo,
                              item.qty,
                            ),
                          )}
                        </p>
                      </div>

                      <button
                        onClick={() =>
                          removeItem(item.productId)
                        }
                        className="text-slate-300 hover:text-rose-500 p-1"
                      >
                        <X size={16} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="px-4 py-3 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-500 font-medium">
                Total
              </span>

              <span className="text-2xl font-bold text-slate-900">
                {naira(totalKobo)}
              </span>
            </div>

            <button
              onClick={() =>
                setCheckoutOpen(true)
              }
              disabled={cart.length === 0}
              className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold text-base disabled:bg-slate-300 disabled:cursor-not-allowed active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            >
              <CreditCard size={20} />
              Checkout
            </button>
          </div>
        </section>
      </div>

      {/* CHECKOUT MODAL */}

      {checkoutOpen && (
        <CheckoutModal
          totalKobo={totalKobo}
          onClose={() =>
            setCheckoutOpen(false)
          }
          onComplete={completeCheckout}
          prefillCustomer={prefillCustomer}
        />
      )}

      {/* RECEIPT MODAL */}

      {receipt && (
        <ReceiptModal
          receipt={receipt}
          onClose={() =>
            setReceipt(null)
          }
        />
      )}

      {/* SALES HISTORY */}

      {showHistory && (
        <SalesHistory
          onClose={() =>
            setShowHistory(false)
          }
        />
      )}

      {/* STAFF AUDIT */}

      {auditOpen && (
        <StaffAuditModal
          onClose={() =>
            setAuditOpen(false)
          }
          onDone={refresh}
        />
      )}
    </div>
  );
}
