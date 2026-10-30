import Dexie, { type Table } from "dexie";

import type {
  Product,
  Sale,
  SaleItem,
  SalePayment,
  Debt,
  DebtPayment,
  StockAudit,
  StockAdjustment,
  StockMovement,
  PricingRule,
  PriceHistory,
  Category,
  Supplier,
  Customer,
  ProductBatch,
  AuditEvent,
  Setting,
} from "@/types";

import { DEFAULT_SETTINGS } from "@/types";

/* =========================================================
   EBY-GOLD POS DATABASE
   ========================================================= */

export class EbyDB extends Dexie {
  /* =======================================================
     PRODUCTS
     ======================================================= */

  products!: Table<Product, string>;

  categories!: Table<Category, string>;

  suppliers!: Table<Supplier, string>;

  productBatches!: Table<ProductBatch, string>;

  /* =======================================================
     SALES
     ======================================================= */

  sales!: Table<Sale, string>;

  saleItems!: Table<SaleItem, string>;

  salePayments!: Table<SalePayment, string>;

  /* =======================================================
     CUSTOMERS
     ======================================================= */

  customers!: Table<Customer, string>;

  /* =======================================================
     DEBTS
     ======================================================= */

  debts!: Table<Debt, string>;

  debtPayments!: Table<DebtPayment, string>;

  /* =======================================================
     INVENTORY
     ======================================================= */

  stockAudits!: Table<StockAudit, string>;

  stockAdjustments!: Table<StockAdjustment, string>;

  stockMovements!: Table<StockMovement, string>;

  /* =======================================================
     PRICING
     ======================================================= */

  pricingRules!: Table<PricingRule, string>;

  priceHistory!: Table<PriceHistory, string>;

  /* =======================================================
     AUDIT & SETTINGS
     ======================================================= */

  auditEvents!: Table<AuditEvent, string>;

  settings!: Table<Setting, string>;

  constructor() {
    super("eby-gold-retail");

    /* =====================================================
       DATABASE VERSION 1

       ORIGINAL POS DATABASE

       IMPORTANT:
       DO NOT REMOVE.

       Existing installations may already have data stored
       using this schema.
       ===================================================== */

    this.version(1).stores({
      products:
        "id, name, sku, active, createdAt",

      sales:
        "id, createdAt, paymentMethod, debtId",

      saleItems:
        "id, saleId, productId",

      debts:
        "id, saleId, status, customerPhone, createdAt",

      debtPayments:
        "id, debtId, createdAt",

      stockAudits:
        "id, productId, createdAt",

      auditEvents:
        "id, type, createdAt",

      settings:
        "key",
    });


    /* =====================================================
       DATABASE VERSION 2

       INVENTORY TRACKING
       ===================================================== */

    this.version(2).stores({
      products:
        "id, name, sku, active, createdAt",

      sales:
        "id, createdAt, paymentMethod, debtId",

      saleItems:
        "id, saleId, productId",

      debts:
        "id, saleId, status, customerPhone, createdAt",

      debtPayments:
        "id, debtId, createdAt",

      stockAudits:
        "id, productId, createdAt",

      stockAdjustments:
        "id, productId, type, createdAt",

      stockMovements:
        "id, productId, type, referenceId, createdAt",

      auditEvents:
        "id, type, createdAt",

      settings:
        "key",
    });


    /* =====================================================
       DATABASE VERSION 3

       FULL EBY-GOLD PRODUCTION SCHEMA

       Adds:

       - Pricing Rules
       - Price History
       - Customers
       - Categories
       - Suppliers
       - Product Batches
       - Sale Payments
       ===================================================== */

    this.version(3).stores({
      /* PRODUCTS */

      products:
        "id, name, sku, barcode, categoryId, supplierId, active, createdAt, updatedAt",


      categories:
        "id, name, active, createdAt",


      suppliers:
        "id, name, phone, active, createdAt",


      productBatches:
        "id, productId, supplierId, expiryDate, createdAt",


      /* SALES */

      sales:
        "id, receiptNo, createdAt, paymentMethod, status, customerId, debtId, branchId",


      saleItems:
        "id, saleId, productId, createdAt",


      salePayments:
        "id, saleId, method, createdAt",


      /* CUSTOMERS */

      customers:
        "id, name, phone, active, createdAt, updatedAt",


      /* DEBTS */

      debts:
        "id, saleId, status, customerPhone, createdAt, updatedAt",


      debtPayments:
        "id, debtId, paymentMethod, createdAt",


      /* INVENTORY */

      stockAudits:
        "id, productId, createdAt",


      stockAdjustments:
        "id, productId, type, createdAt",


      stockMovements:
        "id, productId, type, referenceId, referenceType, createdAt",


      /* PRICING */

      pricingRules:
        "id, name, target, productId, active, startsAt, endsAt, createdAt",


      priceHistory:
        "id, productId, createdAt",


      /* AUDIT */

      auditEvents:
        "id, type, userId, createdAt",


      /* SETTINGS */

      settings:
        "key",
    });
  }
}


/* =========================================================
   SHARED DATABASE INSTANCE
   ========================================================= */

export const db = new EbyDB();


/* =========================================================
   AUDIT LOGGING
   ========================================================= */

/**
 * Creates an audit event.
 *
 * Audit failures should NEVER crash the POS.
 */
export async function logAuditEvent(
  type: string,
  message: string,
  meta?: unknown,
): Promise<void> {
  try {
    const { v4: uuid } =
      await import("uuid");

    await db.auditEvents.add({
      id: uuid(),

      type,

      message,

      meta:
        meta === undefined
          ? undefined
          : JSON.stringify(meta),

      createdAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "Failed to log audit event:",
      error,
    );
  }
}


/* =========================================================
   SETTINGS
   ========================================================= */

/**
 * Gets a single application setting.
 */
export async function getSetting<T>(
  key: string,
  fallback: T,
): Promise<T> {
  const row =
    await db.settings.get(key);

  if (!row) {
    return fallback;
  }

  return row.value as T;
}


/**
 * Saves or updates a setting.
 */
export async function setSetting(
  key: string,
  value: unknown,
): Promise<void> {
  await db.settings.put({
    key,
    value,
  });
}


/**
 * Loads all application settings.
 *
 * Missing settings automatically fall back to defaults.
 */
export async function loadSettings(): Promise<
  typeof DEFAULT_SETTINGS
> {
  const keys = Object.keys(DEFAULT_SETTINGS);

  const stored = await db.settings.bulkGet(keys);

  const result: typeof DEFAULT_SETTINGS = {
    ...DEFAULT_SETTINGS,
  };

  for (const row of stored) {
    if (!row) {
      continue;
    }

    const key = row.key;

    if (
      Object.prototype.hasOwnProperty.call(
        DEFAULT_SETTINGS,
        key,
      )
    ) {
      Object.assign(result, {
        [key]: row.value,
      });
    }
  }

  return result;
}


/**
 * Creates missing default settings.
 *
 * Existing business settings are NOT overwritten.
 */
export async function ensureDefaultSettings(): Promise<void> {
  const defaultEntries =
    Object.entries(DEFAULT_SETTINGS);

  await db.transaction(
    "rw",
    db.settings,

    async () => {
      for (
        const [key, value]
        of defaultEntries
      ) {
        const existing =
          await db.settings.get(key);

        if (!existing) {
          await db.settings.put({
            key,
            value,
          });
        }
      }
    },
  );
}


/* =========================================================
   RECEIPT NUMBERS
   ========================================================= */

/**
 * Generates the next receipt number.
 *
 * Format:
 *
 * EG-YYYYMMDD-00001
 */
export async function nextReceiptNo(): Promise<string> {
  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1,
    ).padStart(2, "0");

  const day =
    String(
      now.getDate(),
    ).padStart(2, "0");


  const datePrefix =
    `EG-${year}${month}${day}`;


  /**
   * Count today's receipts.
   *
   * We use the sales created today rather than
   * the total database count.
   */
  const startOfDay =
    new Date(
      year,
      now.getMonth(),
      now.getDate(),
    ).toISOString();


  const startOfTomorrow =
    new Date(
      year,
      now.getMonth(),
      now.getDate() + 1,
    ).toISOString();


  const todaysSales =
    await db.sales
      .where("createdAt")
      .between(
        startOfDay,
        startOfTomorrow,
        true,
        false,
      )
      .count();


  const sequence =
    String(
      todaysSales + 1,
    ).padStart(5, "0");


  return `${datePrefix}-${sequence}`;
}


/* =========================================================
   DATABASE HEALTH / DIAGNOSTICS
   ========================================================= */

export interface DatabaseStats {
  products: number;

  categories: number;

  suppliers: number;

  productBatches: number;

  customers: number;

  sales: number;

  saleItems: number;

  salePayments: number;

  debts: number;

  debtPayments: number;

  stockAudits: number;

  stockAdjustments: number;

  stockMovements: number;

  pricingRules: number;

  priceHistory: number;

  auditEvents: number;

  settings: number;
}


/**
 * Returns record counts for all local tables.
 *
 * Useful for diagnostics and future sync monitoring.
 */
export async function getDatabaseStats(): Promise<
  DatabaseStats
> {
  const [
    products,
    categories,
    suppliers,
    productBatches,
    customers,
    sales,
    saleItems,
    salePayments,
    debts,
    debtPayments,
    stockAudits,
    stockAdjustments,
    stockMovements,
    pricingRules,
    priceHistory,
    auditEvents,
    settings,
  ] = await Promise.all([
    db.products.count(),

    db.categories.count(),

    db.suppliers.count(),

    db.productBatches.count(),

    db.customers.count(),

    db.sales.count(),

    db.saleItems.count(),

    db.salePayments.count(),

    db.debts.count(),

    db.debtPayments.count(),

    db.stockAudits.count(),

    db.stockAdjustments.count(),

    db.stockMovements.count(),

    db.pricingRules.count(),

    db.priceHistory.count(),

    db.auditEvents.count(),

    db.settings.count(),
  ]);


  return {
    products,

    categories,

    suppliers,

    productBatches,

    customers,

    sales,

    saleItems,

    salePayments,

    debts,

    debtPayments,

    stockAudits,

    stockAdjustments,

    stockMovements,

    pricingRules,

    priceHistory,

    auditEvents,

    settings,
  };
}


/* =========================================================
   DATABASE INITIALIZATION
   ========================================================= */

/**
 * Initializes the local Eby-Gold POS database.
 *
 * Safe to call when the application starts.
 */
export async function initializeDatabase(): Promise<void> {
  try {
    await db.open();

    await ensureDefaultSettings();

    console.log(
      "Eby-Gold database initialized successfully",
    );
  } catch (error) {
    console.error(
      "Failed to initialize Eby-Gold database",
      error,
    );

    throw error;
  }
}
