import { useEffect, useState } from "react";
import { ClipboardCheck, CheckCircle2, AlertTriangle } from "lucide-react";
import { db, logAuditEvent } from "@/db/database";
import type { Product, StockAudit } from "@/types";
import { v4 as uuid } from "uuid";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/Toast";

interface StaffAuditProps {
  onClose: () => void;
  onDone: () => void;
}

export function StaffAuditModal({ onClose, onDone }: StaffAuditProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [staffName, setStaffName] = useState("");
  const [results, setResults] = useState<StockAudit[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const all = await db.products.toArray();
      setProducts(all.filter((p) => p.active));
    })();
  }, []);

  const handleSubmit = async () => {
    if (!staffName.trim()) {
      toast("error", "Please enter your name");
      return;
    }
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const records: StockAudit[] = [];

      for (const p of products) {
        const raw = counts[p.id];
        if (raw === undefined || raw === "") continue;
        const physical = parseInt(raw);
        if (isNaN(physical)) continue;

        const expected = p.stockQuantity;
        const discrepancy = physical - expected;

        const audit: StockAudit = {
          id: uuid(),
          productId: p.id,
          productNameSnapshot: p.name,
          expectedQuantity: expected,
          physicalQuantity: physical,
          discrepancy,
          staffName: staffName.trim(),
          createdAt: now,
        };
        records.push(audit);
      }

      if (records.length === 0) {
        toast("error", "Enter at least one physical count");
        setSubmitting(false);
        return;
      }

      await db.stockAudits.bulkAdd(records);
      await logAuditEvent("audit", `Stock audit by ${staffName.trim()}`, {
        count: records.length,
      });

      setResults(records);
      onDone();
      toast("success", `Audit saved: ${records.length} products counted`);
    } catch (err) {
      toast("error", "Audit submission failed");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Staff Stock Audit"
      size="lg"
      footer={
        results ? (
          <button
            onClick={onClose}
            className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold"
          >
            Done
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold disabled:bg-slate-300 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            <ClipboardCheck size={20} />
            {submitting ? "Submitting..." : "Submit Audit"}
          </button>
        )
      }
    >
      {results ? (
        <div className="space-y-2">
          <p className="text-sm text-slate-600 mb-3">
            Audit results for <span className="font-semibold">{staffName}</span>:
          </p>
          {results.map((r) => (
            <div
              key={r.id}
              className={`flex items-center justify-between p-3 rounded-xl border ${
                r.discrepancy === 0
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-amber-50 border-amber-200"
              }`}
            >
              <div className="flex items-center gap-2">
                {r.discrepancy === 0 ? (
                  <CheckCircle2 size={18} className="text-emerald-600" />
                ) : (
                  <AlertTriangle size={18} className="text-amber-600" />
                )}
                <div>
                  <p className="text-sm font-semibold text-slate-900">{r.productNameSnapshot}</p>
                  <p className="text-xs text-slate-500">
                    Expected: {r.expectedQuantity} | Counted: {r.physicalQuantity}
                  </p>
                </div>
              </div>
              <span
                className={`text-sm font-bold ${
                  r.discrepancy === 0
                    ? "text-emerald-600"
                    : r.discrepancy > 0
                    ? "text-emerald-600"
                    : "text-rose-600"
                }`}
              >
                {r.discrepancy === 0
                  ? "Match"
                  : `${r.discrepancy > 0 ? "+" : ""}${r.discrepancy}`}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1.5">Your name</p>
            <input
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="Staff name"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <p className="text-xs text-slate-500">
            Enter the physical count for each product. Expected quantities are hidden during counting and revealed after submission.
          </p>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {products.map((p) => (
              <div key={p.id} className="flex items-center gap-3 bg-slate-50 rounded-xl p-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{p.name}</p>
                  <p className="text-[11px] text-slate-400">{p.sku}</p>
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  value={counts[p.id] || ""}
                  onChange={(e) => setCounts((c) => ({ ...c, [p.id]: e.target.value }))}
                  placeholder="Count"
                  className="w-20 px-2 py-2 rounded-lg border border-slate-200 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
