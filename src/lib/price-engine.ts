import type {
  Product,
  PricingRule,
} from "@/types";

/**
 * Result returned after calculating a product price.
 */
export interface PriceCalculation {
  /**
   * Product ID used for the calculation.
   */
  productId: string;

  /**
   * Original/base selling price before pricing rules.
   */
  basePriceKobo: number;

  /**
   * Final selling price after applicable rules.
   */
  finalPriceKobo: number;

  /**
   * Total discount/increase applied.
   *
   * Positive means the final price increased.
   * Negative means the final price decreased.
   */
  adjustmentKobo: number;

  /**
   * Applicable pricing rules in the order applied.
   */
  appliedRules: PricingRule[];

  /**
   * Whether at least one pricing rule was applied.
   */
  hasAdjustment: boolean;

  /**
   * Cost price used for margin calculations.
   */
  costPriceKobo?: number;

  /**
   * Gross profit in Kobo.
   *
   * Selling price - cost price.
   */
  grossProfitKobo?: number;

  /**
   * True gross margin percentage.
   *
   * Formula:
   *
   * (Selling Price - Cost Price)
   * ---------------------------
   * Selling Price
   *
   * × 100
   */
  grossMarginPercent?: number;
}

/**
 * Result returned when calculating a selling price
 * from a desired TRUE gross margin.
 */
export interface MarginPriceCalculation {
  /**
   * Cost price in Kobo.
   */
  costPriceKobo: number;

  /**
   * Requested gross margin percentage.
   */
  marginPercent: number;

  /**
   * Calculated selling price in Kobo.
   */
  sellingPriceKobo: number;

  /**
   * Expected gross profit in Kobo.
   */
  grossProfitKobo: number;

  /**
   * Actual margin after Kobo rounding.
   */
  actualMarginPercent: number;
}

/**
 * Check whether a pricing rule is currently within
 * its active date range.
 */
export function isPricingRuleActive(
  rule: PricingRule,
  now: Date = new Date(),
): boolean {
  if (!rule.active) {
    return false;
  }

  const nowTime = now.getTime();

  if (rule.startsAt) {
    const startTime =
      new Date(rule.startsAt).getTime();

    if (
      Number.isNaN(startTime) ||
      nowTime < startTime
    ) {
      return false;
    }
  }

  if (rule.endsAt) {
    const endTime =
      new Date(rule.endsAt).getTime();

    if (
      Number.isNaN(endTime) ||
      nowTime > endTime
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Determines whether a pricing rule applies
 * to a particular product.
 */
export function doesRuleApplyToProduct(
  rule: PricingRule,
  product: Product,
): boolean {
  if (
    rule.target === "all_products"
  ) {
    return true;
  }

  if (
    rule.target === "product"
  ) {
    return (
      rule.productId === product.id
    );
  }

  return false;
}

/**
 * Determines whether the quantity requirement
 * for a rule has been met.
 */
export function doesRuleApplyToQuantity(
  rule: PricingRule,
  quantity: number,
): boolean {
  if (
    rule.minimumQuantity === undefined
  ) {
    return true;
  }

  return (
    quantity >= rule.minimumQuantity
  );
}

/**
 * Returns all pricing rules applicable to a product.
 *
 * Rules must:
 *
 * 1. Be enabled
 * 2. Be within their date range
 * 3. Match the product
 * 4. Meet the minimum quantity requirement
 */
export function getApplicablePricingRules(
  product: Product,
  rules: PricingRule[],
  quantity: number = 1,
  now: Date = new Date(),
): PricingRule[] {
  return rules.filter(
    (rule) =>
      isPricingRuleActive(
        rule,
        now,
      ) &&
      doesRuleApplyToProduct(
        rule,
        product,
      ) &&
      doesRuleApplyToQuantity(
        rule,
        quantity,
      ),
  );
}

/**
 * Calculates the adjustment amount generated
 * by a pricing rule.
 *
 * The returned value is always a positive Kobo amount.
 *
 * Direction is handled separately.
 */
export function calculateRuleAdjustmentKobo(
  currentPriceKobo: number,
  rule: PricingRule,
): number {
  if (
    currentPriceKobo < 0
  ) {
    return 0;
  }

  if (
    rule.adjustmentValue < 0
  ) {
    return 0;
  }

  if (
    rule.adjustmentType ===
    "percentage"
  ) {
    return Math.round(
      currentPriceKobo *
        (rule.adjustmentValue / 100),
    );
  }

  if (
    rule.adjustmentType ===
    "fixed_amount"
  ) {
    return Math.round(
      rule.adjustmentValue,
    );
  }

  return 0;
}

/**
 * Applies a single pricing rule to a price.
 *
 * A price can never go below zero.
 */
export function applyPricingRule(
  currentPriceKobo: number,
  rule: PricingRule,
): number {
  const adjustment =
    calculateRuleAdjustmentKobo(
      currentPriceKobo,
      rule,
    );

  if (
    rule.direction === "increase"
  ) {
    return Math.max(
      0,
      Math.round(
        currentPriceKobo +
          adjustment,
      ),
    );
  }

  return Math.max(
    0,
    Math.round(
      currentPriceKobo -
        adjustment,
    ),
  );
}

/**
 * Sort pricing rules into a predictable order.
 *
 * Product-specific rules are applied after
 * global rules so that specific product pricing
 * has higher precedence.
 *
 * Rules are then ordered by creation date.
 */
export function sortPricingRules(
  rules: PricingRule[],
): PricingRule[] {
  return [...rules].sort(
    (a, b) => {
      const targetPriority = (
        rule: PricingRule,
      ) =>
        rule.target === "all_products"
          ? 0
          : 1;

      const priorityDifference =
        targetPriority(a) -
        targetPriority(b);

      if (
        priorityDifference !== 0
      ) {
        return priorityDifference;
      }

      return (
        new Date(
          a.createdAt,
        ).getTime() -
        new Date(
          b.createdAt,
        ).getTime()
      );
    },
  );
}

/**
 * Calculates the final price for a product.
 *
 * Pricing rules are applied sequentially.
 *
 * Example:
 *
 * Base price: ₦10,000
 *
 * Rule 1:
 * - 10% discount
 *
 * Result:
 * ₦9,000
 *
 * Rule 2:
 * - ₦500 discount
 *
 * Final:
 * ₦8,500
 */
export function calculateProductPrice(
  product: Product,
  rules: PricingRule[],
  quantity: number = 1,
  now: Date = new Date(),
): PriceCalculation {
  const basePriceKobo =
    Math.max(
      0,
      Math.round(
        product.priceKobo,
      ),
    );

  const applicableRules =
    sortPricingRules(
      getApplicablePricingRules(
        product,
        rules,
        quantity,
        now,
      ),
    );

  let finalPriceKobo =
    basePriceKobo;

  const appliedRules:
    PricingRule[] = [];

  for (
    const rule of applicableRules
  ) {
    finalPriceKobo =
      applyPricingRule(
        finalPriceKobo,
        rule,
      );

    appliedRules.push(rule);
  }

  const adjustmentKobo =
    finalPriceKobo -
    basePriceKobo;

  const costPriceKobo =
    product.costPriceKobo;

  let grossProfitKobo:
    number | undefined;

  let grossMarginPercent:
    number | undefined;

  if (
    costPriceKobo !== undefined &&
    Number.isFinite(costPriceKobo) &&
    costPriceKobo >= 0
  ) {
    grossProfitKobo =
      finalPriceKobo -
      costPriceKobo;

    grossMarginPercent =
      calculateGrossMarginPercent(
        costPriceKobo,
        finalPriceKobo,
      );
  }

  return {
    productId:
      product.id,

    basePriceKobo,

    finalPriceKobo,

    adjustmentKobo,

    appliedRules,

    hasAdjustment:
      appliedRules.length > 0,

    costPriceKobo,

    grossProfitKobo,

    grossMarginPercent,
  };
}

/**
 * Calculates the final unit price for a product.
 *
 * Convenience function for POS usage.
 */
export function getProductPriceKobo(
  product: Product,
  rules: PricingRule[],
  quantity: number = 1,
  now: Date = new Date(),
): number {
  return calculateProductPrice(
    product,
    rules,
    quantity,
    now,
  ).finalPriceKobo;
}

/**
 * TRUE GROSS MARGIN CALCULATION.
 *
 * Formula:
 *
 * margin =
 *
 * (selling price - cost price)
 * ----------------------------
 * selling price
 *
 * × 100
 *
 * Example:
 *
 * Cost: ₦7,000
 * Selling: ₦10,000
 *
 * Profit = ₦3,000
 *
 * Margin = 30%
 */
export function calculateGrossMarginPercent(
  costPriceKobo: number,
  sellingPriceKobo: number,
): number {
  if (
    !Number.isFinite(costPriceKobo) ||
    !Number.isFinite(
      sellingPriceKobo,
    )
  ) {
    return 0;
  }

  if (
    sellingPriceKobo <= 0
  ) {
    return 0;
  }

  return (
    ((sellingPriceKobo -
      costPriceKobo) /
      sellingPriceKobo) *
    100
  );
}

/**
 * Calculates gross profit.
 */
export function calculateGrossProfitKobo(
  costPriceKobo: number,
  sellingPriceKobo: number,
): number {
  if (
    !Number.isFinite(costPriceKobo) ||
    !Number.isFinite(
      sellingPriceKobo,
    )
  ) {
    return 0;
  }

  return Math.round(
    sellingPriceKobo -
      costPriceKobo,
  );
}

/**
 * Calculates the selling price required to
 * achieve a TRUE gross margin.
 *
 * Formula:
 *
 * Selling Price =
 *
 * Cost Price
 * ----------------
 * (1 - Margin %)
 *
 *
 * Example:
 *
 * Cost = ₦7,000
 * Desired Margin = 30%
 *
 * Selling Price =
 *
 * 7,000
 * -------
 * 0.70
 *
 * = ₦10,000
 */
export function calculateSellingPriceFromMargin(
  costPriceKobo: number,
  marginPercent: number,
): MarginPriceCalculation {
  const safeCost =
    Math.max(
      0,
      Math.round(costPriceKobo),
    );

  /**
   * Margin must be less than 100%.
   *
   * At exactly 100%, the denominator
   * becomes zero.
   */
  const safeMargin =
    Math.min(
      99.99,
      Math.max(
        0,
        marginPercent,
      ),
    );

  const marginDecimal =
    safeMargin / 100;

  const sellingPriceKobo =
    Math.round(
      safeCost /
        (1 - marginDecimal),
    );

  const grossProfitKobo =
    sellingPriceKobo -
    safeCost;

  const actualMarginPercent =
    calculateGrossMarginPercent(
      safeCost,
      sellingPriceKobo,
    );

  return {
    costPriceKobo:
      safeCost,

    marginPercent:
      safeMargin,

    sellingPriceKobo,

    grossProfitKobo,

    actualMarginPercent,
  };
}

/**
 * Calculates markup percentage.
 *
 * IMPORTANT:
 *
 * Markup is NOT the same as margin.
 *
 * Formula:
 *
 * (Selling - Cost)
 * ----------------
 * Cost
 *
 * × 100
 */
export function calculateMarkupPercent(
  costPriceKobo: number,
  sellingPriceKobo: number,
): number {
  if (
    !Number.isFinite(costPriceKobo) ||
    !Number.isFinite(
      sellingPriceKobo,
    )
  ) {
    return 0;
  }

  if (
    costPriceKobo <= 0
  ) {
    return 0;
  }

  return (
    ((sellingPriceKobo -
      costPriceKobo) /
      costPriceKobo) *
    100
  );
}

/**
 * Calculates the selling price from markup.
 *
 * This is included mainly for reporting
 * and comparison purposes.
 *
 * The Product Pricing UI should normally
 * use calculateSellingPriceFromMargin()
 * for true margin pricing.
 */
export function calculateSellingPriceFromMarkup(
  costPriceKobo: number,
  markupPercent: number,
): number {
  const safeCost =
    Math.max(
      0,
      Math.round(costPriceKobo),
    );

  const safeMarkup =
    Math.max(
      0,
      markupPercent,
    );

  return Math.round(
    safeCost *
      (1 + safeMarkup / 100),
  );
}

/**
 * Returns whether a product currently
 * meets its configured desired margin.
 *
 * Returns false when the product does not
 * have enough pricing information.
 */
export function isProductMeetingMarginTarget(
  product: Product,
): boolean {
  if (
    product.costPriceKobo === undefined ||
    product.marginPercent === undefined
  ) {
    return false;
  }

  const actualMargin =
    calculateGrossMarginPercent(
      product.costPriceKobo,
      product.priceKobo,
    );

  return (
    actualMargin >=
    product.marginPercent
  );
}

/**
 * Calculates the minimum selling price required
 * to avoid selling below cost.
 */
export function getBreakEvenPriceKobo(
  costPriceKobo: number,
): number {
  return Math.max(
    0,
    Math.round(costPriceKobo),
  );
}

/**
 * Checks whether a price is below cost.
 */
export function isBelowCost(
  costPriceKobo: number | undefined,
  sellingPriceKobo: number,
): boolean {
  if (
    costPriceKobo === undefined
  ) {
    return false;
  }

  return (
    sellingPriceKobo <
    costPriceKobo
  );
}

/**
 * Calculates a complete margin report
 * for a product.
 */
export function getProductMarginReport(
  product: Product,
  sellingPriceKobo: number =
    product.priceKobo,
): {
  hasCostPrice: boolean;
  costPriceKobo?: number;
  sellingPriceKobo: number;
  grossProfitKobo?: number;
  grossMarginPercent?: number;
  markupPercent?: number;
  isBelowCost: boolean;
} {
  const costPriceKobo =
    product.costPriceKobo;

  if (
    costPriceKobo === undefined ||
    !Number.isFinite(
      costPriceKobo,
    )
  ) {
    return {
      hasCostPrice: false,

      sellingPriceKobo,

      isBelowCost: false,
    };
  }

  const grossProfitKobo =
    calculateGrossProfitKobo(
      costPriceKobo,
      sellingPriceKobo,
    );

  const grossMarginPercent =
    calculateGrossMarginPercent(
      costPriceKobo,
      sellingPriceKobo,
    );

  const markupPercent =
    calculateMarkupPercent(
      costPriceKobo,
      sellingPriceKobo,
    );

  return {
    hasCostPrice: true,

    costPriceKobo,

    sellingPriceKobo,

    grossProfitKobo,

    grossMarginPercent,

    markupPercent,

    isBelowCost:
      sellingPriceKobo <
      costPriceKobo,
  };
}

/**
 * Finds the best calculated price for
 * a collection of products.
 *
 * Useful for reports and future dashboards.
 */
export function calculateProductsPrices(
  products: Product[],
  rules: PricingRule[],
  quantity: number = 1,
  now: Date = new Date(),
): PriceCalculation[] {
  return products.map(
    (product) =>
      calculateProductPrice(
        product,
        rules,
        quantity,
        now,
      ),
  );
}
