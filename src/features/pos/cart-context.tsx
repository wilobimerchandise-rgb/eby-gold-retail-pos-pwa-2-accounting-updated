import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { CartItem, Product } from "@/types";
import { toast } from "@/components/Toast";

interface CartContextValue {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  addToCart: (p: Product, qty?: number) => void;
  clearCart: () => void;
  prefillCustomer: { name: string; phone: string } | null;
  setPrefillCustomer: (c: { name: string; phone: string } | null) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [prefillCustomer, setPrefillCustomer] = useState<{ name: string; phone: string } | null>(null);

  const addToCart = useCallback((p: Product, qty = 1) => {
    if (p.stockQuantity <= 0) {
      toast("error", `${p.name} is out of stock`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === p.id);
      if (existing) {
        const newQty = existing.qty + qty;
        if (newQty > p.stockQuantity) {
          toast("error", `Only ${p.stockQuantity} of ${p.name} in stock`);
          return prev;
        }
        return prev.map((i) => (i.productId === p.id ? { ...i, qty: newQty } : i));
      }
      const clampedQty = Math.min(qty, p.stockQuantity);
      return [
        ...prev,
        { productId: p.id, name: p.name, priceKobo: p.priceKobo, qty: clampedQty, stockQuantity: p.stockQuantity },
      ];
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setPrefillCustomer(null);
  }, []);

  return (
    <CartContext.Provider value={{ cart, setCart, addToCart, clearCart, prefillCustomer, setPrefillCustomer }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
