import { useEffect, useState } from "react";
import { Clock, ChevronRight, Receipt as ReceiptIcon } from "lucide-react";
import { db } from "@/db/database";
import type { Sale, SaleItem } from "@/types";
import { naira } from "@/lib/money";
import { Modal } from "@/components/Modal";

export function SalesHistory({ onClose }: { onClose: () => void }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<{ sale: Sale; items: SaleItem[] } | null>(null);

  useEffect(() => {
    (async () => {
      const all = await db.sales.orderBy("createdAt").reverse().limit(50).toArray();
      setSales(all);
      setLoading(false);
    })();
  }, []);

  const openDetail = async (sale: Sale) => {
    const items = await db.saleItems.where("saleId").equals(sale.id).toArray();
    setDetail({ sale, items });
  };

  const methodLabel = (m: string) =>
    m === "cash" ? "Cash" : m === "transfer" ? "Transfer" : "Credit";

  return (
    <Modal open onClose={onClose} title="Sales History" size="lg">
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Clock className="text-slate-300 animate-pulse" size={32} />
        </div>
      ) : sales.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
          <ReceiptIcon size={36} className="mb-2" />
          <p className="font-medium">No sales yet</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {sales.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => openDetail(s)}
                className="w-full flex items-center gap-3 py-3 px-1 hover:bg-slate-50 rounded-lg text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    #{s.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(s.createdAt).toLocaleString("en-NG", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    s.paymentMethod === "credit"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-indigo-100 text-indigo-700"
                  }`}
                >
                  {methodLabel(s.paymentMethod)}
                </span>
                <span className="text-sm font-bold text-slate-900">{naira(s.totalKobo)}</span>
                <ChevronRight size={18} className="text-slate-300" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {detail && (
        <Modal open onClose={() => setDetail(null)} title={`Sale #${detail.sale.id.slice(0, 8).toUpperCase()}`}>
          <div className="space-y-3">
            <div className="text-xs text-slate-500 space-y-0.5">
              <p>{new Date(detail.sale.createdAt).toLocaleString("en-NG")}</p>
              <p>Payment: {methodLabel(detail.sale.paymentMethod)}</p>
              {detail.sale.customerName && <p>Customer: {detail.sale.customerName}</p>}
            </div>
            <div className="border-t border-slate-200 pt-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs">
                    <th className="text-left pb-1 font-semibold">Item</th>
                    <th className="text-center pb-1 font-semibold">Qty</th>
                    <th className="text-right pb-1 font-semibold">Price</th>
                    <th className="text-right pb-1 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((i) => (
                    <tr key={i.id} className="border-t border-slate-100">
                      <td className="py-1.5 text-slate-900">{i.productNameSnapshot}</td>
                      <td className="py-1.5 text-center text-slate-600">{i.quantity}</td>
                      <td className="py-1.5 text-right text-slate-600">{naira(i.unitPriceKobo)}</td>
                      <td className="py-1.5 text-right text-slate-900 font-medium">{naira(i.lineTotalKobo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-200">
              <span>Total</span>
              <span>{naira(detail.sale.totalKobo)}</span>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
