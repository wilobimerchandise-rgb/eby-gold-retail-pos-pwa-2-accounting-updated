import { useEffect, useState, useCallback } from "react";
import {
  MessageCircle, WifiOff, Send, Loader2, AlertCircle, CheckCircle2,
  ShoppingCart, User, Phone, Package, X, ArrowRight,
} from "lucide-react";
import { db } from "@/db/database";
import type { Product } from "@/types";
import { naira, mulKobo, addKobo } from "@/lib/money";
import { useCart } from "@/features/pos/cart-context";
import { toast } from "@/components/Toast";
import { parseOrder } from "./api";
import { matchProducts, type ParseResult } from "./schema";

interface WhatsAppPageProps {
  online: boolean;
  onGoToPos: () => void;
}

const SAMPLE = "Good afternoon, pls send 3 peak, 2 milo and one carton indomie. Name is Chinedu, phone 08012345678";

export function WhatsAppPage({ online, onGoToPos }: WhatsAppPageProps) {
  const { setCart, setPrefillCustomer, addToCart } = useCart();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  const refreshProducts = useCallback(async () => {
    const all = await db.products.toArray();
    setProducts(all.filter((p) => p.active));
  }, []);

  useEffect(() => {
    refreshProducts();
  }, [refreshProducts]);

  const handleParse = async () => {
    if (!message.trim()) {
      toast("error", "Please paste a WhatsApp order first");
      return;
    }
    if (!online) {
      toast("error", "Internet connection required for AI parsing");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const inventory = products.map((p) => ({ name: p.name, sku: p.sku }));
      const ai = await parseOrder(message, inventory);
      const matched = matchProducts(ai.items, products);

      setResult({
        customer: ai.customer,
        matched: matched.matched,
        unmatched: matched.unmatched,
        stockWarnings: matched.stockWarnings,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to parse order";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (!result) return;

    const validItems = result.matched.filter((m) => {
      if (!m.product.active) return false;
      if (m.quantity <= 0) return false;
      if (m.quantity > m.product.stockQuantity) return false;
      return true;
    });

    if (validItems.length === 0) {
      toast("error", "No valid items to add");
      return;
    }

    setCart([]);
    for (const item of validItems) {
      addToCart(item.product, item.quantity);
    }

    if (result.customer.name || result.customer.phone) {
      setPrefillCustomer({
        name: result.customer.name ?? "",
        phone: result.customer.phone ?? "",
      });
    }

    toast("success", `${validItems.length} item${validItems.length > 1 ? "s" : ""} added to cart`);
    setResult(null);
    setMessage("");
    onGoToPos();
  };

  const totalKobo = result
    ? result.matched.reduce((s, m) => addKobo(s, mulKobo(m.product.priceKobo, m.quantity)), 0)
    : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-emerald-600 text-white rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="bg-white/15 p-2.5 rounded-xl">
            <MessageCircle size={28} />
          </div>
          <div>
            <h2 className="font-bold text-lg">WhatsApp AI Order Parser</h2>
            <p className="text-sm text-emerald-100">Paste a customer's WhatsApp message and let AI extract the order</p>
          </div>
        </div>
      </div>

      {/* Offline warning */}
      {!online && (
        <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 px-4 py-3 rounded-xl text-sm font-medium">
          <WifiOff size={18} />
          Internet connection required for AI parsing. Offline POS still works.
        </div>
      )}

      {/* Input */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-slate-700">Paste WhatsApp Order</label>
          {message === "" && (
            <button
              onClick={() => setMessage(SAMPLE)}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
            >
              Try sample
            </button>
          )}
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Good afternoon, pls send 3 peak, 2 milo and one carton indomie. Name is Chinedu, phone 080..."
          rows={5}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
        />
        <button
          onClick={handleParse}
          disabled={loading || !online || !message.trim()}
          className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-bold text-base disabled:bg-slate-300 disabled:cursor-not-allowed active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Parsing order...
            </>
          ) : (
            <>
              <Send size={18} />
              Parse Order
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 animate-pop">
          <AlertCircle size={20} className="text-rose-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-rose-800">Parsing failed</p>
            <p className="text-sm text-rose-600 mt-0.5">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 ml-auto">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4 animate-pop">
          {/* Customer */}
          {(result.customer.name || result.customer.phone) && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-slate-500 mb-2">Customer</p>
              <div className="flex flex-wrap gap-4">
                {result.customer.name && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-700">
                    <User size={15} className="text-slate-400" />
                    {result.customer.name}
                  </div>
                )}
                {result.customer.phone && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-700">
                    <Phone size={15} className="text-slate-400" />
                    {result.customer.phone}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Matched items */}
          {result.matched.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <p className="text-sm font-semibold text-slate-700">Matched Items</p>
              </div>
              <ul className="space-y-2">
                {result.matched.map((m, idx) => {
                  const overStock = m.quantity > m.product.stockQuantity;
                  return (
                    <li
                      key={idx}
                      className={`flex items-center gap-3 rounded-xl p-2.5 border ${
                        overStock ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{m.product.name}</p>
                        <p className="text-xs text-slate-500">
                          {naira(m.product.priceKobo)} each
                          {m.aiName.toLowerCase() !== m.product.name.toLowerCase() && (
                            <span className="text-slate-400"> (from "{m.aiName}")</span>
                          )}
                        </p>
                        {overStock && (
                          <p className="text-xs text-amber-600 font-medium mt-0.5">
                            Only {m.product.stockQuantity} in stock
                          </p>
                        )}
                      </div>
                      <span className="text-xs font-bold text-slate-600 bg-white px-2 py-1 rounded-lg border border-slate-200">
                        {m.quantity}
                      </span>
                      <span className="text-sm font-bold text-slate-900 w-20 text-right">
                        {naira(mulKobo(m.product.priceKobo, m.quantity))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Unmatched items */}
          {result.unmatched.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={16} className="text-amber-600" />
                <p className="text-sm font-semibold text-slate-700">Unmatched Items</p>
              </div>
              <ul className="space-y-1.5">
                {result.unmatched.map((u, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm text-slate-600 bg-amber-50 rounded-lg px-3 py-2">
                    <Package size={14} className="text-amber-500" />
                    <span>"{u.aiName}"</span>
                    <span className="text-xs text-slate-400">x {u.quantity}</span>
                    <span className="text-xs text-amber-600 ml-auto">No matching product found</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Stock warnings */}
          {result.stockWarnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1.5">Stock Warnings</p>
              <ul className="space-y-1">
                {result.stockWarnings.map((w, idx) => (
                  <li key={idx} className="text-xs text-amber-600 flex items-start gap-1.5">
                    <AlertCircle size={13} className="mt-0.5 shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Total + action */}
          {result.matched.length > 0 && (
            <div className="border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-500 font-medium">Order Total</span>
                <span className="text-2xl font-bold text-slate-900">{naira(totalKobo)}</span>
              </div>
              <button
                onClick={handleAddToCart}
                className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold text-base active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              >
                <ShoppingCart size={20} />
                Add Valid Items to Cart
                <ArrowRight size={18} />
              </button>
              <p className="text-xs text-slate-400 text-center mt-2">
                Items exceeding stock will be skipped. You can adjust quantities in the cart.
              </p>
            </div>
          )}

          {result.matched.length === 0 && result.unmatched.length > 0 && (
            <div className="text-center py-4">
              <p className="text-sm text-slate-500">
                No items could be matched to your inventory. Try rephrasing the order or add the missing products.
              </p>
            </div>
          )}

          <button
            onClick={() => setResult(null)}
            className="w-full text-sm text-slate-400 font-medium hover:text-slate-600"
          >
            Dismiss and start over
          </button>
        </div>
      )}
    </div>
  );
}
