import { z } from "zod";
import type { Product } from "./types";

export interface ParseOrderRequest {
  message: string;
  inventory: {
    name: string;
    sku: string;
  }[];
}

export interface ParseOrderItem {
  name: string;
  quantity: number;
}

export interface ParseOrderCustomer {
  name?: string;
  phone?: string;
}

export interface ParseOrderResponse {
  customer: ParseOrderCustomer;
  items: ParseOrderItem[];
  unmatchedItems: ParseOrderItem[];
}

export const aiResponseSchema = z.object({
  customer: z.object({
    name: z.string().optional().default(""),
    phone: z.string().optional().default(""),
  }),
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().positive(),
    }),
  ),
  unmatchedItems: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().positive(),
    }),
  ),
});

export interface MatchedItem {
  product: Product;
  quantity: number;
  aiName: string;
}

export interface UnmatchedItem {
  aiName: string;
  quantity: number;
}

export interface ParseResult {
  customer: ParseOrderCustomer;
  matched: MatchedItem[];
  unmatched: UnmatchedItem[];
  stockWarnings: string[];
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

export function matchProducts(
  items: ParseOrderItem[],
  products: Product[],
): {
  matched: MatchedItem[];
  unmatched: UnmatchedItem[];
  stockWarnings: string[];
} {
  const matched: MatchedItem[] = [];
  const unmatched: UnmatchedItem[] = [];
  const stockWarnings: string[] = [];

  for (const item of items) {
    const aiName = item.name;
    const normalizedAiName = normalize(aiName);

    let product =
      products.find(
        (p) =>
          normalize(p.name) === normalizedAiName ||
          normalize(p.sku) === normalizedAiName,
      ) ?? null;

    if (!product) {
      product =
        products.find((p) => {
          const productName = normalize(p.name);
          const sku = normalize(p.sku);

          return (
            productName.includes(normalizedAiName) ||
            normalizedAiName.includes(productName) ||
            sku.includes(normalizedAiName) ||
            normalizedAiName.includes(sku)
          );
        }) ?? null;
    }

    if (!product) {
      unmatched.push({
        aiName,
        quantity: item.quantity,
      });
      continue;
    }

    const quantity = Math.max(1, Math.floor(item.quantity));

    matched.push({
      product,
      quantity,
      aiName,
    });

    if (quantity > product.stockQuantity) {
      stockWarnings.push(
        `${product.name}: requested ${quantity}, but only ${product.stockQuantity} in stock.`,
      );
    }
  }

  return {
    matched,
    unmatched,
    stockWarnings,
  };
}