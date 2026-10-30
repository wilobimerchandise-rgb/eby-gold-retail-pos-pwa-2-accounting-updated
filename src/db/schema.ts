import { z } from "zod";
import type { Product } from "@/types";

export const aiItemSchema = z.object({
  name: z.string().min(1).max(200),
  quantity: z.number().int().positive(),
});

export const aiResponseSchema = z.object({
  customer: z.object({
    name: z.string().max(200).optional(),
    phone: z.string().max(50).optional(),
  }),
  items: z.array(aiItemSchema).max(100),
  unmatchedItems: z.array(z.string().max(200)).max(100),
});

export type AIResponse = z.infer<typeof aiResponseSchema>;

export interface ParseOrderRequest {
  message: string;
  inventory: { name: string; sku: string }[];
}

export interface ParseOrderResponse {
  customer: { name?: string; phone?: string };
  items: { name: string; quantity: number }[];
  unmatchedItems: string[];
}

export interface MatchedItem {
  aiName: string;
  quantity: number;
  product: Product;
  lineTotalKobo: number;
}

export interface UnmatchedItem {
  aiName: string;
  quantity: number;
}

export interface ParseResult {
  customer: { name?: string; phone?: string };
  matched: MatchedItem[];
  unmatched: UnmatchedItem[];
  stockWarnings: string[];
}

export function matchProducts(
  aiItems: { name: string; quantity: number }[],
  products: Product[],
): { matched: MatchedItem[]; unmatched: UnmatchedItem[]; stockWarnings: string[] } {
  const matched: MatchedItem[] = [];
  const unmatched: UnmatchedItem[] = [];
  const stockWarnings: string[] = [];

  const normalizedProducts = products.map((p) => ({
    product: p,
    nameLower: p.name.toLowerCase(),
    skuLower: p.sku.toLowerCase(),
    tokens: p.name.toLowerCase().split(/\s+/).filter((t) => t.length > 2),
  }));

  for (const ai of aiItems) {
    const aiNameLower = ai.name.toLowerCase().trim();
    if (!aiNameLower) {
      unmatched.push({ aiName: ai.name, quantity: ai.quantity });
      continue;
    }

    let best: Product | null = null;

    // 1. Exact name match
    const exact = normalizedProducts.find((p) => p.nameLower === aiNameLower);
    if (exact) best = exact.product;

    // 2. Exact SKU match
    if (!best) {
      const bySku = normalizedProducts.find((p) => p.skuLower === aiNameLower);
      if (bySku) best = bySku.product;
    }

    // 3. Name contains / contained in AI name
    if (!best) {
      const contains = normalizedProducts.find(
        (p) => p.nameLower.includes(aiNameLower) || aiNameLower.includes(p.nameLower),
      );
      if (contains) best = contains.product;
    }

    // 4. Token overlap (handles "peak milk" vs "Peak Milk 400g")
    if (!best) {
      const aiTokens = aiNameLower.split(/\s+/).filter((t) => t.length > 2);
      if (aiTokens.length > 0) {
        let bestScore = 0;
        let bestProduct: Product | null = null;
        for (const p of normalizedProducts) {
          const overlap = aiTokens.filter((t) => p.tokens.includes(t)).length;
          if (overlap > bestScore) {
            bestScore = overlap;
            bestProduct = p.product;
          }
        }
        if (bestScore >= Math.ceil(aiTokens.length * 0.5)) {
          best = bestProduct;
        }
      }
    }

    if (!best) {
      unmatched.push({ aiName: ai.name, quantity: ai.quantity });
      continue;
    }

    if (!best.active) {
      stockWarnings.push(`${best.name} is inactive and cannot be sold`);
      unmatched.push({ aiName: ai.name, quantity: ai.quantity });
      continue;
    }

    if (ai.quantity > best.stockQuantity) {
      stockWarnings.push(
        `Only ${best.stockQuantity} of ${best.name} in stock (requested ${ai.quantity})`,
      );
    }

    matched.push({
      aiName: ai.name,
      quantity: ai.quantity,
      product: best,
      lineTotalKobo: best.priceKobo * ai.quantity,
    });
  }

  return { matched, unmatched, stockWarnings };
}
