import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Wallet,
  Phone,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingDown,
  Users,
  Receipt,
  Loader2,
  MessageCircle,
  Image as ImageIcon,
  Share2,
  Download,
  Settings,
  Save,
  X,
  Copy,
} from "lucide-react";
import { db, getSetting, setSetting, logAuditEvent } from "@/db/database";
import type { Debt, DebtPayment, DebtStatus, PaymentMethod, SaleItem, Sale } from "@/types";
import { naira, addKobo, subKobo, parseNairaToKobo } from "@/lib/money";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/Toast";
import { v4 as uuid } from "uuid";


const PAYMENT_BANK_NAME_KEY = "paymentBankName";
const PAYMENT_ACCOUNT_NAME_KEY = "paymentAccountName";
const PAYMENT_ACCOUNT_NUMBER_KEY = "paymentAccountNumber";
const PAYMENT_TRANSFER_INSTRUCTIONS_KEY = "paymentTransferInstructions";

interface PaymentDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  transferInstructions: string;
}

const DEFAULT_PAYMENT_DETAILS: PaymentDetails = {
  bankName: "UNITED BANK FOR AFRICA",
  accountName: "EBERE FAVOUR AKAOLISA",
  accountNumber: "2189015307",
  transferInstructions: "Bank Transfer",
};

const STATUS_STYLES: Record<
  DebtStatus,
  { label: string; className: string }
> = {
  unpaid: {
    label: "Unpaid",
    className: "bg-rose-100 text-rose-700",
  },
  partially_paid: {
    label: "Partially Paid",
    className: "bg-amber-100 text-amber-700",
  },
  paid: {
    label: "Paid",
    className: "bg-emerald-100 text-emerald-700",
  },
};
async function loadPaymentDetails(): Promise<PaymentDetails> {
  try {
    const [
      bankName,
      accountName,
      accountNumber,
      transferInstructions,
    ] = await Promise.all([
      getSetting(
        PAYMENT_BANK_NAME_KEY,
        DEFAULT_PAYMENT_DETAILS.bankName,
      ),
      getSetting(
        PAYMENT_ACCOUNT_NAME_KEY,
        DEFAULT_PAYMENT_DETAILS.accountName,
      ),
      getSetting(
        PAYMENT_ACCOUNT_NUMBER_KEY,
        DEFAULT_PAYMENT_DETAILS.accountNumber,
      ),
      getSetting(
        PAYMENT_TRANSFER_INSTRUCTIONS_KEY,
        DEFAULT_PAYMENT_DETAILS.transferInstructions,
      ),
    ]);

    return {
      bankName:
        typeof bankName === "string" && bankName.trim()
          ? bankName.trim()
          : DEFAULT_PAYMENT_DETAILS.bankName,
      accountName:
        typeof accountName === "string" && accountName.trim()
          ? accountName.trim()
          : DEFAULT_PAYMENT_DETAILS.accountName,
      accountNumber:
        typeof accountNumber === "string" && accountNumber.trim()
          ? accountNumber.trim()
          : DEFAULT_PAYMENT_DETAILS.accountNumber,
      transferInstructions:
        typeof transferInstructions === "string" &&
        transferInstructions.trim()
          ? transferInstructions.trim()
          : DEFAULT_PAYMENT_DETAILS.transferInstructions,
    };
  } catch (error) {
    console.error("Failed to load payment settings:", error);
    return { ...DEFAULT_PAYMENT_DETAILS };
  }
}

async function savePaymentDetails(
  details: PaymentDetails,
): Promise<void> {
  await Promise.all([
    setSetting(PAYMENT_BANK_NAME_KEY, details.bankName.trim()),
    setSetting(PAYMENT_ACCOUNT_NAME_KEY, details.accountName.trim()),
    setSetting(
      PAYMENT_ACCOUNT_NUMBER_KEY,
      details.accountNumber.trim(),
    ),
    setSetting(
      PAYMENT_TRANSFER_INSTRUCTIONS_KEY,
      details.transferInstructions.trim() ||
        DEFAULT_PAYMENT_DETAILS.transferInstructions,
    ),
  ]);
}

function formatDate(iso: string): string {
  const d = new Date(iso);

  return d.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);

  return d.toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalisePhone(phone: string): string {
  const value = phone.replace(/[^\d+]/g, "");

  if (value.startsWith("+")) {
    return value.substring(1);
  }

  if (value.startsWith("234")) {
    return value;
  }

  if (value.startsWith("0")) {
    return `234${value.substring(1)}`;
  }

  return value;
}

function buildWhatsAppMessage(
  debt: Debt,
  paymentDetails: PaymentDetails,
  invoiceNumber: string,
): string {
  const customerName = debt.customerName || "Customer";

  const lines: string[] = [
    `Hello ${customerName},`,
    "",
    "This is a friendly reminder from Eby-Gold Superstores regarding your outstanding balance.",
    "",
    `Outstanding Balance: ${naira(debt.balanceKobo)}`,
    `Original Amount: ${naira(debt.originalAmountKobo)}`,
    `Amount Paid: ${naira(debt.amountPaidKobo)}`,
    `Debt Date: ${formatDate(debt.createdAt)}`,
    `Invoice Number: ${invoiceNumber}`,
  ];

  if (
    paymentDetails.bankName ||
    paymentDetails.accountName ||
    paymentDetails.accountNumber
  ) {
    lines.push("");
    lines.push("PAYMENT INFORMATION");

    if (paymentDetails.bankName) {
      lines.push(`Bank: ${paymentDetails.bankName}`);
    }

    if (paymentDetails.accountName) {
      lines.push(`Account Name: ${paymentDetails.accountName}`);
    }

    if (paymentDetails.accountNumber) {
      lines.push(`Account Number: ${paymentDetails.accountNumber}`);
    }

    lines.push(`Transfer Reference: ${invoiceNumber}`);

    if (paymentDetails.transferInstructions) {
      lines.push("");
      lines.push(paymentDetails.transferInstructions);
    }
  }

  lines.push("");
  lines.push("Please let us know once payment has been made.");
  lines.push("");
  lines.push("Thank you for your patronage.");
  lines.push("Eby-Gold Superstores");

  return lines.join("\n");
}

function buildStatementText(
  debt: Debt,
  paymentDetails: PaymentDetails,
  invoiceNumber: string,
): string {
  const lines: string[] = [
    "EBY-GOLD SUPERSTORES",
    "CUSTOMER DEBT STATEMENT",
    "",
    `Customer: ${debt.customerName || "Customer"}`,
  ];

  if (debt.customerPhone) {
    lines.push(`Phone: ${debt.customerPhone}`);
  }

  lines.push(`Date: ${formatDateTime(debt.createdAt)}`);
  lines.push(`Invoice Number: ${invoiceNumber}`);
  lines.push("");
  lines.push(`Original Amount: ${naira(debt.originalAmountKobo)}`);
  lines.push(`Amount Paid: ${naira(debt.amountPaidKobo)}`);
  lines.push(`Outstanding: ${naira(debt.balanceKobo)}`);

  if (
    paymentDetails.bankName ||
    paymentDetails.accountName ||
    paymentDetails.accountNumber
  ) {
    lines.push("");
    lines.push("PAYMENT INFORMATION");

    if (paymentDetails.bankName) {
      lines.push(`Bank: ${paymentDetails.bankName}`);
    }

    if (paymentDetails.accountName) {
      lines.push(`Account Name: ${paymentDetails.accountName}`);
    }

    if (paymentDetails.accountNumber) {
      lines.push(`Account Number: ${paymentDetails.accountNumber}`);
    }

    lines.push(`Transfer Reference: ${invoiceNumber}`);

    if (paymentDetails.transferInstructions) {
      lines.push("");
      lines.push(paymentDetails.transferInstructions);
    }
  }

  lines.push("");
  lines.push("Thank you for your patronage.");
  lines.push("Eby-Gold Superstores");

  return lines.join("\n");
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;

    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) {
        lines.push(current);
      }

      current = word;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string,
  strokeStyle?: string,
  lineWidth = 1,
): void {
  roundRectPath(ctx, x, y, width, height, radius);

  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }

  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

interface ReminderItem {
  name: string;
  quantity: number;
  unitPriceKobo: number;
  lineTotalKobo: number;
}

interface ReminderTemplateData {
  businessName: string;
  businessPhone?: string;
  businessAddress?: string;
  sale?: Sale;
  items: ReminderItem[];
}

async function loadReminderTemplateData(
  debt: Debt,
): Promise<ReminderTemplateData> {
  const [businessName, businessPhone, businessAddress, sale, saleItems] =
    await Promise.all([
      
      getSetting("businessName", "Eby-Gold Superstores"),
      getSetting("businessPhone", ""),
      getSetting("businessAddress", ""),
      db.sales.get(debt.saleId),
      db.saleItems.where("saleId").equals(debt.saleId).toArray(),
    ]);

  const items: ReminderItem[] = (saleItems as SaleItem[]).map((item) => ({
    name: item.productNameSnapshot,
    quantity: item.quantity,
    unitPriceKobo: item.unitPriceKobo,
    lineTotalKobo: item.lineTotalKobo,
  }));

  return {
    businessName:
      typeof businessName === "string" && businessName.trim()
        ? businessName.trim()
        : "Eby-Gold Superstores",
    businessPhone:
      typeof businessPhone === "string" ? businessPhone.trim() : undefined,
    businessAddress:
      typeof businessAddress === "string" ? businessAddress.trim() : undefined,
    sale,
    items,
  };
}

function createDebtStatementImage(
  debt: Debt,
  paymentDetails: PaymentDetails,
  invoiceNumber: string,
  templateData: ReminderTemplateData,
): Blob {
  const width = 1080;
  const padding = 60;
  const contentWidth = width - padding * 2;
  const workingHeight = 2200;
  const background = "#f8fafc";
  const ink = "#172033";
  const muted = "#64748b";
  const indigo = "#4f46e5";
  const border = "#cbd5e1";
  const green = "#059669";
  const red = "#c9184a";

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = workingHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create statement image");
  }

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, workingHeight);

  // Header — matches the approved Eby-Gold Payment Reminder template.
  ctx.fillStyle = indigo;
  ctx.fillRect(0, 0, width, 240);

  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 44px Arial";
  ctx.fillText(templateData.businessName, padding, 74);

  ctx.font = "bold 34px Arial";
  ctx.fillText("Payment Reminder", padding, 135);

  ctx.font = "26px Arial";
  ctx.fillText(formatDate(debt.createdAt), padding, 184);

  let y = 300;

  ctx.fillStyle = ink;
  ctx.font = "bold 32px Arial";
  ctx.fillText(debt.customerName || "Customer", padding, y);

  y += 42;
  if (debt.customerPhone) {
    ctx.fillStyle = muted;
    ctx.font = "25px Arial";
    ctx.fillText(debt.customerPhone, padding, y);
    y += 42;
  }

  y += 20;
  ctx.fillStyle = ink;
  ctx.font = "bold 30px Arial";
  ctx.fillText("Items Purchased", padding, y);
  y += 48;

  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding, y);
  ctx.lineTo(width - padding, y);
  ctx.stroke();
  y += 40;

  const items = templateData.items;
  if (items.length > 0) {
    for (const item of items) {
      ctx.fillStyle = ink;
      ctx.font = "bold 23px Arial";
      ctx.textAlign = "left";
      ctx.fillText(item.name, padding, y);

      ctx.fillStyle = ink;
      ctx.font = "bold 23px Arial";
      ctx.textAlign = "right";
      ctx.fillText(naira(item.lineTotalKobo), width - padding, y);

      y += 32;
      ctx.fillStyle = muted;
      ctx.font = "22px Arial";
      ctx.textAlign = "left";
      ctx.fillText(
        `${item.quantity} × ${naira(item.unitPriceKobo)}`,
        padding,
        y,
      );
      y += 48;
    }
  } else {
    ctx.fillStyle = muted;
    ctx.font = "22px Arial";
    ctx.fillText("Purchase details unavailable", padding, y);
    y += 48;
  }

  y += 14;

  // Payment information box.
  const paymentInstruction =
    paymentDetails.transferInstructions ||
    "Please use the invoice number as the transfer reference where applicable.";
  const instructionLines = wrapCanvasText(
    ctx,
    paymentInstruction,
    contentWidth - 60,
  ).slice(0, 3);
  const paymentBoxHeight = 275 + instructionLines.length * 30;

  drawRoundedRect(
    ctx,
    40,
    y,
    width - 80,
    paymentBoxHeight,
    25,
    "#ffffff",
    border,
    2,
  );

  ctx.fillStyle = indigo;
  ctx.font = "bold 28px Arial";
  ctx.textAlign = "left";
  ctx.fillText("PAYMENT INFORMATION", 70, y + 48);

  const tableX = 70;
  const tableY = y + 72;
  const tableWidth = width - 140;
  const labelWidth = 270;
  const rowHeight = 52;
  const rows: Array<[string, string]> = [];

  if (paymentDetails.bankName) {
    rows.push(["Bank", paymentDetails.bankName]);
  }
  if (paymentDetails.accountNumber) {
    rows.push(["Account Number", paymentDetails.accountNumber]);
  }
  if (paymentDetails.accountName) {
    rows.push(["Account Name", paymentDetails.accountName]);
  }

  if (rows.length > 0) {
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tableX, tableY, tableWidth, rows.length * rowHeight);
    ctx.beginPath();
    ctx.moveTo(tableX + labelWidth, tableY);
    ctx.lineTo(tableX + labelWidth, tableY + rows.length * rowHeight);
    ctx.stroke();

    rows.forEach(([label, value], index) => {
      const rowY = tableY + index * rowHeight;
      if (index > 0) {
        ctx.beginPath();
        ctx.moveTo(tableX, rowY);
        ctx.lineTo(tableX + tableWidth, rowY);
        ctx.stroke();
      }

      ctx.fillStyle = "#475569";
      ctx.font = "bold 20px Arial";
      ctx.textAlign = "left";
      ctx.fillText(label, tableX + 16, rowY + 33);

      ctx.fillStyle = ink;
      ctx.font = "bold 20px Arial";
      ctx.fillText(value, tableX + labelWidth + 16, rowY + 33);
    });
  }

  let instructionY = tableY + rows.length * rowHeight + 30;
  if (rows.length === 0) {
    instructionY = tableY + 30;
  }

  ctx.fillStyle = muted;
  ctx.font = "18px Arial";
  ctx.textAlign = "left";
  for (const line of instructionLines) {
    ctx.fillText(line, 70, instructionY);
    instructionY += 27;
  }

  y += paymentBoxHeight + 30;

  // Financial summary card.
  const financialHeight = 220;
  drawRoundedRect(
    ctx,
    40,
    y,
    width - 80,
    financialHeight,
    25,
    "#ffffff",
    "#e2e8f0",
    2,
  );

  ctx.fillStyle = muted;
  ctx.font = "23px Arial";
  ctx.textAlign = "left";
  ctx.fillText("Original amount", 70, y + 58);
  ctx.fillText("Amount paid", 70, y + 110);

  ctx.fillStyle = ink;
  ctx.font = "bold 25px Arial";
  ctx.textAlign = "right";
  ctx.fillText(naira(debt.originalAmountKobo), width - 70, y + 58);

  ctx.fillStyle = green;
  ctx.fillText(naira(debt.amountPaidKobo), width - 70, y + 110);

  drawRoundedRect(
    ctx,
    60,
    y + 135,
    width - 120,
    80,
    18,
    "#fff1f2",
  );

  ctx.fillStyle = red;
  ctx.font = "bold 27px Arial";
  ctx.textAlign = "left";
  ctx.fillText("OUTSTANDING BALANCE", 85, y + 185);
  ctx.textAlign = "right";
  ctx.fillText(naira(debt.balanceKobo), width - 85, y + 185);

  y += financialHeight + 65;

  ctx.fillStyle = "#475569";
  ctx.font = "23px Arial";
  ctx.textAlign = "center";
  ctx.fillText(
    "Kindly settle your outstanding balance at your convenience.",
    width / 2,
    y,
  );

  y += 50;
  ctx.fillStyle = "#475569";
  ctx.font = "bold 24px Arial";
  ctx.fillText(
    `Thank you for shopping with ${templateData.businessName}.`,
    width / 2,
    y,
  );

  y += 40;
  ctx.fillStyle = "#94a3b8";
  ctx.font = "20px Arial";
  ctx.fillText(
    "Payment details above are provided for bank transfer.",
    width / 2,
    y,
  );

  const finalHeight = Math.max(y + 65, 900);
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = width;
  outputCanvas.height = finalHeight;
  const outputCtx = outputCanvas.getContext("2d");
  if (!outputCtx) {
    throw new Error("Unable to prepare statement image");
  }

  outputCtx.drawImage(canvas, 0, 0, width, finalHeight, 0, 0, width, finalHeight);

  const dataUrl = outputCanvas.toDataURL("image/png");
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: "image/png" });
}

async function copyImageToClipboard(blob: Blob): Promise<boolean> {
  try {
    if (
      typeof navigator.clipboard?.write !== "function" ||
      typeof ClipboardItem === "undefined"
    ) {
      return false;
    }

    const item = new ClipboardItem({
      "image/png": blob,
    });

    await navigator.clipboard.write([item]);
    return true;
  } catch (error) {
    console.warn("Could not copy debt statement image to clipboard:", error);
    return false;
  }
}

async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DebtTrackerPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [showPaid, setShowPaid] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const all = await db.debts.orderBy("createdAt").reverse().toArray();

      setDebts(all);
    } catch (error) {
      console.error("Failed to load debts:", error);
      toast("error", "Failed to load debt records");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const outstanding = useMemo(
    () => debts.filter((d) => d.status !== "paid"),
    [debts],
  );

  const visible = useMemo(
    () => (showPaid ? debts : outstanding),
    [debts, outstanding, showPaid],
  );

  const totalOutstandingKobo = outstanding.reduce(
    (sum, debt) => addKobo(sum, debt.balanceKobo),
    0,
  );

  const customerCount = new Set(
    outstanding.map(
      (debt) => debt.customerPhone || debt.customerName,
    ),
  ).size;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="bg-rose-50 p-2 rounded-lg">
              <TrendingDown size={18} className="text-rose-600" />
            </div>

            <span className="text-xs font-semibold text-slate-500">
              Total Outstanding
            </span>
          </div>

          <p className="text-2xl font-bold text-slate-900">
            {naira(totalOutstandingKobo)}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="bg-indigo-50 p-2 rounded-lg">
              <Users size={18} className="text-indigo-600" />
            </div>

            <span className="text-xs font-semibold text-slate-500">
              Customers Owing
            </span>
          </div>

          <p className="text-2xl font-bold text-slate-900">
            {customerCount}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="bg-amber-50 p-2 rounded-lg">
              <Receipt size={18} className="text-amber-600" />
            </div>

            <span className="text-xs font-semibold text-slate-500">
              Total Debts
            </span>
          </div>

          <p className="text-2xl font-bold text-slate-900">
            {debts.length}
          </p>
        </div>
      </div>

      {/* Filter toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowPaid(false)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
            !showPaid
              ? "bg-indigo-600 text-white"
              : "bg-white text-slate-500 border border-slate-200"
          }`}
        >
          Outstanding ({outstanding.length})
        </button>

        <button
          onClick={() => setShowPaid(true)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
            showPaid
              ? "bg-indigo-600 text-white"
              : "bg-white text-slate-500 border border-slate-200"
          }`}
        >
          All ({debts.length})
        </button>
      </div>

      {/* List / empty states */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2
            className="text-slate-300 animate-spin"
            size={32}
          />
        </div>
      ) : debts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Wallet size={40} className="mb-2" />

          <p className="font-medium">
            No debts recorded yet
          </p>

          <p className="text-sm">
            Credit sales will appear here automatically
          </p>
        </div>
      ) : visible.length === 0 && !showPaid ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <CheckCircle2
            size={40}
            className="mb-2 text-emerald-400"
          />

          <p className="font-medium">
            All debts are settled
          </p>

          <p className="text-sm">
            No outstanding balances remaining
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {visible.map((debt) => {
            const st = STATUS_STYLES[debt.status];

            return (
              <li key={debt.id}>
                <button
                  onClick={() => setSelectedDebt(debt)}
                  className="w-full text-left bg-white rounded-2xl border border-slate-200 p-4 hover:border-indigo-300 hover:shadow-sm transition-all active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        {debt.customerName}
                      </h3>

                      {debt.customerPhone && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone size={11} />
                          {debt.customerPhone}
                        </p>
                      )}
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${st.className}`}
                    >
                      {st.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-slate-400">
                        Original
                      </p>

                      <p className="font-semibold text-slate-700">
                        {naira(debt.originalAmountKobo)}
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-400">
                        Paid
                      </p>

                      <p className="font-semibold text-emerald-600">
                        {naira(debt.amountPaidKobo)}
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-400">
                        Balance
                      </p>

                      <p className="font-semibold text-rose-600">
                        {naira(debt.balanceKobo)}
                      </p>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                    <Clock size={11} />
                    {formatDate(debt.createdAt)}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Detail modal */}
      {selectedDebt && (
        <DebtDetailModal
          debt={selectedDebt}
          onClose={() => setSelectedDebt(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

interface DebtDetailProps {
  debt: Debt;
  onClose: () => void;
  onChanged: () => void;
}

function DebtDetailModal({
  debt,
  onClose,
  onChanged,
}: DebtDetailProps) {
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);

  const [showPaymentForm, setShowPaymentForm] =
    useState(false);

  const [paymentAmount, setPaymentAmount] =
    useState("");

  const [paymentMethod, setPaymentMethod] =
    useState<Exclude<PaymentMethod, "credit">>("cash");

  const [submitting, setSubmitting] =
    useState(false);

  const [paymentDetails, setPaymentDetails] =
    useState<PaymentDetails>(DEFAULT_PAYMENT_DETAILS);

  const [invoiceNumber, setInvoiceNumber] = useState("");

  const [showPaymentSettings, setShowPaymentSettings] =
    useState(false);

  const [savingPaymentDetails, setSavingPaymentDetails] =
    useState(false);

  const [generatingImage, setGeneratingImage] =
    useState(false);
  const [reminderFile, setReminderFile] = useState<File | null>(null);
  const [reminderTemplateData, setReminderTemplateData] =
    useState<ReminderTemplateData | null>(null);
  const [preparingReminder, setPreparingReminder] = useState(false);

  const loadPayments = useCallback(async () => {
    try {
      const pmts = await db.debtPayments
        .where("debtId")
        .equals(debt.id)
        .reverse()
        .sortBy("createdAt");

      setPayments(pmts);
    } catch (error) {
      console.error("Failed to load payments:", error);
      toast("error", "Failed to load payment history");
    } finally {
      setLoadingPayments(false);
    }
  }, [debt.id]);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  useEffect(() => {
    let cancelled = false;

    async function loadReminderSettings() {
      setPreparingReminder(true);

      try {
        const [details, templateData] = await Promise.all([
          loadPaymentDetails(),
          loadReminderTemplateData(debt),
        ]);

        if (cancelled) return;

        setPaymentDetails(details);
        setReminderTemplateData(templateData);

        const resolvedInvoiceNumber =
          templateData.sale?.receiptNo?.trim() || debt.saleId;

        setInvoiceNumber(resolvedInvoiceNumber);

        const blob = createDebtStatementImage(
          debt,
          details,
          resolvedInvoiceNumber,
          templateData,
        );

        const safeCustomerName =
          debt.customerName
            .replace(/[^a-z0-9]+/gi, "-")
            .replace(/^-|-$/g, "")
            .toLowerCase() || "customer";

        const safeInvoiceNumber =
          resolvedInvoiceNumber
            .replace(/[^a-z0-9_-]+/gi, "-")
            .replace(/^-|-$/g, "") || "invoice";

        const file = new File(
          [blob],
          `eby-gold-payment-reminder-${safeInvoiceNumber}-${safeCustomerName}.png`,
          { type: "image/png" },
        );

        if (!cancelled) {
          setReminderFile(file);
        }
      } catch (error) {
        console.error(
          "Failed to load debt reminder settings:",
          error,
        );

        if (!cancelled) {
          setPaymentDetails(DEFAULT_PAYMENT_DETAILS);
          setReminderTemplateData(null);
          setInvoiceNumber(debt.saleId);
          setReminderFile(null);
        }
      } finally {
        if (!cancelled) {
          setPreparingReminder(false);
        }
      }
    }

    void loadReminderSettings();

    return () => {
      cancelled = true;
    };
  }, [debt]);

  const st = STATUS_STYLES[debt.status];

  const canRecordPayment =
    debt.status !== "paid";

  const saveConfiguredPaymentDetails =
    async () => {
      setSavingPaymentDetails(true);

      try {
        await savePaymentDetails(paymentDetails);

        toast(
          "success",
          "Payment details saved successfully",
        );

        setShowPaymentSettings(false);
      } catch (error) {
        console.error(
          "Failed to save payment details:",
          error,
        );

        toast(
          "error",
          "Could not save payment details",
        );
      } finally {
        setSavingPaymentDetails(false);
      }
    };

  const handleRecordPayment = async () => {
    if (submitting) return;

    const amountKobo = parseNairaToKobo(paymentAmount);

    if (amountKobo === null || amountKobo <= 0) {
      toast("error", "Enter a valid positive amount with no more than two decimal places.");
      return;
    }

    if (amountKobo > debt.balanceKobo) {
      toast("error", `Payment exceeds outstanding balance of ${naira(debt.balanceKobo)}`);
      return;
    }

    setSubmitting(true);
    const now = new Date().toISOString();

    try {
      await db.transaction(
        "rw",
        db.debts,
        db.debtPayments,
        db.salePayments,
        db.sales,
        async () => {
          const fresh = await db.debts.get(debt.id);

          if (!fresh) {
            throw new Error("Debt record no longer exists.");
          }

          if (
            !Number.isSafeInteger(fresh.originalAmountKobo) ||
            !Number.isSafeInteger(fresh.amountPaidKobo) ||
            !Number.isSafeInteger(fresh.balanceKobo) ||
            fresh.originalAmountKobo <= 0 ||
            fresh.amountPaidKobo < 0 ||
            fresh.balanceKobo <= 0 ||
            addKobo(fresh.amountPaidKobo, fresh.balanceKobo) !== fresh.originalAmountKobo ||
            fresh.status === "paid"
          ) {
            throw new Error("Debt balance data is inconsistent. Reconcile this debt before recording another payment.");
          }

          if (amountKobo > fresh.balanceKobo) {
            throw new Error("Payment exceeds the current outstanding balance.");
          }

          const sale = await db.sales.get(fresh.saleId);
          if (!sale || sale.paymentMethod !== "credit" || sale.totalKobo !== fresh.originalAmountKobo) {
            throw new Error("The linked credit sale is missing or does not match this debt.");
          }

          const newAmountPaid = addKobo(fresh.amountPaidKobo, amountKobo);
          const newBalance = subKobo(fresh.balanceKobo, amountKobo);
          const newStatus: DebtStatus =
            newBalance === 0 ? "paid" : "partially_paid";

          await db.debtPayments.add({
            id: uuid(),
            debtId: fresh.id,
            amountKobo,
            paymentMethod,
            createdAt: now,
          });

          await db.salePayments.add({
            id: uuid(),
            saleId: fresh.saleId,
            method: paymentMethod,
            amountKobo,
            createdAt: now,
          });

          await db.debts.update(fresh.id, {
            amountPaidKobo: newAmountPaid,
            balanceKobo: newBalance,
            status: newStatus,
            updatedAt: now,
          });
        },
      );

      await logAuditEvent(
        "debt_payment",
        `Payment of ${naira(amountKobo)} recorded for ${debt.customerName}`,
        { debtId: debt.id, amountKobo, paymentMethod },
      );

      toast("success", `Payment of ${naira(amountKobo)} recorded`);
      setPaymentAmount("");
      setPaymentMethod("cash");
      setShowPaymentForm(false);
      onChanged();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to record payment";
      toast("error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyStatementImage = async () => {
    if (generatingImage || preparingReminder) {
      return;
    }

    if (!window.isSecureContext) {
      toast(
        "error",
        "Image copying requires a secure connection. Open the POS using HTTPS or localhost.",
      );
      return;
    }

    setGeneratingImage(true);

    try {
      const templateData =
        reminderTemplateData ??
        (await loadReminderTemplateData(debt));

      const blob = createDebtStatementImage(
        debt,
        paymentDetails,
        invoiceNumber || debt.saleId,
        templateData,
      );

      if (blob.type !== "image/png") {
        throw new Error(
          "The generated statement is not a PNG image",
        );
      }

      const copied = await copyImageToClipboard(blob);

      if (!copied) {
        toast(
          "error",
          "Could not copy the image. Your browser may not support clipboard image copying or may have denied permission.",
        );
        return;
      }

      try {
        await logAuditEvent(
          "debt_statement_copy",
          `Debt statement image copied for ${debt.customerName}`,
          {
            debtId: debt.id,
            balanceKobo: debt.balanceKobo,
            invoiceNumber: invoiceNumber || debt.saleId,
            channel: "clipboard",
          },
        );
      } catch (auditError) {
        console.warn(
          "Could not record statement copy audit:",
          auditError,
        );
      }

      toast(
        "success",
        "Debt statement image copied. You can now paste it into WhatsApp or another app.",
      );
    } catch (error) {
      console.error(
        "Failed to copy debt statement image:",
        error,
      );

      toast(
        "error",
        "Could not copy the debt statement image",
      );
    } finally {
      setGeneratingImage(false);
    }
  };
  const handleWhatsAppReminder = async () => {
    if (!debt.customerPhone) {
      toast("error", "This customer does not have a phone number");
      return;
    }

    if (debt.status === "paid") {
      toast("error", "This debt has already been fully paid");
      return;
    }

    if (!reminderFile || !reminderTemplateData || preparingReminder) {
      toast(
        "info",
        "Preparing the payment reminder. Please try again in a moment.",
      );
      return;
    }

    const phone = normalisePhone(debt.customerPhone);
    if (!phone) {
      toast("error", "Customer phone number is invalid");
      return;
    }

    const message = buildWhatsAppMessage(
      debt,
      paymentDetails,
      invoiceNumber,
    );

    /*
     * DESKTOP / WINDOWS CHROME
     *
     * Do NOT use navigator.share() first here. On Windows, Chrome can open
     * the native share surface instead of WhatsApp Web, and that surface can
     * appear blank. It also consumes the button's transient user activation.
     *
     * The reliable browser workflow is:
     *   1. Open WhatsApp Web immediately from the button click.
     *   2. Copy the exact PNG statement to the clipboard.
     *   3. Open the customer's WhatsApp chat with the reminder text filled in.
     *   4. The user presses Ctrl+V in WhatsApp to attach the copied PNG.
     *
     * A normal web page is not allowed to programmatically inject a local
     * file into WhatsApp Web's attachment picker, so Ctrl+V is the final
     * browser-security-required step. The image itself is copied, not merely
     * downloaded, so it pastes directly as an image attachment.
     */
    const isDesktop =
      typeof window !== "undefined" &&
      (window.matchMedia?.("(pointer: fine)").matches ||
        /Windows|Macintosh|Linux/i.test(navigator.userAgent));

    if (isDesktop) {
      // Open the tab synchronously while the button click still has user
      // activation. This prevents Chrome from blocking the WhatsApp tab.
      const whatsappWindow = window.open("about:blank", "_blank");

      if (!whatsappWindow) {
        toast(
          "error",
          "WhatsApp was blocked by the browser. Allow pop-ups for this POS site and try again.",
        );
        return;
      }

      whatsappWindow.document.title = "Opening WhatsApp…";

      let clipboardReady = false;

      try {
        if (
          typeof navigator.clipboard?.write === "function" &&
          typeof ClipboardItem !== "undefined" &&
          window.isSecureContext
        ) {
          const imageBlob = new Blob([reminderFile], {
            type: "image/png",
          });

          const clipboardItem = new ClipboardItem({
            "image/png": imageBlob,
          });

          await navigator.clipboard.write([clipboardItem]);
          clipboardReady = true;
        }
      } catch (clipboardError) {
        console.warn(
          "Could not copy the payment reminder image to the clipboard:",
          clipboardError,
        );
      }

      const whatsappUrl =
        `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;

      try {
        whatsappWindow.location.href = whatsappUrl;
      } catch (navigationError) {
        console.warn("Could not open WhatsApp Web:", navigationError);
        whatsappWindow.close();
      }

      if (clipboardReady) {
        try {
          await logAuditEvent(
            "debt_reminder",
            `WhatsApp payment reminder prepared with the approved statement image for ${debt.customerName}`,
            {
              debtId: debt.id,
              customerPhone: debt.customerPhone,
              balanceKobo: debt.balanceKobo,
              invoiceNumber,
              channel: "whatsapp-web-clipboard",
              attachment: "payment-reminder-png-clipboard",
            },
          );
        } catch (auditError) {
          console.warn("Could not record reminder audit:", auditError);
        }

        toast(
          "success",
          "WhatsApp opened with the reminder. Press Ctrl+V in the chat to attach the payment statement, then send.",
        );
      } else {
        // Keep the statement available if clipboard image writing is not
        // supported by the browser. This is only a fallback; no blank tab.
        await downloadBlob(reminderFile, reminderFile.name);

        try {
          await logAuditEvent(
            "debt_reminder",
            `WhatsApp payment reminder prepared; approved statement image downloaded because clipboard image sharing was unavailable for ${debt.customerName}`,
            {
              debtId: debt.id,
              customerPhone: debt.customerPhone,
              balanceKobo: debt.balanceKobo,
              invoiceNumber,
              channel: "whatsapp-web-download-fallback",
              attachment: "payment-reminder-png-download",
            },
          );
        } catch (auditError) {
          console.warn("Could not record reminder audit:", auditError);
        }

        toast(
          "success",
          "WhatsApp opened with the reminder. Your browser could not copy the image automatically, so the statement was downloaded for attachment.",
        );
      }

      return;
    }

    /*
     * MOBILE / BROWSER WITH NATIVE FILE SHARING
     *
     * On supported mobile browsers, keep the native share path because it
     * can pass both the reminder text and the PNG file to WhatsApp in one
     * share operation.
     */
    const shareData = {
      title: `${reminderTemplateData.businessName} Payment Reminder`,
      text: message,
      files: [reminderFile],
    };

    if (
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [reminderFile] })
    ) {
      try {
        await navigator.share(shareData);

        try {
          await logAuditEvent(
            "debt_reminder",
            `WhatsApp payment reminder shared with the approved statement image for ${debt.customerName}`,
            {
              debtId: debt.id,
              customerPhone: debt.customerPhone,
              balanceKobo: debt.balanceKobo,
              invoiceNumber,
              channel: "native-share",
              attachment: "payment-reminder-png",
            },
          );
        } catch (auditError) {
          console.warn("Could not record reminder audit:", auditError);
        }

        toast("success", "Payment reminder and statement are ready to send");
        return;
      } catch (shareError) {
        if (
          shareError instanceof DOMException &&
          shareError.name === "AbortError"
        ) {
          return;
        }

        console.warn("Native file sharing was unavailable:", shareError);
      }
    }

    // Last-resort fallback for a browser without native file sharing.
    const whatsappUrl =
      `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;

    const whatsappWindow = window.open(whatsappUrl, "_blank");

    if (!whatsappWindow) {
      await downloadBlob(reminderFile, reminderFile.name);
      toast(
        "error",
        "WhatsApp was blocked by the browser. The approved statement image was downloaded instead.",
      );
      return;
    }

    await downloadBlob(reminderFile, reminderFile.name);

    toast(
      "success",
      "WhatsApp opened with the reminder. The approved payment statement was downloaded for attachment.",
    );
  };

  const handleGenerateImage = async () => {
    setGeneratingImage(true);

    try {
      const blob =
        createDebtStatementImage(
          debt,
          paymentDetails,
          invoiceNumber,
          reminderTemplateData || (await loadReminderTemplateData(debt)),
        );

      const filename =
        `eby-gold-debt-${debt.customerName
          .replace(/[^a-z0-9]+/gi, "-")
          .replace(/^-|-$/g, "")
          .toLowerCase() || "customer"}.png`;

      await downloadBlob(blob, filename);

      try {
        await logAuditEvent(
          "debt_statement_image",
          `Debt statement image generated for ${debt.customerName}`,
          {
            debtId: debt.id,
            balanceKobo: debt.balanceKobo,
          },
        );
      } catch (error) {
        console.warn(
          "Could not record image audit:",
          error,
        );
      }

      toast(
        "success",
        "Debt statement image downloaded",
      );
    } catch (error) {
      console.error(
        "Failed to generate image:",
        error,
      );

      toast(
        "error",
        "Could not generate debt statement image",
      );
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleShareImage = async () => {
    setGeneratingImage(true);

    try {
      const blob = createDebtStatementImage(
        debt,
        paymentDetails,
        invoiceNumber,
        reminderTemplateData || (await loadReminderTemplateData(debt)),
      );

      const filename =
        `eby-gold-debt-${debt.customerName
          .replace(/[^a-z0-9]+/gi, "-")
          .replace(/^-|-$/g, "")
          .toLowerCase() || "customer"}.png`;

      const file = new File([blob], filename, {
        type: "image/png",
      });

      
      /*
       * IMPORTANT:
       *
       * navigator.share() on Windows/desktop Chrome opens the
       * Windows Share panel. It does not reliably provide WhatsApp
       * as a target and, as seen in Chrome on Windows, can show
       * "We couldn't show you all the ways you could share."
       *
       * Therefore the generic Share button only uses the native
       * file-share sheet on mobile devices. On desktop we download
       * the PNG instead, which is reliable and allows the user to
       * attach it manually wherever needed.
       */
  
      const userAgent = navigator.userAgent || "";
      const isMobileDevice =
        /Android|iPhone|iPad|iPod|Windows Phone/i.test(userAgent) ||
        (/Macintosh/i.test(userAgent) &&
          navigator.maxTouchPoints > 1);

      const canShareFiles =
        isMobileDevice &&
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });

      if (canShareFiles) {
        try {
          await navigator.share({
            title: "Eby-Gold Customer Debt Statement",
            text: buildStatementText(
              debt,
              paymentDetails,
              invoiceNumber,
            ),
            files: [file],
          });

          try {
            await logAuditEvent(
              "debt_statement_share",
              `Debt statement shared for ${debt.customerName}`,
              {
                debtId: debt.id,
                balanceKobo: debt.balanceKobo,
                invoiceNumber,
                channel: "native-share",
              },
            );
          } catch (error) {
            console.warn(
              "Could not record share audit:",
              error,
            );
          }

          toast("success", "Debt statement shared");
          return;
        } catch (error) {
          if (
            error instanceof DOMException &&
            error.name === "AbortError"
          ) {
            return;
          }

          console.warn(
            "Mobile file sharing was unavailable:",
            error,
          );
        }
      }

      await downloadBlob(blob, filename);

      try {
        await logAuditEvent(
          "debt_statement_download",
          `Debt statement image downloaded for ${debt.customerName}`,
          {
            debtId: debt.id,
            balanceKobo: debt.balanceKobo,
            invoiceNumber,
            channel: "download",
          },
        );
      } catch (error) {
        console.warn(
          "Could not record download audit:",
          error,
        );
      }

      toast(
        "success",
        "Debt statement image downloaded. You can attach the PNG to WhatsApp.",
      );
    } catch (error) {
      console.error(
        "Failed to share debt statement:",
        error,
      );

      toast(
        "error",
        "Could not prepare the debt statement image",
      );
    } finally {
      setGeneratingImage(false);
    }
  };

  const paymentsWithBalance = useMemo(() => {
    const sorted = [...payments].reverse();

    let running =
      debt.originalAmountKobo;

    return sorted.map((p) => {
      running = subKobo(
        running,
        p.amountKobo,
      );

      return {
        ...p,
        balanceAfter: running,
      };
    });
  }, [
    payments,
    debt.originalAmountKobo,
  ]);

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title="Debt Details"
        size="lg"
        footer={
          canRecordPayment &&
          !showPaymentForm ? (
            <div className="space-y-2">
              {/* Reminder actions */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={handleCopyStatementImage}
                disabled={generatingImage || preparingReminder}
                className="bg-white border border-emerald-200 text-emerald-700 py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Copy size={15} />
                Copy Image
              </button>
                <button
                  onClick={handleWhatsAppReminder}
                  disabled={
                    !debt.customerPhone ||
                    preparingReminder ||
                    !reminderFile
                  }
                  className="bg-emerald-600 text-white py-3 rounded-xl font-bold text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  <MessageCircle
                    size={18}
                  />
                  WhatsApp Reminder
                </button>

                <button
                  onClick={
                    handleShareImage
                  }
                  disabled={
                    generatingImage
                  }
                  className="bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:bg-slate-300"
                >
                  {generatingImage ? (
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />
                  ) : (
                    <Share2
                      size={18}
                    />
                  )}
                  Share / Download Image
                </button>
              </div>

              {/* Image download */}
              <button
                onClick={
                  handleGenerateImage
                }
                disabled={
                  generatingImage
                }
                className="w-full bg-slate-100 text-slate-700 py-3 rounded-xl font-bold text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {generatingImage ? (
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />
                ) : (
                  <Download
                    size={18}
                  />
                )}
                Download Debt Statement Image
              </button>

              {/* Payment details settings */}
              <button
                onClick={() =>
                  setShowPaymentSettings(
                    true,
                  )
                }
                className="w-full border border-slate-200 text-slate-600 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-slate-50"
              >
                <Settings
                  size={16}
                />
                Configure Payment Details
              </button>

              {/* Payment */}
              <button
                onClick={() =>
                  setShowPaymentForm(
                    true,
                  )
                }
                className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold text-base active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                Record Payment
              </button>
            </div>
          ) : showPaymentForm ? (
            <div className="space-y-2">
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1.5">Payment Method</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {([
                    ["cash", "Cash"],
                    ["transfer", "Transfer"],
                    ["card", "Card"],
                    ["qr", "QR"],
                  ] as const).map(([method, label]) => (
                    <button
                      key={method}
                      type="button"
                      disabled={submitting}
                      onClick={() => setPaymentMethod(method)}
                      className={`rounded-lg border-2 py-2 text-sm font-semibold ${
                        paymentMethod === method
                          ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                          : "border-slate-200 text-slate-600"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
                    {"\u20a6"}
                  </span>

                  <input
                    type="text"
                    inputMode="decimal"
                    value={
                      paymentAmount
                    }
                    onChange={(e) =>
                      setPaymentAmount(
                        e.target.value,
                      )
                    }
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-3 rounded-xl border border-slate-200 text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                </div>

                <button
                  onClick={
                    handleRecordPayment
                  }
                  disabled={
                    submitting
                  }
                  className="bg-emerald-600 text-white px-5 py-3 rounded-xl font-bold disabled:bg-slate-300 active:scale-[0.98] transition-transform flex items-center gap-2"
                >
                  {submitting ? (
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />
                  ) : (
                    <CheckCircle2
                      size={18}
                    />
                  )}
                  Save
                </button>
              </div>

              <button
                onClick={() => {
                  setShowPaymentForm(
                    false,
                  );
                  setPaymentAmount("");
                }}
                className="w-full text-sm text-slate-400 font-medium hover:text-slate-600"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() =>
                  setShowPaymentSettings(
                    true,
                  )
                }
                className="w-full border border-slate-200 text-slate-600 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
              >
                <Settings
                  size={16}
                />
                Configure Payment Details
              </button>

              <button
                onClick={
                  handleGenerateImage
                }
                disabled={
                  generatingImage
                }
                className="w-full bg-slate-100 text-slate-700 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {generatingImage ? (
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />
                ) : (
                  <ImageIcon
                    size={18}
                  />
                )}
                Download Statement Image
              </button>

              <button
                onClick={
                  handleShareImage
                }
                disabled={
                  generatingImage
                }
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {generatingImage ? (
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />
                ) : (
                  <Share2
                    size={18}
                  />
                )}
                Share Statement Image
              </button>
            </div>
          )
        }
      >
        <div className="space-y-4">
          {/* Customer info */}
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3 gap-2">
              <h3 className="text-base font-bold text-slate-900">
                {debt.customerName}
              </h3>

              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${st.className}`}
              >
                {st.label}
              </span>
            </div>

            {debt.customerPhone && (
              <p className="text-sm text-slate-600 flex items-center gap-1.5">
                <Phone
                  size={14}
                  className="text-slate-400"
                />
                {debt.customerPhone}
              </p>
            )}

            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <Clock size={12} />
              {formatDateTime(
                debt.createdAt,
              )}
            </p>

            {invoiceNumber && (
              <p className="text-xs text-slate-500 mt-1">
                <span className="font-semibold">Invoice:</span>{" "}
                {invoiceNumber}
              </p>
            )}
          </div>

          {/* Reminder quick actions */}
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
            <p className="text-xs font-bold text-emerald-800 mb-2">
              Customer Reminder
            </p>

            <p className="text-[11px] text-emerald-700 mb-2">
              {preparingReminder
                ? "Preparing the approved payment reminder image..."
                : reminderFile
                  ? "The approved payment reminder image will be included when your device supports file sharing."
                  : "Payment reminder image is not ready yet."}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <button
                onClick={
                  handleWhatsAppReminder
                }
                disabled={
                  !debt.customerPhone ||
                  debt.status === "paid" ||
                  preparingReminder ||
                  !reminderFile
                }
                className="bg-emerald-600 text-white py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-400"
              >
                <MessageCircle
                  size={15}
                />
                WhatsApp
              </button>

              <button
                onClick={
                  handleGenerateImage
                }
                disabled={
                  generatingImage
                }
                className="bg-white border border-emerald-200 text-emerald-700 py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <ImageIcon
                  size={15}
                />
                Image
              </button>

              <button
                onClick={
                  handleShareImage
                }
                disabled={
                  generatingImage
                }
                className="bg-white border border-emerald-200 text-emerald-700 py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Share2
                  size={15}
                />
                Share
              </button>
            </div>

            {!debt.customerPhone && (
              <p className="text-[11px] text-amber-700 mt-2">
                Add a customer phone number to
                enable WhatsApp reminders.
              </p>
            )}
          </div>

          {/* Payment information preview */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div>
                <p className="text-xs font-bold text-indigo-800">
                  Payment Information
                </p>

                <p className="text-[11px] text-indigo-600">
                  Included in reminders and statement images.
                </p>
              </div>

              <button
                onClick={() =>
                  setShowPaymentSettings(
                    true,
                  )
                }
                className="p-2 bg-white rounded-lg text-indigo-600 hover:bg-indigo-100"
                title="Configure payment details"
              >
                <Settings
                  size={16}
                />
              </button>
            </div>

            {paymentDetails.bankName ||
            paymentDetails.accountName ||
            paymentDetails.accountNumber ? (
              <div className="text-xs text-slate-700 space-y-1">
                {paymentDetails.bankName && (
                  <p>
                    <span className="font-semibold">
                      Bank:
                    </span>{" "}
                    {paymentDetails.bankName}
                  </p>
                )}

                {paymentDetails.accountName && (
                  <p>
                    <span className="font-semibold">
                      Account Name:
                    </span>{" "}
                    {paymentDetails.accountName}
                  </p>
                )}

                {paymentDetails.accountNumber && (
                  <p>
                    <span className="font-semibold">
                      Account Number:
                    </span>{" "}
                    {paymentDetails.accountNumber}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-indigo-700">
                Payment details have not been configured yet.
                Tap the settings button to add them.
              </p>
            )}
          </div>

          {/* Financial summary */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-400 font-medium">
                Original Amount
              </p>

              <p className="text-lg font-bold text-slate-900">
                {naira(
                  debt.originalAmountKobo,
                )}
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-400 font-medium">
                Total Paid
              </p>

              <p className="text-lg font-bold text-emerald-600">
                {naira(
                  debt.amountPaidKobo,
                )}
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-3 col-span-2">
              <p className="text-xs text-slate-400 font-medium">
                Current Balance
              </p>

              <p className="text-2xl font-bold text-rose-600">
                {naira(
                  debt.balanceKobo,
                )}
              </p>
            </div>
          </div>

          {/* Payment history */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Receipt
                size={16}
                className="text-slate-400"
              />

              <p className="text-sm font-semibold text-slate-700">
                Payment History
              </p>

              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {payments.length}
              </span>
            </div>

            {loadingPayments ? (
              <div className="flex items-center justify-center py-6">
                <Loader2
                  className="text-slate-300 animate-spin"
                  size={24}
                />
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center py-6 text-slate-400">
                <AlertCircle
                  size={24}
                  className="mx-auto mb-1.5"
                />

                <p className="text-sm">
                  No payments recorded yet
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {paymentsWithBalance.map(
                  (p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 animate-pop"
                    >
                      <div className="bg-emerald-50 p-2 rounded-lg shrink-0">
                        <CheckCircle2
                          size={16}
                          className="text-emerald-600"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900">
                          {naira(
                            p.amountKobo,
                          )}
                        </p>

                        <p className="text-xs text-slate-500">
                          {p.paymentMethod
                            ? p.paymentMethod.toUpperCase()
                            : "Payment method not recorded"}
                        </p>

                        <p className="text-xs text-slate-400">
                          {formatDateTime(
                            p.createdAt,
                          )}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-slate-400">
                          Balance after
                        </p>

                        <p className="text-sm font-semibold text-slate-700">
                          {naira(
                            p.balanceAfter,
                          )}
                        </p>
                      </div>
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>
        </div>
      </Modal>

      {/* Payment details configuration modal */}
      {showPaymentSettings && (
        <Modal
          open
          onClose={() =>
            setShowPaymentSettings(
              false,
            )
          }
          title="Payment Details"
          size="md"
          footer={
            <div className="flex gap-2">
              <button
                onClick={() =>
                  setShowPaymentSettings(
                    false,
                  )
                }
                className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <X size={17} />
                Cancel
              </button>

              <button
                onClick={
                  saveConfiguredPaymentDetails
                }
                disabled={
                  savingPaymentDetails
                }
                className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:bg-slate-300"
              >
                {savingPaymentDetails ? (
                  <Loader2
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <Save size={17} />
                )}
                Save Details
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
              <p className="text-sm font-bold text-indigo-900">
                Configure your business payment account
              </p>

              <p className="text-xs text-indigo-700 mt-1">
                These details will automatically appear
                on debt reminder messages and generated
                statement images.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Bank Name
              </label>

              <input
                type="text"
                value={
                  paymentDetails.bankName
                }
                onChange={(e) =>
                  setPaymentDetails(
                    (current) => ({
                      ...current,
                      bankName:
                        e.target.value,
                    }),
                  )
                }
                placeholder="e.g. Access Bank"
                className="w-full px-3 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Account Name
              </label>

              <input
                type="text"
                value={
                  paymentDetails.accountName
                }
                onChange={(e) =>
                  setPaymentDetails(
                    (current) => ({
                      ...current,
                      accountName:
                        e.target.value,
                    }),
                  )
                }
                placeholder="e.g. Eby-Gold Superstores"
                className="w-full px-3 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Account Number
              </label>

              <input
                type="text"
                inputMode="numeric"
                value={
                  paymentDetails.accountNumber
                }
                onChange={(e) =>
                  setPaymentDetails(
                    (current) => ({
                      ...current,
                      accountNumber:
                        e.target.value,
                    }),
                  )
                }
                placeholder="e.g. 0123456789"
                className="w-full px-3 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Transfer Instructions
              </label>

              <textarea
                value={
                  paymentDetails.transferInstructions
                }
                onChange={(e) =>
                  setPaymentDetails(
                    (current) => ({
                      ...current,
                      transferInstructions:
                        e.target.value,
                    }),
                  )
                }
                rows={4}
                placeholder="e.g. Please use the invoice number as the transfer reference where applicable."
                className="w-full px-3 py-3 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <p className="text-xs text-amber-800">
                <strong>Important:</strong> These are
                business payment details only. Never enter
                passwords, API keys, PINs or banking login
                credentials here.
              </p>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export default DebtTrackerPage;
