import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MenuItem, CartItem } from "@shared/schema";

interface CartState {
  items: CartItem[];
  restaurantId: string | null;
  restaurantName: string | null;
  addItem: (menuItem: MenuItem, restaurantId: string, restaurantName: string) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getSubtotal: () => number;
  getItemCount: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      restaurantId: null,
      restaurantName: null,

      addItem: (menuItem: MenuItem, restaurantId: string, restaurantName: string) => {
        const { items, restaurantId: currentRestaurantId } = get();
        
        if (currentRestaurantId && currentRestaurantId !== restaurantId) {
          set({
            items: [{ menuItem, quantity: 1 }],
            restaurantId,
            restaurantName,
          });
          return;
        }

        const existingItem = items.find((item) => item.menuItem.id === menuItem.id);
        
        if (existingItem) {
          set({
            items: items.map((item) =>
              item.menuItem.id === menuItem.id
                ? { ...item, quantity: item.quantity + 1 }
                : item
            ),
          });
        } else {
          set({
            items: [...items, { menuItem, quantity: 1 }],
            restaurantId,
            restaurantName,
          });
        }
      },

      removeItem: (menuItemId: string) => {
        const { items } = get();
        const newItems = items.filter((item) => item.menuItem.id !== menuItemId);
        
        if (newItems.length === 0) {
          set({ items: [], restaurantId: null, restaurantName: null });
        } else {
          set({ items: newItems });
        }
      },

      updateQuantity: (menuItemId: string, quantity: number) => {
        const { items } = get();
        
        if (quantity <= 0) {
          get().removeItem(menuItemId);
          return;
        }

        set({
          items: items.map((item) =>
            item.menuItem.id === menuItemId ? { ...item, quantity } : item
          ),
        });
      },

      clearCart: () => {
        set({ items: [], restaurantId: null, restaurantName: null });
      },

      getTotal: () => {
        const { items } = get();
        return items.reduce(
          (total, item) => total + parseFloat(item.menuItem.price) * item.quantity,
          0
        );
      },

      getSubtotal: () => {
        return get().getTotal();
      },

      getItemCount: () => {
        const { items } = get();
        return items.reduce((count, item) => count + item.quantity, 0);
      },
    }),
    {
      name: "cart-storage",
    }
  )
);
