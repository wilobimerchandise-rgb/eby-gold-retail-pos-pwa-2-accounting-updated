import { db, logAuditEvent } from "@/db/database";
import type { Product } from "@/types";
import { v4 as uuid } from "uuid";

const SEED_PRODUCTS: Omit<Product, "id">[] = [
  { name: "Peak Milk 400g", sku: "PEAK-400", priceKobo: 320000, stockQuantity: 45, lowStockThreshold: 10, active: true, createdAt: "", updatedAt: "" },
  { name: "Milo 1kg", sku: "MILO-1KG", priceKobo: 450000, stockQuantity: 30, lowStockThreshold: 8, active: true, createdAt: "", updatedAt: "" },
  { name: "Indomie Chicken 70g", sku: "IND-70", priceKobo: 50000, stockQuantity: 120, lowStockThreshold: 20, active: true, createdAt: "", updatedAt: "" },
  { name: "Golden Penny Spaghetti 500g", sku: "GP-SPG500", priceKobo: 120000, stockQuantity: 60, lowStockThreshold: 15, active: true, createdAt: "", updatedAt: "" },
  { name: "Semovita 1kg", sku: "SEM-1KG", priceKobo: 180000, stockQuantity: 25, lowStockThreshold: 10, active: true, createdAt: "", updatedAt: "" },
  { name: "Detergent 1kg", sku: "DET-1KG", priceKobo: 150000, stockQuantity: 40, lowStockThreshold: 12, active: true, createdAt: "", updatedAt: "" },
];

let seeded = false;

export async function seedIfEmpty(): Promise<void> {
  if (seeded) return;
  const count = await db.products.count();
  if (count > 0) {
    seeded = true;
    return;
  }
  const now = new Date().toISOString();
  const products: Product[] = SEED_PRODUCTS.map((p) => ({
    ...p,
    id: uuid(),
    createdAt: now,
    updatedAt: now,
  }));
  await db.products.bulkAdd(products);
  await logAuditEvent("seed", `Seeded ${products.length} products`);
  seeded = true;
}
