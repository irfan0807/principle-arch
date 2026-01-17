import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { MenuItem, CartItem } from '@shared/schema';

interface CartState {
  items: CartItem[];
  restaurantId: string | null;
  restaurantName: string | null;
}

const initialState: CartState = {
  items: [],
  restaurantId: null,
  restaurantName: null,
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addItem: (state, action: PayloadAction<{ menuItem: MenuItem; restaurantId: string; restaurantName: string }>) => {
      const { menuItem, restaurantId, restaurantName } = action.payload;

      if (state.restaurantId && state.restaurantId !== restaurantId) {
        state.items = [{ menuItem, quantity: 1 }];
        state.restaurantId = restaurantId;
        state.restaurantName = restaurantName;
        return;
      }

      const existingItem = state.items.find((item) => item.menuItem.id === menuItem.id);

      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        state.items.push({ menuItem, quantity: 1 });
        state.restaurantId = restaurantId;
        state.restaurantName = restaurantName;
      }
    },
    removeItem: (state, action: PayloadAction<string>) => {
      const menuItemId = action.payload;
      state.items = state.items.filter((item) => item.menuItem.id !== menuItemId);

      if (state.items.length === 0) {
        state.restaurantId = null;
        state.restaurantName = null;
      }
    },
    updateQuantity: (state, action: PayloadAction<{ menuItemId: string; quantity: number }>) => {
      const { menuItemId, quantity } = action.payload;

      if (quantity <= 0) {
        cartSlice.caseReducers.removeItem(state, { payload: menuItemId, type: 'cart/removeItem' });
        return;
      }

      const item = state.items.find((item) => item.menuItem.id === menuItemId);
      if (item) {
        item.quantity = quantity;
      }
    },
    clearCart: (state) => {
      state.items = [];
      state.restaurantId = null;
      state.restaurantName = null;
    },
  },
});

export const { addItem, removeItem, updateQuantity, clearCart } = cartSlice.actions;

export const selectCartItems = (state: { cart: CartState }) => state.cart.items;
export const selectRestaurantId = (state: { cart: CartState }) => state.cart.restaurantId;
export const selectRestaurantName = (state: { cart: CartState }) => state.cart.restaurantName;
export const selectCartTotal = (state: { cart: CartState }) =>
  state.cart.items.reduce((total, item) => total + parseFloat(item.menuItem.price) * item.quantity, 0);
export const selectCartItemCount = (state: { cart: CartState }) =>
  state.cart.items.reduce((count, item) => count + item.quantity, 0);

export default cartSlice.reducer;