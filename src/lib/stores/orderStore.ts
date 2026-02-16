import { create } from "zustand";
import type { DeriveOrder } from "../derive/types";

interface OrderState {
  openOrders: DeriveOrder[];
  orderHistory: DeriveOrder[];
  isLoadingOpen: boolean;
  isLoadingHistory: boolean;

  // Actions
  setOpenOrders: (orders: DeriveOrder[]) => void;
  addOpenOrder: (order: DeriveOrder) => void;
  updateOpenOrder: (orderId: string, updates: Partial<DeriveOrder>) => void;
  removeOpenOrder: (orderId: string) => void;
  setOrderHistory: (orders: DeriveOrder[]) => void;
  addToHistory: (order: DeriveOrder) => void;
  setLoadingOpen: (loading: boolean) => void;
  setLoadingHistory: (loading: boolean) => void;
  reset: () => void;
}

export const useOrderStore = create<OrderState>()((set, get) => ({
  openOrders: [],
  orderHistory: [],
  isLoadingOpen: false,
  isLoadingHistory: false,

  setOpenOrders: (openOrders) => set({ openOrders }),

  addOpenOrder: (order) => {
    set({ openOrders: [order, ...get().openOrders] });
  },

  updateOpenOrder: (orderId, updates) => {
    const openOrders = get().openOrders.map((o) =>
      o.order_id === orderId ? { ...o, ...updates } : o
    );
    set({ openOrders });
  },

  removeOpenOrder: (orderId) => {
    set({
      openOrders: get().openOrders.filter((o) => o.order_id !== orderId),
    });
  },

  setOrderHistory: (orderHistory) => set({ orderHistory }),

  addToHistory: (order) => {
    set({ orderHistory: [order, ...get().orderHistory] });
  },

  setLoadingOpen: (isLoadingOpen) => set({ isLoadingOpen }),
  setLoadingHistory: (isLoadingHistory) => set({ isLoadingHistory }),

  reset: () =>
    set({
      openOrders: [],
      orderHistory: [],
      isLoadingOpen: false,
      isLoadingHistory: false,
    }),
}));

// ─── Selectors ───

export const selectOpenOrdersByInstrument =
  (instrument: string) => (state: OrderState) =>
    state.openOrders.filter((o) => o.instrument_name === instrument);

export const selectOpenOrderCount = (state: OrderState) =>
  state.openOrders.length;
