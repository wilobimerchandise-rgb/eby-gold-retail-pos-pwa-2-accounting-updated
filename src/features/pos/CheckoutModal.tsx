import { useMemo, useState } from "react";

import {
  CheckCircle2,
  Banknote,
  ArrowLeftRight,
  Wallet,
  CreditCard as CreditCardIcon,
  QrCode as QrCodeIcon,
} from "lucide-react";

import type { PaymentMethod } from "@/types";

import {
  naira,
  addKobo,
  subKobo,
  parseNairaToKobo,
} from "@/lib/money";

import { Modal } from "@/components/Modal";
import { toast } from "@/components/Toast";


interface CheckoutProps {
  totalKobo: number;

  onClose: () => void;

  onComplete: (
    method: PaymentMethod,
    amountPaidKobo: number,
    customerName: string,
    customerPhone: string,
    initialPaymentMethod: Exclude<PaymentMethod, "credit">,
  ) => void | Promise<void>;

  prefillCustomer?: {
    name: string;
    phone: string;
  } | null;
}


export function CheckoutModal({
  totalKobo,
  onClose,
  onComplete,
  prefillCustomer,
}: CheckoutProps) {
  const [method, setMethod] =
    useState<PaymentMethod>("cash");

  const [paidInput, setPaidInput] =
    useState("");

  const [initialPaymentMethod, setInitialPaymentMethod] =
    useState<Exclude<PaymentMethod, "credit">>("cash");

  const [customerName, setCustomerName] =
    useState(
      prefillCustomer?.name ?? "",
    );

  const [customerPhone, setCustomerPhone] =
    useState(
      prefillCustomer?.phone ?? "",
    );

  const [completing, setCompleting] =
    useState(false);


  /**
   * Whether this is a credit sale.
   */
  const isCredit =
    method === "credit";


  const parsedPaidKobo = useMemo(
    () => paidInput.trim() === "" ? 0 : parseNairaToKobo(paidInput),
    [paidInput],
  );

  const paidKobo = parsedPaidKobo ?? 0;
  const hasInvalidAmount =
    paidInput.trim() !== "" && parsedPaidKobo === null;


  /**
   * Payment sufficiency.
   *
   * Cash and transfer payments must
   * cover the full sale amount.
   */
  const sufficient =
    paidKobo >= totalKobo;


  /**
   * Change is only relevant for cash.
   */
  const changeKobo =
    method === "cash"
      ? Math.max(
          0,
          subKobo(
            paidKobo,
            totalKobo,
          ),
        )
      : 0;


  /**
   * Remaining balance for credit sales.
   *
   * This allows the UI to support
   * partial payment credit sales.
   */
  const creditBalanceKobo =
    Math.max(
      0,
      subKobo(
        totalKobo,
        paidKobo,
      ),
    );


  /**
   * Quick cash amounts.
   */
  const quickCash = useMemo(
    () => [
      totalKobo,

      addKobo(
        totalKobo,
        50000,
      ),

      addKobo(
        totalKobo,
        100000,
      ),

      addKobo(
        totalKobo,
        200000,
      ),
    ],
    [totalKobo],
  );


  const methods: {
    id: PaymentMethod;
    label: string;
    icon: typeof Banknote;
  }[] = [
    { id: "cash", label: "Cash", icon: Banknote },
    { id: "transfer", label: "Transfer", icon: ArrowLeftRight },
    { id: "card", label: "Card", icon: CreditCardIcon },
    { id: "qr", label: "QR", icon: QrCodeIcon },
    { id: "credit", label: "Credit", icon: Wallet },
  ];


    /**
   * Change payment method.
   *
   * Clear the entered amount so a
   * previous payment method does not
   * accidentally affect the new one.
   */
  const selectMethod = (
    nextMethod: PaymentMethod,
  ) => {
    setMethod(nextMethod);

    setPaidInput("");
  };


  /**
   * Complete checkout.
   */
  const handleComplete = async () => {
    if (completing) {
      return;
    }


    /**
     * Validate customer information
     * for credit sales.
     */
    if (isCredit) {
      if (!customerName.trim()) {
        toast(
          "error",
          "Customer name is required for credit sales.",
        );

        return;
      }

      if (!customerPhone.trim()) {
        toast(
          "error",
          "Customer phone number is required for credit sales.",
        );

        return;
      }
    }


    /**
     * Validate amount input when
     * the user entered something.
     */
    if (hasInvalidAmount) {
      toast(
        "error",
        "Enter a valid payment amount.",
      );

      return;
    }


    /**
     * Cash and transfer must be
     * fully paid.
     */
    if (!isCredit) {
      if (!paidInput.trim()) {
        toast(
          "error",
          "Enter the amount paid.",
        );

        return;
      }

      if (!sufficient) {
        toast(
          "error",
          "Amount paid is less than the total.",
        );

        return;
      }
    }


    /**
     * For credit sales:
     *
     * - Blank amount means no payment.
     * - A partial amount is allowed.
     * - Payment cannot exceed the total.
     */
    if (
      isCredit &&
      paidKobo > totalKobo
    ) {
      toast(
        "error",
        "Credit payment cannot be greater than the total.",
      );

      return;
    }


    try {
      setCompleting(true);

      /**
       * Pass the actual amount paid.
       *
       * For a fully unpaid credit sale,
       * this will be zero.
       *
       * For partial credit, this will
       * contain the customer's payment.
       */
      await onComplete(
        method,
        paidKobo,
        customerName.trim(),
        customerPhone.trim(),
        method === "credit" ? initialPaymentMethod : method,
      );
    } catch (error) {
      console.error(
        "Failed to complete checkout",
        error,
      );

      toast(
        "error",
        "Failed to complete checkout.",
      );
    } finally {
      setCompleting(false);
    }
  };


  return (
    <Modal
      open
      onClose={onClose}
      title="Checkout"
      footer={
        <button
          type="button"
          onClick={() =>
            void handleComplete()
          }
          disabled={completing}
          className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold text-base active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:bg-indigo-300 disabled:cursor-not-allowed"
        >
          <CheckCircle2 size={20} />

          {completing
            ? "Processing..."
            : isCredit
              ? "Record Credit Sale"
              : "Complete Sale"}
        </button>
      }
    >
      <div className="space-y-4">

        {/* Total */}

        <div className="bg-indigo-50 rounded-xl p-4 text-center">

          <p className="text-sm text-indigo-700 font-medium">
            Total Due
          </p>

          <p className="text-3xl font-bold text-indigo-800">
            {naira(totalKobo)}
          </p>
        </div>


        {/* Payment method */}

        <div>

          <p className="text-xs font-semibold text-slate-500 mb-1.5">
            Payment Method
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">

            {methods.map(
              (paymentMethod) => {
                const Icon =
                  paymentMethod.icon;

                return (
                  <button
                    key={
                      paymentMethod.id
                    }
                    type="button"
                    onClick={() =>
                      selectMethod(
                        paymentMethod.id,
                      )
                    }
                    disabled={completing}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-colors disabled:opacity-60 ${
                      method ===
                      paymentMethod.id
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <Icon size={20} />

                    <span className="text-xs font-semibold">
                      {
                        paymentMethod.label
                      }
                    </span>
                  </button>
                );
              },
            )}

          </div>
        </div>


        {isCredit && (
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1.5">
              Initial Deposit Payment Method
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {([
                ["cash", "Cash"],
                ["transfer", "Transfer"],
                ["card", "Card"],
                ["qr", "QR"],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  disabled={completing}
                  onClick={() => setInitialPaymentMethod(id)}
                  className={`py-2.5 rounded-lg border-2 text-sm font-semibold disabled:opacity-60 ${
                    initialPaymentMethod === id
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 text-slate-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Payment amount */}

        <div>

          <div className="flex items-center justify-between mb-1.5">

            <p className="text-xs font-semibold text-slate-500">

              {isCredit
                ? "Amount Paid Now (Optional)"
                : "Amount Paid"}

            </p>

            {isCredit && (
              <span className="text-xs text-slate-400">
                Leave blank for full credit
              </span>
            )}

          </div>


          <div className="relative">

            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
              ₦
            </span>

            <input
              type="text"
              inputMode="decimal"
              value={paidInput}
              disabled={completing}
              onChange={(event) =>
                setPaidInput(
                  event.target.value,
                )
              }
              placeholder={
                isCredit
                  ? "0.00"
                  : (
                      totalKobo / 100
                    ).toString()
              }
              className={`w-full pl-8 pr-3 py-3 rounded-xl border text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 ${
                hasInvalidAmount
                  ? "border-rose-400"
                  : "border-slate-200"
              }`}
            />

          </div>


          {/* Quick cash buttons */}

          {method === "cash" && (

            <div className="flex gap-2 mt-2 flex-wrap">

              {quickCash.map(
                (amount, index) => (

                  <button
                    key={index}
                    type="button"
                    disabled={completing}
                    onClick={() =>
                      setPaidInput(
                        (
                          amount / 100
                        ).toString(),
                      )
                    }
                    className="text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg disabled:opacity-50"
                  >
                    {naira(amount)}
                  </button>

                ),
              )}

            </div>
          )}


          {/* Cash change */}

          {method === "cash" &&
            paidInput.trim() !== "" &&
            !hasInvalidAmount && (

              <div className="flex items-center justify-between mt-3 text-sm">

                <span className="text-slate-500">
                  Change
                </span>

                <span
                  className={`font-bold ${
                    changeKobo > 0
                      ? "text-emerald-600"
                      : "text-slate-900"
                  }`}
                >
                  {naira(changeKobo)}
                </span>

              </div>

            )}


          {/* Transfer status */}

          {method === "transfer" &&
            paidInput.trim() !== "" &&
            !hasInvalidAmount && (

              <div className="flex items-center justify-between mt-3 text-sm">

                <span className="text-slate-500">
                  Payment Status
                </span>

                <span
                  className={`font-bold ${
                    sufficient
                      ? "text-emerald-600"
                      : "text-rose-600"
                  }`}
                >
                  {sufficient
                    ? "Fully paid"
                    : `Short by ${naira(
                        subKobo(
                          totalKobo,
                          paidKobo,
                        ),
                      )}`}
                </span>

              </div>

            )}


          {/* Credit balance */}

          {isCredit && (

            <div className="flex items-center justify-between mt-3 text-sm bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">

              <span className="text-amber-700 font-medium">
                Balance to Record
              </span>

              <span className="font-bold text-amber-800">
                {naira(
                  creditBalanceKobo,
                )}
              </span>

            </div>

          )}

        </div>


        {/* Customer information */}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">

          {/* Customer name */}

          <div>

            <p className="text-xs font-semibold text-slate-500 mb-1.5">

              Customer Name

              {isCredit && (
                <span className="text-rose-500">
                  {" "}
                  *
                </span>
              )}

            </p>

            <input
              value={customerName}
              disabled={completing}
              onChange={(event) =>
                setCustomerName(
                  event.target.value,
                )
              }
              placeholder={
                isCredit
                  ? "Required"
                  : "Optional"
              }
              className={`w-full px-3 py-2.5 rounded-xl border text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 ${
                isCredit &&
                !customerName.trim()
                  ? "border-rose-300"
                  : "border-slate-200"
              }`}
            />

          </div>


          {/* Customer phone */}

          <div>

            <p className="text-xs font-semibold text-slate-500 mb-1.5">

              Phone

              {isCredit && (
                <span className="text-rose-500">
                  {" "}
                  *
                </span>
              )}

            </p>

            <input
              type="tel"
              value={customerPhone}
              disabled={completing}
              onChange={(event) =>
                setCustomerPhone(
                  event.target.value,
                )
              }
              placeholder={
                isCredit
                  ? "Required"
                  : "Optional"
              }
              className={`w-full px-3 py-2.5 rounded-xl border text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 ${
                isCredit &&
                !customerPhone.trim()
                  ? "border-rose-300"
                  : "border-slate-200"
              }`}
            />

          </div>

        </div>


        {/* Credit information */}

        {isCredit && (

          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3">

            <p className="font-semibold mb-1">
              Credit Sale
            </p>

            <p>
              The unpaid balance will be recorded
              as a customer debt. Customer name
              and phone number are required.
            </p>

          </div>

        )}

      </div>
    </Modal>
  );
}
