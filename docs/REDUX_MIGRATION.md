# Redux State Management Migration

## Overview

This document outlines the migration of the FoodDash application's frontend from Zustand (for cart state) and React Context (for authentication) to Redux Toolkit for unified state management.

## Date of Migration

January 17, 2026

## Previous State Management

### Cart State
- **Library**: Zustand with persist middleware
- **Location**: `client/src/lib/cart.ts`
- **Features**: Persistent cart storage, restaurant validation, quantity management

### Authentication State
- **Library**: React Context
- **Location**: `client/src/components/AuthProvider.tsx`
- **Features**: User session management, protected routes, sign-out functionality

## New Redux Architecture

### Store Structure
```
store/
├── store.ts          # Main store configuration with persistence
├── hooks.ts          # Typed hooks for dispatch and selectors
└── slices/
    ├── cartSlice.ts  # Cart state management
    └── authSlice.ts  # Authentication state management
```

### Key Features
- **Redux Toolkit**: Simplified Redux with createSlice and createAsyncThunk
- **Redux Persist**: Automatic state persistence to localStorage
- **TypeScript**: Full type safety with RootState and AppDispatch
- **Async Operations**: Thunks for API calls (user fetching, sign-out)

## Migration Details

### 1. Dependencies Added
```json
{
  "@reduxjs/toolkit": "^2.x.x",
  "react-redux": "^9.x.x",
  "redux-persist": "^6.x.x"
}
```

### 2. Store Configuration
- **Persist Config**: Cart state persisted with key "cart"
- **Middleware**: Serializable check ignored for persist actions
- **Reducers**: Combined cart and auth reducers

### 3. Cart Slice
- **State**: Items array, restaurantId, restaurantName
- **Actions**: addItem, removeItem, updateQuantity, clearCart
- **Selectors**: selectCartItems, selectCartTotal, selectCartItemCount, etc.
- **Persistence**: Automatic via redux-persist

### 4. Auth Slice
- **State**: User object, loading state, authentication status
- **Async Thunks**: fetchUser, signOutUser
- **Selectors**: selectUser, selectIsAuthenticated, selectIsLoading

### 5. Component Updates

#### Migrated Components
- **Checkout.tsx**: Cart operations now use Redux dispatch and selectors
- **Restaurant.tsx**: Add to cart functionality migrated to Redux
- **Home.tsx**: User data and sign-out via Redux
- **Landing.tsx**: Authentication state from Redux
- **RestaurantDashboard.tsx**: User management via Redux
- **DeliveryDashboard.tsx**: User management via Redux

#### New Components
- **AuthInitializer.tsx**: Dispatches user fetch on app start
- **ProtectedRoute.tsx**: Redux-based route protection

### 6. App Structure Changes
- **main.tsx**: Added Provider and PersistGate wrappers
- **App.tsx**: Removed old providers, added AuthInitializer

## Usage Guide

### Using Cart State
```tsx
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { addItem, removeItem, updateQuantity, clearCart } from '@/store/slices/cartSlice';
import { selectCartItems, selectCartTotal, selectCartItemCount } from '@/store/slices/cartSlice';

function MyComponent() {
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectCartItems);
  const total = useAppSelector(selectCartTotal);

  const handleAddItem = (menuItem, restaurantId, restaurantName) => {
    dispatch(addItem({ menuItem, restaurantId, restaurantName }));
  };

  return (
    // Component JSX
  );
}
```

### Using Auth State
```tsx
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { selectUser, selectIsAuthenticated, signOutUser } from '@/store/slices/authSlice';

function MyComponent() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  const handleSignOut = () => {
    dispatch(signOutUser());
  };

  return (
    // Component JSX
  );
}
```

### Creating New Slices
```tsx
// store/slices/exampleSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ExampleState {
  value: string;
}

const initialState: ExampleState = {
  value: '',
};

const exampleSlice = createSlice({
  name: 'example',
  initialState,
  reducers: {
    setValue: (state, action: PayloadAction<string>) => {
      state.value = action.payload;
    },
  },
});

export const { setValue } = exampleSlice.actions;
export const selectValue = (state: { example: ExampleState }) => state.example.value;
export default exampleSlice.reducer;
```

Then add to store.ts:
```tsx
import exampleReducer from './slices/exampleSlice';

export const store = configureStore({
  reducer: {
    cart: persistedCartReducer,
    auth: authReducer,
    example: exampleReducer, // Add new reducer
  },
});
```

## Benefits of Migration

1. **Unified State Management**: Single source of truth for all state
2. **Better Developer Experience**: Redux DevTools support, predictable state updates
3. **Type Safety**: Full TypeScript integration
4. **Persistence**: Built-in state persistence without custom middleware
5. **Scalability**: Easier to add new features and debug complex state interactions
6. **Performance**: Optimized re-renders with selector memoization

## Testing Considerations

- **Unit Tests**: Update tests to use Redux store instead of Zustand/context mocks
- **Integration Tests**: Ensure cart persistence works across sessions
- **E2E Tests**: Verify authentication flows with Redux state

## Rollback Plan

If issues arise, the previous Zustand and Context implementations are preserved in git history. To rollback:

1. Revert commits related to Redux migration
2. Restore `client/src/lib/cart.ts`
3. Restore `client/src/components/AuthProvider.tsx`
4. Update component imports back to Zustand/Context hooks

## Future Enhancements

- **Redux DevTools**: Enable in development for debugging
- **State Normalization**: Consider normalizing complex state structures
- **Middleware**: Add logging or analytics middleware if needed
- **Code Splitting**: Lazy load slices for better performance

## Files Changed

### New Files
- `client/src/store/store.ts`
- `client/src/store/hooks.ts`
- `client/src/store/slices/cartSlice.ts`
- `client/src/store/slices/authSlice.ts`
- `client/src/components/AuthInitializer.tsx`
- `client/src/components/ProtectedRoute.tsx`
- `docs/REDUX_MIGRATION.md`

### Modified Files
- `package.json` (added dependencies)
- `client/src/main.tsx` (added Redux providers)
- `client/src/App.tsx` (removed old providers, added initializer)
- `client/src/pages/Checkout.tsx` (migrated to Redux)
- `client/src/pages/Restaurant.tsx` (migrated to Redux)
- `client/src/pages/Home.tsx` (migrated to Redux)
- `client/src/pages/Landing.tsx` (migrated to Redux)
- `client/src/pages/RestaurantDashboard.tsx` (migrated to Redux)
- `client/src/pages/DeliveryDashboard.tsx` (migrated to Redux)

### Removed Files
- `client/src/lib/cart.ts` (Zustand store)
- `client/src/components/AuthProvider.tsx` (React Context provider)