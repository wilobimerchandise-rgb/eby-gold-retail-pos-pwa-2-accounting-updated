
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Calendar,
  Edit3,
  Plus,
  Power,
  PowerOff,
  Tag,
  Trash2,
} from "lucide-react";

import { v4 as uuid } from "uuid";

import { db, logAuditEvent } from "@/db/database";

import type {
  PricingRule,
  PricingAdjustmentType,
  PricingDirection,
  PricingRuleTarget,
  Product,
} from "@/types";

import { naira } from "@/lib/money";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/Toast";
import { isPricingRuleActive } from "@/lib/price-engine";

type RuleForm = {
  name: string;
  description: string;
  target: PricingRuleTarget;
  productId: string;
  adjustmentType: PricingAdjustmentType;
  direction: PricingDirection;
  adjustmentValue: string;
  minimumQuantity: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
};

const EMPTY_FORM: RuleForm = {
  name: "",
  description: "",
  target: "all_products",
  productId: "",
  adjustmentType: "percentage",
  direction: "decrease",
  adjustmentValue: "",
  minimumQuantity: "",
  startsAt: "",
  endsAt: "",
  active: true,
};

/**
 * Convert an ISO date into a value suitable
 * for datetime-local inputs.
 */
function toDateTimeLocal(value?: string): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset();

  const localDate = new Date(
    date.getTime() - offset * 60 * 1000,
  );

  return localDate.toISOString().slice(0, 16);
}

/**
 * Convert datetime-local input into an ISO string.
 */
function toIsoOrUndefined(value: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

export function PricingPage() {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] =
    useState<PricingRule | null>(null);
  const [form, setForm] = useState<RuleForm>(EMPTY_FORM);

  /**
   * Build a product-name lookup without adding fields
   * to the persisted PricingRule structure.
   */
  const productNameById = useMemo(
    () =>
      new Map(
        products.map((product) => [
          product.id,
          product.name,
        ]),
      ),
    [products],
  );

  /**
   * Load rules and products.
   */
  const refresh = useCallback(async () => {
    try {
      const [allRules, allProducts] = await Promise.all([
        db.pricingRules
          .orderBy("createdAt")
          .reverse()
          .toArray(),
        db.products
          .orderBy("name")
          .toArray(),
      ]);

      setRules(allRules);
      setProducts(allProducts);
    } catch (error) {
      console.error(error);
      toast("error", "Failed to load pricing rules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * Active rules.
   */
  const activeCount = useMemo(
    () =>
      rules.filter((rule) =>
        isPricingRuleActive(rule),
      ).length,
    [rules],
  );

  /**
   * Open modal for creating a rule.
   */
  const openCreate = () => {
    setEditingRule(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  /**
   * Open modal for editing.
   */
  const openEdit = (rule: PricingRule) => {
    setEditingRule(rule);

    setForm({
      name: rule.name,
      description: rule.description ?? "",
      target: rule.target,
      productId: rule.productId ?? "",
      adjustmentType: rule.adjustmentType,
      direction: rule.direction,
      adjustmentValue: rule.adjustmentValue.toString(),
      minimumQuantity:
        rule.minimumQuantity?.toString() ?? "",
      startsAt: toDateTimeLocal(rule.startsAt),
      endsAt: toDateTimeLocal(rule.endsAt),
      active: rule.active,
    });

    setModalOpen(true);
  };

  /**
   * Close the editor.
   */
  const closeModal = () => {
    setModalOpen(false);
    setEditingRule(null);
    setForm(EMPTY_FORM);
  };

  /**
   * Save rule.
   */
  const saveRule = async () => {
    const name = form.name.trim();

    if (!name) {
      toast("error", "Rule name is required");
      return;
    }

    if (
      form.target === "product" &&
      !form.productId
    ) {
      toast("error", "Please select a product");
      return;
    }

    if (
      form.target === "product" &&
      !products.some(
        (product) =>
          product.id === form.productId &&
          product.active,
      )
    ) {
      toast(
        "error",
        "Select an existing active product",
      );
      return;
    }

    const adjustmentValue = Number(
      form.adjustmentValue,
    );

    if (
      !Number.isFinite(adjustmentValue) ||
      adjustmentValue <= 0
    ) {
      toast(
        "error",
        "Enter a valid adjustment value",
      );
      return;
    }

    if (
      form.adjustmentType === "percentage" &&
      form.direction === "decrease" &&
      adjustmentValue > 100
    ) {
      toast(
        "error",
        "A percentage discount cannot exceed 100%",
      );
      return;
    }

    if (
      form.adjustmentType === "fixed_amount" &&
      !Number.isSafeInteger(
        Math.round(adjustmentValue * 100),
      )
    ) {
      toast(
        "error",
        "The fixed amount is too large to process safely",
      );
      return;
    }

    const minimumQuantity = form.minimumQuantity
      ? Number(form.minimumQuantity)
      : undefined;

    if (
      minimumQuantity !== undefined &&
      (
        !Number.isFinite(minimumQuantity) ||
        minimumQuantity < 1 ||
        !Number.isInteger(minimumQuantity)
      )
    ) {
      toast(
        "error",
        "Minimum quantity must be a whole number of at least 1",
      );
      return;
    }

    const startsAt = toIsoOrUndefined(form.startsAt);
    const endsAt = toIsoOrUndefined(form.endsAt);

    if (form.startsAt && !startsAt) {
      toast("error", "Enter a valid start date");
      return;
    }

    if (form.endsAt && !endsAt) {
      toast("error", "Enter a valid end date");
      return;
    }

    if (
      startsAt &&
      endsAt &&
      new Date(endsAt).getTime() <=
        new Date(startsAt).getTime()
    ) {
      toast(
        "error",
        "End date must be after start date",
      );
      return;
    }

    const now = new Date().toISOString();

    const ruleData: Omit<
      PricingRule,
      "id" | "createdAt" | "updatedAt"
    > = {
      name,
      description:
        form.description.trim() || undefined,
      target: form.target,
      productId:
        form.target === "product"
          ? form.productId
          : undefined,
      adjustmentType: form.adjustmentType,
      direction: form.direction,

      /**
       * Percentage values are stored as entered.
       * Fixed amounts are converted from Naira to Kobo.
       */
      adjustmentValue:
        form.adjustmentType === "fixed_amount"
          ? Math.round(adjustmentValue * 100)
          : adjustmentValue,

      minimumQuantity,
      startsAt,
      endsAt,
      active: form.active,
    };

    try {
      if (editingRule) {
        const updatedRule: PricingRule = {
          ...editingRule,
          ...ruleData,
          updatedAt: now,
        };

        await db.pricingRules.put(updatedRule);

        await logAuditEvent(
          "pricing_rule_updated",
          `Pricing rule "${name}" was updated`,
          {
            ruleId: editingRule.id,
          },
        );

        toast("success", "Pricing rule updated");
      } else {
        const newRule: PricingRule = {
          id: uuid(),
          ...ruleData,
          createdAt: now,
          updatedAt: now,
        };

        await db.pricingRules.add(newRule);

        await logAuditEvent(
          "pricing_rule_created",
          `Pricing rule "${name}" was created`,
          {
            ruleId: newRule.id,
          },
        );

        toast("success", "Pricing rule created");
      }

      closeModal();
      await refresh();
    } catch (error) {
      console.error(error);
      toast("error", "Failed to save pricing rule");
    }
  };

  /**
   * Enable or disable a rule.
   */
  const toggleRule = async (rule: PricingRule) => {
    try {
      const now = new Date().toISOString();

      await db.pricingRules.update(rule.id, {
        active: !rule.active,
        updatedAt: now,
      });

      await logAuditEvent(
        "pricing_rule_toggled",
        `Pricing rule "${rule.name}" was ${
          rule.active ? "disabled" : "enabled"
        }`,
        {
          ruleId: rule.id,
          active: !rule.active,
        },
      );

      await refresh();

      toast(
        "success",
        rule.active
          ? "Pricing rule disabled"
          : "Pricing rule enabled",
      );
    } catch (error) {
      console.error(error);
      toast("error", "Failed to update pricing rule");
    }
  };

  /**
   * Delete rule.
   */
  const deleteRule = async (rule: PricingRule) => {
    const confirmed = confirm(
      `Delete pricing rule "${rule.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await db.pricingRules.delete(rule.id);

      await logAuditEvent(
        "pricing_rule_deleted",
        `Pricing rule "${rule.name}" was deleted`,
        {
          ruleId: rule.id,
        },
      );

      await refresh();
      toast("success", "Pricing rule deleted");
    } catch (error) {
      console.error(error);
      toast("error", "Failed to delete pricing rule");
    }
  };

  /**
   * Human-readable adjustment.
   */
  const formatAdjustment = (rule: PricingRule): string => {
    const symbol =
      rule.direction === "increase" ? "+" : "-";

    if (rule.adjustmentType === "percentage") {
      return `${symbol}${rule.adjustmentValue}%`;
    }

    return `${symbol}${naira(rule.adjustmentValue)}`;
  };

  /**
   * Human-readable status.
   */
  const getStatus = (rule: PricingRule) => {
    if (!rule.active) {
      return {
        label: "Disabled",
        className: "bg-slate-100 text-slate-600",
      };
    }

    const now = new Date();

    if (
      rule.startsAt &&
      new Date(rule.startsAt) > now
    ) {
      return {
        label: "Scheduled",
        className: "bg-blue-50 text-blue-700",
      };
    }

    if (
      rule.endsAt &&
      new Date(rule.endsAt) < now
    ) {
      return {
        label: "Expired",
        className: "bg-rose-50 text-rose-700",
      };
    }

    return {
      label: "Active",
      className: "bg-emerald-50 text-emerald-700",
    };
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Pricing Rules
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage promotions, discounts and price adjustments.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 active:scale-[0.98] transition"
        >
          <Plus size={18} />
          New Pricing Rule
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-xs font-semibold text-slate-500">
            Total Rules
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {rules.length}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-xs font-semibold text-slate-500">
            Active Now
          </p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            {activeCount}
          </p>
        </div>

        <div className="hidden sm:block bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-xs font-semibold text-slate-500">
            Product Rules
          </p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">
            {
              rules.filter(
                (rule) => rule.target === "product",
              ).length
            }
          </p>
        </div>
      </div>

      {/* Rules list */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-400">
          Loading pricing rules...
        </div>
      ) : rules.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl py-16 px-6 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Tag size={28} />
          </div>

          <h2 className="font-bold text-slate-900">
            No pricing rules yet
          </h2>

          <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
            Create a rule to manage discounts,
            promotions and price adjustments.
          </p>

          <button
            type="button"
            onClick={openCreate}
            className="mt-5 inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-semibold"
          >
            <Plus size={18} />
            Create First Rule
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const status = getStatus(rule);

            const productName =
              rule.productId
                ? productNameById.get(rule.productId)
                : undefined;

            return (
              <div
                key={rule.id}
                className="bg-white border border-slate-200 rounded-2xl p-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  {/* Rule information */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-bold text-slate-900">
                        {rule.name}
                      </h2>

                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded-full ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>

                    {rule.description && (
                      <p className="text-sm text-slate-500 mt-1">
                        {rule.description}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2 mt-3">
                      {/* Target */}
                      <span className="text-xs font-medium bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
                        {rule.target === "all_products"
                          ? "All Products"
                          : productName ?? "Specific Product"}
                      </span>

                      {/* Adjustment */}
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                          rule.direction === "increase"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {formatAdjustment(rule)}
                      </span>

                      {/* Minimum quantity */}
                      {rule.minimumQuantity !== undefined && (
                        <span className="text-xs font-medium bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg">
                          Min Qty: {rule.minimumQuantity}
                        </span>
                      )}
                    </div>

                    {/* Schedule */}
                    {(rule.startsAt || rule.endsAt) && (
                      <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-500">
                        <Calendar size={14} />
                        <span>
                          {rule.startsAt &&
                            `From ${new Date(
                              rule.startsAt,
                            ).toLocaleString()}`}

                          {rule.startsAt &&
                            rule.endsAt &&
                            " • "}

                          {rule.endsAt &&
                            `Until ${new Date(
                              rule.endsAt,
                            ).toLocaleString()}`}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void toggleRule(rule)}
                      title={
                        rule.active
                          ? "Disable rule"
                          : "Enable rule"
                      }
                      className={`p-2 rounded-xl border transition ${
                        rule.active
                          ? "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                          : "border-slate-200 text-slate-400 hover:bg-slate-50"
                      }`}
                    >
                      {rule.active ? (
                        <Power size={18} />
                      ) : (
                        <PowerOff size={18} />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => openEdit(rule)}
                      title="Edit rule"
                      className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      <Edit3 size={18} />
                    </button>

                    <button
                      type="button"
                      onClick={() => void deleteRule(rule)}
                      title="Delete rule"
                      className="p-2 rounded-xl border border-rose-100 text-rose-500 hover:bg-rose-50"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit modal */}
      {modalOpen && (
        <Modal
          open
          onClose={closeModal}
          title={
            editingRule
              ? "Edit Pricing Rule"
              : "New Pricing Rule"
          }
          footer={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void saveRule()}
                className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-semibold"
              >
                {editingRule ? "Save Changes" : "Create Rule"}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Rule name */}
            <div>
              <label
                htmlFor="pricing-rule-name"
                className="block text-xs font-semibold text-slate-600 mb-1.5"
              >
                Rule Name *
              </label>

              <input
                id="pricing-rule-name"
                value={form.name}
                onChange={(event) =>
                  setForm({
                    ...form,
                    name: event.target.value,
                  })
                }
                placeholder="e.g. Christmas Promotion"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="pricing-rule-description"
                className="block text-xs font-semibold text-slate-600 mb-1.5"
              >
                Description
              </label>

              <textarea
                id="pricing-rule-description"
                value={form.description}
                onChange={(event) =>
                  setForm({
                    ...form,
                    description: event.target.value,
                  })
                }
                placeholder="Optional description..."
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Target */}
            <div>
              <label
                htmlFor="pricing-rule-target"
                className="block text-xs font-semibold text-slate-600 mb-1.5"
              >
                Applies To
              </label>

              <select
                id="pricing-rule-target"
                value={form.target}
                onChange={(event) =>
                  setForm({
                    ...form,
                    target: event.target.value as PricingRuleTarget,
                    productId: "",
                  })
                }
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all_products">
                  All Products
                </option>
                <option value="product">
                  Specific Product
                </option>
              </select>
            </div>

            {/* Product */}
            {form.target === "product" && (
              <div>
                <label
                  htmlFor="pricing-rule-product"
                  className="block text-xs font-semibold text-slate-600 mb-1.5"
                >
                  Product *
                </label>

                <select
                  id="pricing-rule-product"
                  value={form.productId}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      productId: event.target.value,
                    })
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">
                    Select product
                  </option>

                  {products
                    .filter((product) => product.active)
                    .map((product) => (
                      <option
                        key={product.id}
                        value={product.id}
                      >
                        {product.name} ({product.sku})
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Adjustment */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="pricing-rule-adjustment-type"
                  className="block text-xs font-semibold text-slate-600 mb-1.5"
                >
                  Adjustment
                </label>

                <select
                  id="pricing-rule-adjustment-type"
                  value={form.adjustmentType}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      adjustmentType:
                        event.target.value as PricingAdjustmentType,
                    })
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="percentage">
                    Percentage
                  </option>
                  <option value="fixed_amount">
                    Fixed Amount
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="pricing-rule-direction"
                  className="block text-xs font-semibold text-slate-600 mb-1.5"
                >
                  Direction
                </label>

                <select
                  id="pricing-rule-direction"
                  value={form.direction}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      direction:
                        event.target.value as PricingDirection,
                    })
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="decrease">
                    Decrease
                  </option>
                  <option value="increase">
                    Increase
                  </option>
                </select>
              </div>
            </div>

            {/* Value */}
            <div>
              <label
                htmlFor="pricing-rule-adjustment-value"
                className="block text-xs font-semibold text-slate-600 mb-1.5"
              >
                Adjustment Value *
                <span className="text-slate-400 font-normal ml-1">
                  {form.adjustmentType === "percentage"
                    ? "(%)"
                    : "(₦)"}
                </span>
              </label>

              <input
                id="pricing-rule-adjustment-value"
                type="number"
                min="0"
                step={
                  form.adjustmentType === "percentage"
                    ? "0.01"
                    : "0.01"
                }
                value={form.adjustmentValue}
                onChange={(event) =>
                  setForm({
                    ...form,
                    adjustmentValue: event.target.value,
                  })
                }
                placeholder={
                  form.adjustmentType === "percentage"
                    ? "10"
                    : "500"
                }
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Minimum quantity */}
            <div>
              <label
                htmlFor="pricing-rule-minimum-quantity"
                className="block text-xs font-semibold text-slate-600 mb-1.5"
              >
                Minimum Quantity
              </label>

              <input
                id="pricing-rule-minimum-quantity"
                type="number"
                min="1"
                step="1"
                value={form.minimumQuantity}
                onChange={(event) =>
                  setForm({
                    ...form,
                    minimumQuantity: event.target.value,
                  })
                }
                placeholder="Optional"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              <p className="text-[11px] text-slate-400 mt-1">
                Leave empty to apply regardless of quantity.
              </p>
            </div>

            {/* Schedule */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="pricing-rule-starts-at"
                  className="block text-xs font-semibold text-slate-600 mb-1.5"
                >
                  Start Date
                </label>

                <input
                  id="pricing-rule-starts-at"
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      startsAt: event.target.value,
                    })
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label
                  htmlFor="pricing-rule-ends-at"
                  className="block text-xs font-semibold text-slate-600 mb-1.5"
                >
                  End Date
                </label>

                <input
                  id="pricing-rule-ends-at"
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      endsAt: event.target.value,
                    })
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Active */}
            <label className="flex items-center justify-between gap-3 bg-slate-50 rounded-xl p-3 cursor-pointer">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Enable Rule
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  The rule can be applied when its schedule is active.
                </p>
              </div>

              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) =>
                  setForm({
                    ...form,
                    active: event.target.checked,
                  })
                }
                className="w-4 h-4 accent-indigo-600"
              />
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
