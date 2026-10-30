
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Loader2,
  Printer,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

import type {
  Sale,
  SaleItem,
  SalePayment,
} from "../../types";

import { naira } from "../../lib/money";
import { db, getSetting } from "../../db/database";
import { Modal } from "../../components/Modal";

interface ReceiptData {
  sale: Sale;
  items: SaleItem[];
}

interface ReceiptModalProps {
  receipt: ReceiptData;
  onClose: () => void;
}

interface ReceiptPaymentSummary {
  payments: SalePayment[];
  amountPaidKobo: number;
  balanceKobo: number;
}

function safeNumber(value: unknown): number {
  const numberValue = Number(value);

  return Number.isSafeInteger(numberValue)
    ? numberValue
    : 0;
}

function isValidKobo(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function formatDateTime(
  value: string | Date | undefined,
): string {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-NG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function paymentMethodLabel(
  method: Sale["paymentMethod"],
): string {
  switch (method) {
    case "cash":
      return "Cash";

    case "transfer":
      return "Bank Transfer";

    case "credit":
      return "Credit";

    case "card":
      return "Card";

    case "qr":
      return "QR";

    default:
      return String(method);
  }
}

function getReceiptNumber(sale: Sale): string {
  return sale.receiptNo || sale.id;
}

/**
 * Loads the actual payments recorded against a sale.
 *
 * For credit sales:
 * - SalePayment records are the primary source.
 * - Debt.amountPaidKobo is the historical fallback.
 *
 * For non-credit sales without payment rows, the
 * original sale total is treated as paid.
 */
async function loadReceiptPaymentSummary(
  sale: Sale,
): Promise<ReceiptPaymentSummary> {
  const totalKobo = sale.totalKobo;

  if (!isValidKobo(totalKobo)) {
    throw new Error(
      "The sale has an invalid total amount.",
    );
  }

  const [paymentRows, debt] = await Promise.all([
    db.salePayments
      .where("saleId")
      .equals(sale.id)
      .toArray(),

    db.debts
      .where("saleId")
      .equals(sale.id)
      .first(),
  ]);

  const validPaymentRows = paymentRows.every(
    (payment) =>
      isValidKobo(payment.amountKobo),
  );

  const paymentTotal = validPaymentRows
    ? paymentRows.reduce(
        (total, payment) =>
          total + payment.amountKobo,
        0,
      )
    : -1;

  const validPaymentTotal =
    Number.isSafeInteger(paymentTotal) &&
    paymentTotal >= 0 &&
    paymentTotal <= totalKobo;

  if (paymentRows.length > 0 && validPaymentTotal) {
    return {
      payments: paymentRows,
      amountPaidKobo: paymentTotal,
      balanceKobo: totalKobo - paymentTotal,
    };
  }

  /*
   * Historical credit-sale fallback.
   */
  if (sale.paymentMethod === "credit") {
    const historicalPaidKobo =
      debt && isValidKobo(debt.amountPaidKobo)
        ? debt.amountPaidKobo
        : 0;

    const amountPaidKobo =
      historicalPaidKobo <= totalKobo
        ? historicalPaidKobo
        : 0;

    return {
      payments: [],
      amountPaidKobo,
      balanceKobo:
        totalKobo - amountPaidKobo,
    };
  }

  /*
   * Non-credit historical sales may not have
   * a separate payment row in older records.
   */
  return {
    payments: [],
    amountPaidKobo: totalKobo,
    balanceKobo: 0,
  };
}

function ReceiptContent({
  receipt,
  paymentSummary,
  businessName,
  businessPhone,
  businessEmail,
  businessAddress,
  receiptFooter,
}: {
  receipt: ReceiptData;
  paymentSummary: ReceiptPaymentSummary;
  businessName: string;
  businessPhone: string;
  businessEmail: string;
  businessAddress: string;
  receiptFooter: string;
}) {
  const { sale, items } = receipt;

  const subtotalKobo = safeNumber(
    sale.subtotalKobo,
  );

  const discountKobo = safeNumber(
    sale.discountKobo,
  );

  const totalKobo = safeNumber(
    sale.totalKobo,
  );

  return (
    <div
      className="receipt-content"
      style={{
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        background: "#ffffff",
        color: "#000000",
        padding: "4mm",
        margin: "0",
        fontFamily:
          '"Arial", "Segoe UI", "Noto Sans", "DejaVu Sans", sans-serif',
        fontSize: "10px",
        lineHeight: 1.35,
        overflow: "visible",
      }}
    >
      <div
        style={{
          textAlign: "center",
          fontWeight: 700,
          fontSize: "15px",
          marginBottom: "3px",
        }}
      >
        {businessName}
      </div>

      {businessAddress && (
        <div
          style={{
            textAlign: "center",
            fontSize: "9px",
            marginBottom: "1px",
            wordBreak: "break-word",
          }}
        >
          {businessAddress}
        </div>
      )}

      {businessPhone && (
        <div
          style={{
            textAlign: "center",
            fontSize: "9px",
            marginBottom: "1px",
          }}
        >
          Tel: {businessPhone}
        </div>
      )}

      {businessEmail && (
        <div
          style={{
            textAlign: "center",
            fontSize: "9px",
            wordBreak: "break-word",
          }}
        >
          {businessEmail}
        </div>
      )}

      <div
        style={{
          borderTop: "1px dashed #000",
          margin: "7px 0",
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "10px",
          marginBottom: "2px",
        }}
      >
        <span style={{ flex: "0 0 auto" }}>
          Receipt:
        </span>

        <span
          style={{
            flex: "1 1 auto",
            minWidth: 0,
            textAlign: "right",
            wordBreak: "break-word",
          }}
        >
          {getReceiptNumber(sale)}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "10px",
          marginBottom: "2px",
        }}
      >
        <span style={{ flex: "0 0 auto" }}>
          Date:
        </span>

        <span
          style={{
            flex: "1 1 auto",
            minWidth: 0,
            textAlign: "right",
            wordBreak: "break-word",
          }}
        >
          {formatDateTime(sale.createdAt)}
        </span>
      </div>

      {sale.cashierName && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "10px",
            marginBottom: "2px",
          }}
        >
          <span style={{ flex: "0 0 auto" }}>
            Cashier:
          </span>

          <span
            style={{
              flex: "1 1 auto",
              minWidth: 0,
              textAlign: "right",
              wordBreak: "break-word",
            }}
          >
            {sale.cashierName}
          </span>
        </div>
      )}

      {sale.customerName && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "10px",
            marginBottom: "2px",
          }}
        >
          <span style={{ flex: "0 0 auto" }}>
            Customer:
          </span>

          <span
            style={{
              flex: "1 1 auto",
              minWidth: 0,
              textAlign: "right",
              wordBreak: "break-word",
            }}
          >
            {sale.customerName}
          </span>
        </div>
      )}

      {sale.customerPhone && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "10px",
            marginBottom: "2px",
          }}
        >
          <span style={{ flex: "0 0 auto" }}>
            Phone:
          </span>

          <span
            style={{
              flex: "1 1 auto",
              minWidth: 0,
              textAlign: "right",
              wordBreak: "break-word",
            }}
          >
            {sale.customerPhone}
          </span>
        </div>
      )}

      <div
        style={{
          borderTop: "1px dashed #000",
          margin: "7px 0",
        }}
      />

      <table
        style={{
          width: "100%",
          maxWidth: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                textAlign: "left",
                width: "45%",
                paddingBottom: "4px",
                fontWeight: 700,
                overflow: "hidden",
              }}
            >
              Item
            </th>

            <th
              style={{
                textAlign: "right",
                width: "13%",
                paddingBottom: "4px",
                fontWeight: 700,
              }}
            >
              Qty
            </th>

            <th
              style={{
                textAlign: "right",
                width: "42%",
                paddingBottom: "4px",
                fontWeight: 700,
                overflow: "hidden",
              }}
            >
              Amount
            </th>
          </tr>
        </thead>

        <tbody>
          {items.map((item) => {
            const quantity = safeNumber(
              item.quantity,
            );

            const lineTotal = safeNumber(
              item.lineTotalKobo,
            );

            return (
              <tr key={item.id}>
                <td
                  style={{
                    textAlign: "left",
                    verticalAlign: "top",
                    padding: "2px 4px 2px 0",
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                  }}
                >
                  {item.productNameSnapshot}
                </td>

                <td
                  style={{
                    textAlign: "right",
                    verticalAlign: "top",
                    padding: "2px 2px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {quantity}
                </td>

                <td
                  style={{
                    textAlign: "right",
                    verticalAlign: "top",
                    padding: "2px 0 2px 4px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                  }}
                >
                  {naira(lineTotal)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div
        style={{
          borderTop: "1px dashed #000",
          margin: "7px 0",
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "10px",
          marginBottom: "2px",
        }}
      >
        <span>Subtotal</span>

        <span
          style={{
            textAlign: "right",
            whiteSpace: "nowrap",
          }}
        >
          {naira(subtotalKobo)}
        </span>
      </div>

      {discountKobo > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "10px",
            marginBottom: "2px",
          }}
        >
          <span>Discount</span>

          <span
            style={{
              textAlign: "right",
              whiteSpace: "nowrap",
            }}
          >
            -{naira(discountKobo)}
          </span>
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "10px",
          fontWeight: 700,
          fontSize: "13px",
          marginTop: "5px",
        }}
      >
        <span>TOTAL</span>

        <span
          style={{
            textAlign: "right",
            whiteSpace: "nowrap",
          }}
        >
          {naira(totalKobo)}
        </span>
      </div>

      <div
        style={{
          borderTop: "1px dashed #000",
          margin: "7px 0",
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "10px",
        }}
      >
        <span>Payment:</span>

        <span
          style={{
            textAlign: "right",
            whiteSpace: "nowrap",
          }}
        >
          {paymentMethodLabel(sale.paymentMethod)}
        </span>
      </div>

      {sale.paymentMethod === "credit" && (
        <>
          <div
            style={{
              marginTop: "7px",
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            CREDIT SALE
          </div>

          {paymentSummary.payments.map(
            (payment) => (
              <div
                key={payment.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "10px",
                  marginTop: "3px",
                }}
              >
                <span>
                  {paymentMethodLabel(payment.method)}
                </span>

                <span
                  style={{
                    textAlign: "right",
                    whiteSpace: "nowrap",
                  }}
                >
                  {naira(payment.amountKobo)}
                </span>
              </div>
            ),
          )}

          <div
            style={{
              borderTop: "1px dashed #000",
              margin: "7px 0",
            }}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "10px",
              marginBottom: "3px",
            }}
          >
            <span>Amount paid</span>

            <span
              style={{
                textAlign: "right",
                whiteSpace: "nowrap",
                fontWeight: 700,
              }}
            >
              {naira(paymentSummary.amountPaidKobo)}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "10px",
              fontWeight: 700,
              fontSize: "12px",
            }}
          >
            <span>Outstanding balance</span>

            <span
              style={{
                textAlign: "right",
                whiteSpace: "nowrap",
              }}
            >
              {naira(paymentSummary.balanceKobo)}
            </span>
          </div>
        </>
      )}

      {sale.status === "voided" && (
        <div
          style={{
            marginTop: "6px",
            fontWeight: 700,
            textAlign: "center",
          }}
        >
          VOIDED
        </div>
      )}

      {sale.status === "refunded" && (
        <div
          style={{
            marginTop: "6px",
            fontWeight: 700,
            textAlign: "center",
          }}
        >
          REFUNDED
        </div>
      )}

      <div
        style={{
          borderTop: "1px dashed #000",
          margin: "7px 0",
        }}
      />

      <div
        style={{
          textAlign: "center",
          whiteSpace: "pre-wrap",
          fontSize: "9px",
          wordBreak: "break-word",
          overflowWrap: "anywhere",
        }}
      >
        {receiptFooter}
      </div>
    </div>
  );
}

export function ReceiptModal({
  receipt,
  onClose,
}: ReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const [downloading, setDownloading] =
    useState(false);

  const [paymentLoading, setPaymentLoading] =
    useState(true);

  const [paymentSummary, setPaymentSummary] =
    useState<ReceiptPaymentSummary>({
      payments: [],
      amountPaidKobo: 0,
      balanceKobo: 0,
    });

  const [businessName, setBusinessName] =
    useState("Eby-Gold Superstores");

  const [businessPhone, setBusinessPhone] =
    useState("");

  const [businessEmail, setBusinessEmail] =
    useState("");

  const [businessAddress, setBusinessAddress] =
    useState("");

  const [receiptFooter, setReceiptFooter] =
    useState("Thank you for shopping with us!");

  useEffect(() => {
    let cancelled = false;

    async function loadReceiptSettings() {
      try {
        const [
          storedBusinessName,
          storedBusinessPhone,
          storedBusinessEmail,
          storedBusinessAddress,
          storedReceiptFooter,
        ] = await Promise.all([
          getSetting(
            "businessName",
            "Eby-Gold Superstores",
          ),

          getSetting("businessPhone", ""),

          getSetting("businessEmail", ""),

          getSetting("businessAddress", ""),

          getSetting(
            "receiptFooter",
            "Thank you for shopping with us!",
          ),
        ]);

        if (cancelled) return;

        if (typeof storedBusinessName === "string") {
          setBusinessName(storedBusinessName);
        }

        if (typeof storedBusinessPhone === "string") {
          setBusinessPhone(storedBusinessPhone);
        }

        if (typeof storedBusinessEmail === "string") {
          setBusinessEmail(storedBusinessEmail);
        }

        if (typeof storedBusinessAddress === "string") {
          setBusinessAddress(storedBusinessAddress);
        }

        if (typeof storedReceiptFooter === "string") {
          setReceiptFooter(storedReceiptFooter);
        }
      } catch (error) {
        console.error(
          "Failed to load receipt settings:",
          error,
        );
      }
    }

    void loadReceiptSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Load payment details for this specific receipt.
   */
  useEffect(() => {
    let cancelled = false;

    setPaymentLoading(true);

    setPaymentSummary({
      payments: [],
      amountPaidKobo: 0,
      balanceKobo: 0,
    });

    async function loadPayments() {
      try {
        const summary =
          await loadReceiptPaymentSummary(
            receipt.sale,
          );

        if (!cancelled) {
          setPaymentSummary(summary);
        }
      } catch (error) {
        console.error(
          "Failed to load receipt payment details:",
          error,
        );

        if (!cancelled) {
          const totalKobo =
            isValidKobo(receipt.sale.totalKobo)
              ? receipt.sale.totalKobo
              : 0;

          setPaymentSummary({
            payments: [],
            amountPaidKobo:
              receipt.sale.paymentMethod === "credit"
                ? 0
                : totalKobo,
            balanceKobo:
              receipt.sale.paymentMethod === "credit"
                ? totalKobo
                : 0,
          });
        }
      } finally {
        if (!cancelled) {
          setPaymentLoading(false);
        }
      }
    }

    void loadPayments();

    return () => {
      cancelled = true;
    };
  }, [receipt.sale]);

  const receiptNumber = useMemo(
    () => getReceiptNumber(receipt.sale),
    [receipt.sale],
  );

  const handlePrint = () => {
    if (paymentLoading) return;

    window.print();
  };

  const handleDownloadPdf = async () => {
    if (
      !receiptRef.current ||
      downloading ||
      paymentLoading
    ) {
      return;
    }

    setDownloading(true);

    try {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          resolve();
        });
      });

      const element = receiptRef.current;

      const canvas = await html2canvas(element, {
        backgroundColor: "#ffffff",
        scale: 3,
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 0,
        width: element.scrollWidth,
        height: element.scrollHeight,
        windowWidth: Math.max(
          document.documentElement.clientWidth,
          element.scrollWidth,
        ),
        windowHeight: Math.max(
          document.documentElement.clientHeight,
          element.scrollHeight,
        ),
      });

      if (!canvas.width || !canvas.height) {
        throw new Error(
          "Receipt image has an invalid size.",
        );
      }

      const pdfWidthMm = 80;

      const pdfHeightMm =
        (canvas.height / canvas.width) *
        pdfWidthMm;

      if (
        !Number.isFinite(pdfHeightMm) ||
        pdfHeightMm <= 0
      ) {
        throw new Error(
          "Unable to calculate PDF receipt height.",
        );
      }

      const imageData =
        canvas.toDataURL("image/png", 1.0);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [
          pdfWidthMm,
          pdfHeightMm,
        ],
        compress: true,
      });

      pdf.addImage(
        imageData,
        "PNG",
        0,
        0,
        pdfWidthMm,
        pdfHeightMm,
        undefined,
        "FAST",
      );

      const safeFileName =
        receiptNumber
          .replace(/[^\w.-]+/g, "_")
          .replace(/^_+|_+$/g, "") ||
        "receipt";

      pdf.save(`${safeFileName}.pdf`);
    } catch (error) {
      console.error(
        "Failed to generate receipt PDF:",
        error,
      );

      window.alert(
        "Unable to generate the PDF receipt. Please try again.",
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Receipt"
      size="sm"
    >
      <div
        ref={receiptRef}
        className="bg-white"
        style={{
          width: "80mm",
          maxWidth: "80mm",
          boxSizing: "border-box",
          paddingLeft: "2mm",
          paddingRight: "2mm",
          margin: "0 auto",
          background: "#ffffff",
          overflow: "visible",
        }}
      >
        {paymentLoading ? (
          <div
            className="flex items-center justify-center py-8 text-slate-500"
            style={{
              minHeight: "100px",
            }}
          >
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading payment details...
          </div>
        ) : (
          <ReceiptContent
            receipt={receipt}
            paymentSummary={paymentSummary}
            businessName={businessName}
            businessPhone={businessPhone}
            businessEmail={businessEmail}
            businessAddress={businessAddress}
            receiptFooter={receiptFooter}
          />
        )}
      </div>

      <div className="print:hidden mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={handlePrint}
          disabled={paymentLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Printer className="h-4 w-4" />
          Print
        </button>

        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={downloading || paymentLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}

          {paymentLoading
            ? "Loading..."
            : downloading
              ? "Generating PDF..."
              : "Download PDF"}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          New Sale
        </button>
      </div>
    </Modal>
  );
}

export default ReceiptModal;
