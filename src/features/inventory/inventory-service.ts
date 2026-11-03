
import { v4 as uuid } from "uuid";

import {
  db,
  logAuditEvent,
} from "@/db/database";

import type {
  Product,
  StockMovement,
  StockMovementType,
  StockAdjustment,
  StockAdjustmentType,
  InventorySummary,
} from "@/types";

import type {
  InventoryProduct,
  InventoryStats,
} from "./types";

export type StockAdjustmentReason =
  | "restock"
  | "supplier_return"
  | "damage"
  | "expiry"
  | "loss"
  | "found"
  | "correction"
  | "other";

export type StockAdjustmentDirection = "in" | "out";

export interface AdjustStockInput {
  productId: string;
  direction: StockAdjustmentDirection;
  quantity: number;
  reason: StockAdjustmentReason;
  note?: string;
  performedBy?: string;
  staffId?: string;
  branchId?: string;
}

export interface ApplyStockCountInput {
  productId: string;
  physicalQuantity: number;
  note?: string;
  performedBy?: string;
  staffId?: string;
  branchId?: string;
}

export interface StockAdjustmentInput {
  productId: string;
  type: StockAdjustmentType;
  quantityChange: number;
  reason: string;
  staffId?: string;
  staffName?: string;
  branchId?: string;
}

export interface StockCountInput {
  productId: string;
  physicalQuantity: number;
  reason?: string;
  staffId?: string;
  staffName?: string;
  branchId?: string;
}

function toInventoryProduct(product: Product): InventoryProduct {
  const stockQuantity = Number(product.stockQuantity ?? 0);
  const lowStockThreshold = Number(product.lowStockThreshold ?? 0);
  const outOfStock = stockQuantity <= 0;
  const lowStock = !outOfStock && stockQuantity <= lowStockThreshold;
  const reorderLevel = Number(product.reorderLevel ?? lowStockThreshold);

  return {
    ...product,
    stockQuantity,
    lowStockThreshold,
    reorderLevel,
    outOfStock,
    lowStock,
    inventoryCostValueKobo:
      Math.max(0, stockQuantity) * Number(product.costPriceKobo ?? 0),
    inventoryRetailValueKobo:
      Math.max(0, stockQuantity) * Number(product.priceKobo ?? 0),
  };
}

export async function getInventoryProducts(): Promise<InventoryProduct[]> {
  const products = await db.products.orderBy("name").toArray();

  return products
    .filter((product) => product.active)
    .map(toInventoryProduct);
}

export async function getInventoryProduct(
  productId: string,
): Promise<InventoryProduct | undefined> {
  const product = await db.products.get(productId);

  if (!product || !product.active) {
    return undefined;
  }

  return toInventoryProduct(product);
}

export async function getInventoryStats(): Promise<InventoryStats> {
  const products = await db.products.toArray();
  const activeProducts = products.filter((product) => product.active);

  const totalProducts = products.length;
  const activeProductCount = activeProducts.length;

  const totalStockUnits = activeProducts.reduce(
    (total, product) =>
      total + Math.max(0, Number(product.stockQuantity ?? 0)),
    0,
  );

  const outOfStockProducts = activeProducts.filter(
    (product) => Number(product.stockQuantity ?? 0) <= 0,
  ).length;

  const lowStockProducts = activeProducts.filter((product) => {
    const quantity = Number(product.stockQuantity ?? 0);
    const threshold = Number(product.lowStockThreshold ?? 0);

    return quantity > 0 && quantity <= threshold;
  }).length;

  const inventoryCostValueKobo = activeProducts.reduce(
    (total, product) =>
      total +
      Math.max(0, Number(product.stockQuantity ?? 0)) *
        Number(product.costPriceKobo ?? 0),
    0,
  );

  const inventorySellingValueKobo = activeProducts.reduce(
    (total, product) =>
      total +
      Math.max(0, Number(product.stockQuantity ?? 0)) *
        Number(product.priceKobo ?? 0),
    0,
  );

  return {
    totalProducts,
    activeProducts: activeProductCount,
    totalStockUnits,
    lowStockProducts,
    outOfStockProducts,
    inventoryCostValueKobo,
    inventorySellingValueKobo,
    potentialGrossProfitKobo:
      inventorySellingValueKobo - inventoryCostValueKobo,
  };
}

export async function getInventorySummary(): Promise<InventorySummary> {
  const stats = await getInventoryStats();

  return {
    totalProducts: stats.totalProducts,
    activeProducts: stats.activeProducts,
    totalUnits: stats.totalStockUnits,
    lowStockProducts: stats.lowStockProducts,
    outOfStockProducts: stats.outOfStockProducts,
    inventoryCostValueKobo: stats.inventoryCostValueKobo,
    inventoryRetailValueKobo: stats.inventorySellingValueKobo,
  };
}

export function getStockMovementLabel(
  type: StockMovementType | string,
): string {
  const labels: Record<string, string> = {
    opening_stock: "Opening Stock",
    purchase: "Stock Purchase",
    sale: "Sale",
    sale_return: "Sale Return",
    customer_return: "Customer Return",
    adjustment_in: "Stock Increase",
    adjustment_out: "Stock Decrease",
    damage: "Damaged Stock",
    expired: "Expired Stock",
    transfer_in: "Stock Transfer In",
    transfer_out: "Stock Transfer Out",
    stock_count: "Physical Stock Count",
  };

  return (
    labels[type] ??
    type.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

export function isStockIncrease(type: StockMovementType): boolean {
  return [
    "opening_stock",
    "purchase",
    "sale_return",
    "customer_return",
    "adjustment_in",
    "transfer_in",
  ].includes(type);
}

export function isStockDecrease(type: StockMovementType): boolean {
  return [
    "sale",
    "adjustment_out",
    "damage",
    "expired",
    "transfer_out",
  ].includes(type);
}

export async function getStockMovements(
  productId?: string,
): Promise<StockMovement[]> {
  const movements = productId
    ? await db.stockMovements.where("productId").equals(productId).toArray()
    : await db.stockMovements.toArray();

  return movements.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() -
      new Date(a.createdAt).getTime(),
  );
}

export async function getProductStockMovements(
  productId: string,
): Promise<StockMovement[]> {
  return getStockMovements(productId);
}

function reasonToAdjustmentType(
  reason: StockAdjustmentReason,
  direction: StockAdjustmentDirection,
): StockAdjustmentType {
  switch (reason) {
    case "damage":
      return "damage";
    case "expiry":
      return "expired";
    case "correction":
      return "correction";
    case "restock":
    case "found":
      return "increase";
    case "supplier_return":
    case "loss":
      return "decrease";
    case "other":
    default:
      return direction === "in" ? "increase" : "decrease";
  }
}

function adjustmentTypeToMovementType(
  type: StockAdjustmentType,
  quantityChange: number,
): StockMovementType {
  switch (type) {
    case "increase":
      return "adjustment_in";
    case "decrease":
      return "adjustment_out";
    case "damage":
      return "damage";
    case "expired":
      return "expired";
    case "correction":
      return quantityChange >= 0 ? "adjustment_in" : "adjustment_out";
    default:
      return quantityChange >= 0 ? "adjustment_in" : "adjustment_out";
  }
}

export async function applyStockAdjustment(
  input: StockAdjustmentInput,
): Promise<{
  adjustment: StockAdjustment;
  movement: StockMovement;
  product: Product;
}> {
  const now = new Date().toISOString();
  const adjustmentId = uuid();
  const movementId = uuid();

  const result = await db.transaction(
    "rw",
    db.products,
    db.stockAdjustments,
    db.stockMovements,
    async () => {
      const product = await db.products.get(input.productId);

      if (!product) {
        throw new Error("Product not found");
      }

      if (!product.active) {
        throw new Error("Cannot adjust an inactive product");
      }

      const quantityBefore = Number(product.stockQuantity ?? 0);
      let quantityChange = Number(input.quantityChange);

      if (!Number.isFinite(quantityChange) || quantityChange === 0) {
        throw new Error(
          "Stock adjustment quantity must be greater than zero",
        );
      }

      quantityChange =
        input.type === "increase"
          ? Math.abs(quantityChange)
          : -Math.abs(quantityChange);

      const quantityAfter = quantityBefore + quantityChange;

      if (quantityAfter < 0) {
        throw new Error(
          `Cannot remove ${Math.abs(quantityChange)} units. Only ${quantityBefore} units are currently in stock.`,
        );
      }

      const reason = input.reason.trim() || "Manual stock adjustment";
      const movementType = adjustmentTypeToMovementType(
        input.type,
        quantityChange,
      );

      const adjustment: StockAdjustment = {
        id: adjustmentId,
        productId: product.id,
        type: input.type,
        quantityBefore,
        quantityChange,
        quantityAfter,
        reason,
        staffId: input.staffId,
        staffName: input.staffName,
        createdAt: now,
      };

      const movement: StockMovement = {
        id: movementId,
        productId: product.id,
        productNameSnapshot: product.name,
        type: movementType,
        quantityChange,
        quantityBefore,
        quantityAfter,
        unitCostKobo: product.costPriceKobo,
        referenceId: adjustmentId,
        referenceType: "stock_adjustment",
        reason,
        staffId: input.staffId,
        staffName: input.staffName,
        branchId: input.branchId,
        createdAt: now,
      };

      const updatedProduct: Product = {
        ...product,
        stockQuantity: quantityAfter,
        updatedAt: now,
      };

      await db.products.put(updatedProduct);
      await db.stockAdjustments.add(adjustment);
      await db.stockMovements.add(movement);

      return {
        adjustment,
        movement,
        product: updatedProduct,
      };
    },
  );

  await logAuditEvent(
    "stock_adjustment",
    `Stock adjusted for ${result.product.name}`,
    {
      productId: result.product.id,
      adjustmentId: result.adjustment.id,
      type: result.adjustment.type,
      quantityBefore: result.adjustment.quantityBefore,
      quantityChange: result.adjustment.quantityChange,
      quantityAfter: result.adjustment.quantityAfter,
      reason: result.adjustment.reason,
      staffId: result.adjustment.staffId,
      staffName: result.adjustment.staffName,
      branchId: result.movement.branchId,
    },
  );

  return result;
}

export async function adjustStock(
  input: AdjustStockInput,
): Promise<{
  adjustment: StockAdjustment;
  movement: StockMovement;
  product: Product;
}> {
  if (!input.productId) {
    throw new Error("Product is required");
  }

  const quantity = Math.round(Number(input.quantity));

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantity must be greater than zero");
  }

  const adjustmentType = reasonToAdjustmentType(
    input.reason,
    input.direction,
  );

  const reasonText = getAdjustmentReasonLabel(input.reason);
  const combinedReason = input.note?.trim()
    ? `${reasonText}: ${input.note.trim()}`
    : reasonText;

  return applyStockAdjustment({
    productId: input.productId,
    type: adjustmentType,
    quantityChange: input.direction === "in" ? quantity : -quantity,
    reason: combinedReason,
    staffId: input.staffId,
    staffName: input.performedBy?.trim() || undefined,
    branchId: input.branchId,
  });
}

export async function applyStockCount(
  input: ApplyStockCountInput,
): Promise<{
  adjustment: StockAdjustment;
  movement: StockMovement;
  product: Product;
} | null> {
  const physicalQuantity = Math.round(Number(input.physicalQuantity));

  if (!Number.isFinite(physicalQuantity) || physicalQuantity < 0) {
    throw new Error("Physical quantity must be zero or greater");
  }

  const now = new Date().toISOString();
  const adjustmentId = uuid();
  const movementId = uuid();

  const result = await db.transaction(
    "rw",
    db.products,
    db.stockAdjustments,
    db.stockMovements,
    async () => {
      const product = await db.products.get(input.productId);

      if (!product) {
        throw new Error("Product not found");
      }

      if (!product.active) {
        throw new Error("Cannot count an inactive product");
      }

      const quantityBefore = Number(product.stockQuantity ?? 0);
      const quantityAfter = physicalQuantity;
      const quantityChange = quantityAfter - quantityBefore;

      if (quantityChange === 0) {
        return null;
      }

      const reason = input.note?.trim()
        ? `Physical stock count: ${input.note.trim()}`
        : "Physical stock count";

      const staffName = input.performedBy?.trim() || undefined;

      const adjustment: StockAdjustment = {
        id: adjustmentId,
        productId: product.id,
        type: "correction",
        quantityBefore,
        quantityChange,
        quantityAfter,
        reason,
        staffId: input.staffId,
        staffName,
        createdAt: now,
      };

      const movement: StockMovement = {
        id: movementId,
        productId: product.id,
        productNameSnapshot: product.name,
        type: "stock_count",
        quantityChange,
        quantityBefore,
        quantityAfter,
        unitCostKobo: product.costPriceKobo,
        referenceId: adjustmentId,
        referenceType: "stock_count",
        reason,
        staffId: input.staffId,
        staffName,
        branchId: input.branchId,
        createdAt: now,
      };

      const updatedProduct: Product = {
        ...product,
        stockQuantity: quantityAfter,
        updatedAt: now,
      };

      await db.products.put(updatedProduct);
      await db.stockAdjustments.add(adjustment);
      await db.stockMovements.add(movement);

      return {
        adjustment,
        movement,
        product: updatedProduct,
      };
    },
  );

  if (!result) {
    return null;
  }

  await logAuditEvent(
    "stock_count",
    `Physical stock count completed for ${result.product.name}`,
    {
      productId: result.product.id,
      adjustmentId: result.adjustment.id,
      quantityBefore: result.movement.quantityBefore,
      physicalQuantity: result.movement.quantityAfter,
      quantityChange: result.movement.quantityChange,
      reason: result.movement.reason,
      staffId: result.movement.staffId,
      staffName: result.movement.staffName,
      branchId: result.movement.branchId,
    },
  );

  return result;
}

export function getAdjustmentReasonLabel(
  reason: StockAdjustmentReason,
): string {
  const labels: Record<StockAdjustmentReason, string> = {
    restock: "New Stock / Restock",
    supplier_return: "Supplier Return",
    damage: "Damaged Goods",
    expiry: "Expired Goods",
    loss: "Lost / Missing Stock",
    found: "Found Stock",
    correction: "Inventory Correction",
    other: "Other",
  };

  return labels[reason];
}

export async function addStock(
  productId: string,
  quantity: number,
  reason: string,
  staffName?: string,
): Promise<void> {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantity must be greater than zero");
  }

  await applyStockAdjustment({
    productId,
    type: "increase",
    quantityChange: Math.abs(Math.round(quantity)),
    reason,
    staffName,
  });
}

export async function removeStock(
  productId: string,
  quantity: number,
  reason: string,
  staffName?: string,
): Promise<void> {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantity must be greater than zero");
  }

  await applyStockAdjustment({
    productId,
    type: "decrease",
    quantityChange: -Math.abs(Math.round(quantity)),
    reason,
    staffName,
  });
}

export async function recordDamagedStock(
  productId: string,
  quantity: number,
  reason: string,
  staffName?: string,
): Promise<void> {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantity must be greater than zero");
  }

  await applyStockAdjustment({
    productId,
    type: "damage",
    quantityChange: -Math.abs(Math.round(quantity)),
    reason,
    staffName,
  });
}

export async function recordExpiredStock(
  productId: string,
  quantity: number,
  reason: string,
  staffName?: string,
): Promise<void> {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantity must be greater than zero");
  }

  await applyStockAdjustment({
    productId,
    type: "expired",
    quantityChange: -Math.abs(Math.round(quantity)),
    reason,
    staffName,
  });
}

export async function getLowStockProducts(): Promise<Product[]> {
  const products = await db.products.toArray();

  return products.filter((product) => {
    if (!product.active) {
      return false;
    }

    const quantity = Number(product.stockQuantity ?? 0);
    const threshold = Number(product.lowStockThreshold ?? 0);

    return quantity > 0 && quantity <= threshold;
  });
}

export async function getOutOfStockProducts(): Promise<Product[]> {
  const products = await db.products.toArray();

  return products.filter(
    (product) =>
      product.active && Number(product.stockQuantity ?? 0) <= 0,
  );
}

export async function getReorderProducts(): Promise<Product[]> {
  const products = await db.products.toArray();

  return products.filter((product) => {
    if (!product.active) {
      return false;
    }

    const reorderLevel = Number(
      product.reorderLevel ?? product.lowStockThreshold ?? 0,
    );

    return Number(product.stockQuantity ?? 0) <= reorderLevel;
  });
}
