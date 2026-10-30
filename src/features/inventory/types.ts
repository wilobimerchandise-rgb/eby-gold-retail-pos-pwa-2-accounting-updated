/* =========================================================
   EBY-GOLD POS — INVENTORY FEATURE TYPES
   ========================================================= */

/**
 * Inventory feature-specific types.
 *
 * IMPORTANT:
 * Core/domain types remain in:
 *
 *   src/types.ts
 *
 * This file contains inventory UI/service types and re-exports
 * the relevant canonical inventory domain types.
 */

import type {
  Product,
  StockMovement,
  StockMovementType,
  StockAdjustment,
  StockAdjustmentType,
} from "@/types";

/* =========================================================
   CANONICAL TYPE RE-EXPORTS
   ========================================================= */

/**
 * Re-export canonical inventory types so inventory components
 * can import them from this feature when convenient.
 */
export type {
  StockMovementType,
  StockMovement,
  StockAdjustment,
  StockAdjustmentType,
} from "@/types";

/* =========================================================
   INVENTORY PRODUCT
   ========================================================= */

/**
 * Product model enriched with inventory-specific calculated
 * values used by InventoryPage and inventory-service.
 */
export interface InventoryProduct extends Product {
  /**
   * True when stock quantity is zero.
   */
  outOfStock: boolean;

  /**
   * True when stock is greater than zero but at or below
   * the configured low-stock threshold.
   */
  lowStock: boolean;

  /**
   * Effective reorder level.
   *
   * Uses Product.reorderLevel when available,
   * otherwise falls back to lowStockThreshold.
   */
  reorderLevel: number;

  /**
   * Current quantity × cost price.
   */
  inventoryCostValueKobo: number;

  /**
   * Current quantity × selling price.
   */
  inventoryRetailValueKobo: number;
}

/* =========================================================
   INVENTORY STATISTICS
   ========================================================= */

/**
 * Statistics displayed by InventoryPage.
 *
 * These names intentionally match inventory-service.ts
 * and InventoryPage.tsx.
 */
export interface InventoryStats {
  /**
   * Total number of products represented by the inventory
   * query.
   */
  totalProducts: number;

  /**
   * Number of active products.
   */
  activeProducts: number;

  /**
   * Total physical units currently in stock.
   */
  totalStockUnits: number;

  /**
   * Number of products at or below their low-stock threshold.
   */
  lowStockProducts: number;

  /**
   * Number of products with zero stock.
   */
  outOfStockProducts: number;

  /**
   * Inventory value at cost.
   */
  inventoryCostValueKobo: number;

  /**
   * Inventory value at current selling price.
   */
  inventorySellingValueKobo: number;

  /**
   * Potential gross profit:
   *
   * selling value - cost value
   */
  potentialGrossProfitKobo: number;
}

/* =========================================================
   STOCK ADJUSTMENT DIRECTION
   ========================================================= */

/**
 * Direction selected by StockAdjustmentModal.
 */
export type StockAdjustmentDirection =
  | "in"
  | "out";

/* =========================================================
   STOCK ADJUSTMENT REASON
   ========================================================= */

/**
 * Human-friendly reasons available to the inventory UI.
 *
 * These are translated by inventory-service into the
 * canonical StockAdjustmentType where necessary.
 */
export type StockAdjustmentReason =
  | "restock"
  | "supplier_return"
  | "damage"
  | "expiry"
  | "loss"
  | "found"
  | "correction"
  | "other";

/* =========================================================
   STOCK ADJUSTMENT INPUT
   ========================================================= */

/**
 * Input used by the Inventory UI when adjusting stock.
 *
 * This is intentionally different from the canonical
 * StockAdjustment database record.
 */
export interface AdjustStockInput {
  /**
   * Product being adjusted.
   */
  productId: string;

  /**
   * Increase or decrease.
   */
  direction: StockAdjustmentDirection;

  /**
   * Positive quantity entered by the user.
   */
  quantity: number;

  /**
   * Reason for the adjustment.
   */
  reason: StockAdjustmentReason;

  /**
   * Optional explanatory note.
   */
  note?: string;

  /**
   * Optional staff/user ID.
   */
  staffId?: string;

  /**
   * Staff member performing the operation.
   */
  performedBy?: string;

  /**
   * Optional staff name.
   */
  staffName?: string;
}

/* =========================================================
   BACKWARD-COMPATIBLE STOCK ADJUSTMENT INPUT
   ========================================================= */

/**
 * Lower-level input compatible with the canonical
 * stock-adjustment record.
 *
 * Useful for existing service code or future integrations
 * that already work with type + quantityChange.
 */
export interface StockAdjustmentInput {
  /**
   * Product being adjusted.
   */
  productId: string;

  /**
   * Canonical adjustment type.
   */
  type: StockAdjustmentType;

  /**
   * Signed quantity change.
   *
   * Positive = increase.
   * Negative = decrease.
   */
  quantityChange: number;

  /**
   * Human-readable reason.
   */
  reason: string;

  /**
   * Optional staff ID.
   */
  staffId?: string;

  /**
   * Optional staff name.
   */
  staffName?: string;
}

/* =========================================================
   PHYSICAL STOCK COUNT INPUT
   ========================================================= */

/**
 * Input used when staff perform a physical stock count.
 */
export interface StockCountInput {
  /**
   * Product being counted.
   */
  productId: string;

  /**
   * Actual physical quantity counted.
   */
  physicalQuantity: number;

  /**
   * Optional reason/note.
   */
  reason?: string;

  /**
   * Optional explanatory note.
   */
  note?: string;

  /**
   * Optional staff ID.
   */
  staffId?: string;

  /**
   * Optional staff name.
   */
  staffName?: string;

  /**
   * Staff member performing the count.
   */
  performedBy?: string;
}

/* =========================================================
   STOCK ADJUSTMENT FORM
   ========================================================= */

/**
 * Form state used internally by StockAdjustmentModal.
 */
export interface StockAdjustmentFormData {
  /**
   * Increase or decrease.
   */
  direction: StockAdjustmentDirection;

  /**
   * Positive quantity entered by staff.
   */
  quantity: number;

  /**
   * Selected reason.
   */
  reason: StockAdjustmentReason;

  /**
   * Optional note.
   */
  note: string;

  /**
   * Staff member name.
   */
  staffName: string;
}

/* =========================================================
   STOCK MOVEMENT FILTERS
   ========================================================= */

export interface StockMovementFilters {
  /**
   * Optional product filter.
   */
  productId?: string;

  /**
   * Movement type or all.
   */
  type?: StockMovementType | "all";

  /**
   * Start date/time.
   */
  startDate?: string;

  /**
   * End date/time.
   */
  endDate?: string;

  /**
   * Search product name/SKU/barcode.
   */
  search?: string;
}

/* =========================================================
   STOCK MOVEMENT DISPLAY MODEL
   ========================================================= */

/**
 * Movement enriched for presentation in the UI.
 */
export interface StockMovementDisplay extends StockMovement {
  /**
   * Human-readable movement label.
   */
  label: string;

  /**
   * Whether this movement increased stock.
   */
  isIncrease: boolean;

  /**
   * Whether this movement decreased stock.
   */
  isDecrease: boolean;
}

/* =========================================================
   INVENTORY PAGE FILTERS
   ========================================================= */

export type InventoryStockFilter =
  | "all"
  | "in_stock"
  | "low_stock"
  | "out_of_stock"
  | "inactive";

export interface InventoryFilters {
  /**
   * Product name, SKU or barcode search.
   */
  search: string;

  /**
   * Stock status.
   */
  stockStatus: InventoryStockFilter;

  /**
   * Optional category.
   */
  categoryId?: string;
}

/* =========================================================
   INVENTORY SORTING
   ========================================================= */

export type InventorySortField =
  | "name"
  | "sku"
  | "stockQuantity"
  | "priceKobo"
  | "updatedAt";

export type SortDirection =
  | "asc"
  | "desc";

export interface InventorySort {
  field: InventorySortField;

  direction: SortDirection;
}

/* =========================================================
   INVENTORY TABLE STATE
   ========================================================= */

export interface InventoryTableState {
  filters: InventoryFilters;

  sort: InventorySort;

  page: number;

  pageSize: number;
}

/* =========================================================
   INVENTORY ACTION RESULT
   ========================================================= */

export interface InventoryActionResult {
  success: boolean;

  message: string;
}

/* =========================================================
   STOCK ADJUSTMENT RESULT
   ========================================================= */

export interface StockAdjustmentResult {
  adjustment: StockAdjustment;

  movement: StockMovement;

  product: Product;
}

/* =========================================================
   STOCK COUNT RESULT
   ========================================================= */

export interface StockCountResult {
  movement: StockMovement;

  product: Product;
}

/* =========================================================
   INVENTORY VALUE SUMMARY
   ========================================================= */

export interface InventoryValueSummary {
  /**
   * Total inventory cost value.
   */
  costValueKobo: number;

  /**
   * Total inventory selling value.
   */
  retailValueKobo: number;

  /**
   * Potential gross profit.
   */
  potentialProfitKobo: number;
}

/* =========================================================
   STOCK STATUS
   ========================================================= */

export type StockStatus =
  | "in_stock"
  | "low_stock"
  | "out_of_stock";

export interface ProductStockStatus {
  status: StockStatus;

  quantity: number;

  threshold: number;

  reorderLevel: number;
}

/* =========================================================
   REORDER SUGGESTION
   ========================================================= */

export interface ReorderSuggestion {
  productId: string;

  productName: string;

  sku: string;

  currentQuantity: number;

  reorderLevel: number;

  suggestedQuantity: number;

  supplierId?: string;

  supplierName?: string;
}
