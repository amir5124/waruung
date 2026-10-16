// lib/cart.ts
import { create } from 'zustand';

export type CartItem = {
    id: number;                  // ← number, match dengan menu_item_id
    name: string;
    price: number;
    image_url: string | null;
    merchantId: string;
    merchantName: string;
    qty: number;
    note?: string;
};

type CartState = {
    items: CartItem[];
    merchantId: string | null;
    add: (it: Omit<CartItem, 'qty'>) => void;
    inc: (id: number) => void;
    dec: (id: number) => void;
    remove: (id: number) => void;
    setNote: (id: number, note: string) => void;
    clear: () => void;
    totalQty: () => number;
    totalPrice: () => number;
};

export const useCart = create<CartState>((set, get) => ({
    items: [],
    merchantId: null,

    add: (it) =>
        set((st) => {
            // Beda resto → reset keranjang
            if (st.merchantId && st.merchantId !== it.merchantId) {
                return {
                    merchantId: it.merchantId,
                    items: [{ ...it, qty: 1 }],
                };
            }
            const idx = st.items.findIndex((x) => x.id === it.id);
            if (idx >= 0) {
                const copy = [...st.items];
                copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
                return { ...st, items: copy };
            }
            return {
                merchantId: it.merchantId,
                items: [...st.items, { ...it, qty: 1 }],
            };
        }),

    inc: (id) =>
        set((st) => ({
            items: st.items.map((x) =>
                x.id === id ? { ...x, qty: x.qty + 1 } : x
            ),
        })),

    dec: (id) =>
        set((st) => ({
            items: st.items
                .map((x) => (x.id === id ? { ...x, qty: x.qty - 1 } : x))
                .filter((x) => x.qty > 0),
        })),

    remove: (id) =>
        set((st) => ({ items: st.items.filter((x) => x.id !== id) })),

    setNote: (id, note) =>
        set((st) => ({
            items: st.items.map((x) => (x.id === id ? { ...x, note } : x)),
        })),

    clear: () => set({ items: [], merchantId: null }),

    totalQty: () => get().items.reduce((a, b) => a + b.qty, 0),
    totalPrice: () => get().items.reduce((a, b) => a + b.price * b.qty, 0),
}));