/* =========================================================
   EBY-GOLD POS — CORE TYPES
   ========================================================= */

/* =========================================================
   PAYMENTS & SALES
   ========================================================= */

export type PaymentMethod =
  | "cash"
  | "transfer"
  | "credit"
  | "card"
  | "qr";

export type SaleStatus =
  | "completed"
  | "credit"
  | "voided"
  | "refunded";

export type DebtStatus =
  | "unpaid"
  | "partially_paid"
  | "paid";

/* =========================================================
   PRODUCTS & INVENTORY
   ========================================================= */

export type ProductUnit =
  | "piece"
  | "kg"
  | "gram"
  | "litre"
  | "ml"
  | "pack"
  | "carton"
  | "dozen"
  | "custom";

export interface Category {
  id: string;

  name: string;

  description?: string;

  active: boolean;

  createdAt: string;

  updatedAt: string;
}

export interface Supplier {
  id: string;

  name: string;

  phone?: string;

  email?: string;

  address?: string;

  active: boolean;

  createdAt: string;

  updatedAt: string;
}

export interface Product {
  id: string;

  name: string;

  sku: string;

  /**
   * Barcode used for fast scanner lookup.
   */
  barcode?: string;

  /**
   * Product category.
   */
  categoryId?: string;

  categoryName?: string;

  /**
   * Supplier information.
   */
  supplierId?: string;

  supplierName?: string;

  /**
   * Cost price.
   *
   * Used for profitability and TRUE gross margin calculations.
   */
  costPriceKobo?: number;

  /**
   * Standard/base selling price.
   */
  priceKobo: number;

  /**
   * Optional desired TRUE gross margin percentage.
   */
  marginPercent?: number;

  /**
   * Current inventory quantity.
   *
   * This remains for fast POS lookup and offline operation.
   * Every change should also create a StockMovement record.
   */
  stockQuantity: number;

  /**
   * Low stock warning level.
   */
  lowStockThreshold: number;

  /**
   * Preferred reorder level.
   */
  reorderLevel?: number;

  /**
   * Product measurement unit.
   */
  unit?: ProductUnit;

  /**
   * Whether product is sold by weight.
   */
  soldByWeight?: boolean;

  /**
   * Whether product can expire.
   */
  trackExpiry?: boolean;

  /**
   * Optional next known expiry date.
   *
   * For advanced batch tracking, batches are represented separately.
   */
  expiryDate?: string;

  active: boolean;

  createdAt: string;

  updatedAt: string;
}

/* =========================================================
   PRODUCT BATCHES & EXPIRY
   ========================================================= */

export interface ProductBatch {
  id: string;

  productId: string;

  batchNumber?: string;

  quantity: number;

  costPriceKobo?: number;

  expiryDate?: string;

  supplierId?: string;

  createdAt: string;

  updatedAt: string;
}

/* =========================================================
   SALES
   ========================================================= */

export interface Sale {
  id: string;

  /**
   * Human-readable receipt number.
   */
  receiptNo?: string;

  createdAt: string;

  subtotalKobo: number;

  discountKobo?: number;

  totalKobo: number;

  paymentMethod: PaymentMethod;

  status?: SaleStatus;

  customerId?: string;

  customerName?: string;

  customerPhone?: string;

  cashierId?: string;

  cashierName?: string;

  branchId?: string;

  debtId?: string;
}

export interface SaleItem {
  id: string;

  saleId: string;

  productId: string;

  productNameSnapshot: string;

  skuSnapshot?: string;

  barcodeSnapshot?: string;

  unitPriceKobo: number;

  /**
   * Cost price at the time of sale.
   *
   * Important for historical profitability reports.
   */
  costPriceKobo?: number;

  quantity: number;

  discountKobo?: number;

  lineTotalKobo: number;

  createdAt?: string;
}

/* =========================================================
   SPLIT PAYMENTS
   ========================================================= */

export interface SalePayment {
  id: string;

  saleId: string;

  method: PaymentMethod;

  amountKobo: number;

  reference?: string;

  createdAt: string;
}

/* =========================================================
   CUSTOMERS / CRM
   ========================================================= */

export interface Customer {
  id: string;

  name: string;

  phone: string;

  email?: string;

  address?: string;

  loyaltyPoints?: number;

  totalSpentKobo?: number;

  totalVisits?: number;

  lastPurchaseAt?: string;

  active: boolean;

  createdAt: string;

  updatedAt: string;
}

/* =========================================================
   DEBTS
   ========================================================= */

export interface Debt {
  id: string;

  saleId: string;

  customerName: string;

  customerPhone?: string;

  originalAmountKobo: number;

  amountPaidKobo: number;

  balanceKobo: number;

  status: DebtStatus;

  createdAt: string;

  updatedAt: string;
}

export interface DebtPayment {
  id: string;

  debtId: string;

  amountKobo: number;

  paymentMethod?: PaymentMethod;

  receivedBy?: string;

  createdAt: string;
}

/* =========================================================
   INVENTORY MOVEMENTS
   ========================================================= */

/**
 * Every inventory change should have a movement record.
 */
export type StockMovementType =
  | "opening_stock"
  | "purchase"
  | "sale"
  | "sale_return"
  | "customer_return"
  | "adjustment_in"
  | "adjustment_out"
  | "damage"
  | "expired"
  | "transfer_in"
  | "transfer_out"
  | "stock_count";

/**
 * Permanent inventory ledger.
 */
export interface StockMovement {
  id: string;

  productId: string;

  productNameSnapshot: string;

  type: StockMovementType;

  /**
   * Positive = stock added.
   * Negative = stock removed.
   */
  quantityChange: number;

  /**
   * Stock before movement.
   */
  quantityBefore: number;

  /**
   * Stock after movement.
   */
  quantityAfter: number;

  /**
   * Optional cost value involved.
   */
  unitCostKobo?: number;

  /**
   * Optional sale/selling value.
   */
  unitPriceKobo?: number;

  /**
   * Link to the transaction that caused this movement.
   */
  referenceId?: string;

  referenceType?: string;

  reason?: string;

  staffId?: string;

  staffName?: string;

  branchId?: string;

  createdAt: string;
}

/* =========================================================
   STOCK ADJUSTMENTS
   ========================================================= */

export type StockAdjustmentType =
  | "increase"
  | "decrease"
  | "damage"
  | "expired"
  | "correction";

export interface StockAdjustment {
  id: string;

  productId: string;

  type: StockAdjustmentType;

  quantityBefore: number;

  quantityChange: number;

  quantityAfter: number;

  reason: string;

  staffId?: string;

  staffName?: string;

  createdAt: string;
}

/* =========================================================
   STOCK AUDITS
   ========================================================= */

export interface StockAudit {
  id: string;

  productId: string;

  productNameSnapshot: string;

  expectedQuantity: number;

  physicalQuantity: number;

  discrepancy: number;

  staffName?: string;

  createdAt: string;
}

/* =========================================================
   PRICING ENGINE
   ========================================================= */

export type PricingRuleTarget =
  | "all_products"
  | "product";

export type PricingAdjustmentType =
  | "percentage"
  | "fixed_amount";

export type PricingDirection =
  | "increase"
  | "decrease";

export interface PricingRule {
  id: string;

  name: string;

  description?: string;

  target: PricingRuleTarget;

  productId?: string;

  adjustmentType: PricingAdjustmentType;

  /**
   * Percentage value or Kobo amount.
   */
  adjustmentValue: number;

  direction: PricingDirection;

  minimumQuantity?: number;

  startsAt?: string;

  endsAt?: string;

  active: boolean;

  createdAt: string;

  updatedAt: string;
}

/* =========================================================
   PRICE HISTORY
   ========================================================= */

export interface PriceHistory {
  id: string;

  productId: string;

  oldPriceKobo: number;

  newPriceKobo: number;

  reason?: string;

  changedBy?: string;

  createdAt: string;
}

/* =========================================================
   AUDIT LOGGING
   ========================================================= */

export interface AuditEvent {
  id: string;

  type: string;

  message: string;

  meta?: string;

  userId?: string;

  userName?: string;

  createdAt: string;
}

/* =========================================================
   SETTINGS
   ========================================================= */

export interface Setting {
  key: string;

  value: unknown;
}

export interface AppSettings {
  businessName: string;

  businessPhone: string;

  businessEmail?: string;

  businessAddress?: string;

  receiptFooter: string;

  currency: string;

  /**
   * Warn when products expire within this number of days.
   */
  expiryWarningDays?: number;

  /**
   * Whether negative inventory is allowed.
   */
  allowNegativeStock?: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  businessName: "Eby-Gold Superstores",

  businessPhone: "",

  businessEmail: "",

  businessAddress: "",

  receiptFooter: "Thank you for shopping with us!",

  currency: "NGN",

  expiryWarningDays: 10,

  allowNegativeStock: false,
};

/* =========================================================
   CART
   ========================================================= */

export interface CartItem {
  productId: string;

  name: string;

  priceKobo: number;

  /**
   * Base product price before dynamic pricing.
   */
  basePriceKobo?: number;

  qty: number;

  stockQuantity: number;

  /**
   * Cost snapshot for profitability calculations.
   */
  costPriceKobo?: number;
}

/* =========================================================
   INVENTORY SUMMARY HELPERS
   ========================================================= */

export interface InventorySummary {
  totalProducts: number;

  activeProducts: number;

  totalUnits: number;

  lowStockProducts: number;

  outOfStockProducts: number;

  inventoryCostValueKobo: number;

  inventoryRetailValueKobo: number;
}
