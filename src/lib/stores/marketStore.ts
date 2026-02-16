import { create } from "zustand";
import type {
  DeriveInstrument,
  DeriveTicker,
  DeriveOrderBook,
  DeriveTrade,
  DeriveCandle,
} from "../derive/types";

interface MarketState {
  // Instruments
  instruments: Map<string, DeriveInstrument>;
  instrumentsList: DeriveInstrument[];
  isLoadingInstruments: boolean;

  // Tickers (keyed by instrument_name)
  tickers: Map<string, DeriveTicker>;

  // Order books (keyed by instrument_name)
  orderBooks: Map<string, DeriveOrderBook>;

  // Recent trades (keyed by instrument_name)
  recentTrades: Map<string, DeriveTrade[]>;

  // Candles (keyed by `${instrument_name}-${timeframe}`)
  candles: Map<string, DeriveCandle[]>;

  // Actions
  setInstruments: (instruments: DeriveInstrument[]) => void;
  setLoadingInstruments: (loading: boolean) => void;
  updateTicker: (instrument: string, ticker: DeriveTicker) => void;
  updateOrderBook: (instrument: string, book: DeriveOrderBook) => void;
  addTrade: (instrument: string, trade: DeriveTrade) => void;
  setTrades: (instrument: string, trades: DeriveTrade[]) => void;
  setCandles: (key: string, candles: DeriveCandle[]) => void;
  addCandle: (key: string, candle: DeriveCandle) => void;
  reset: () => void;
}

const MAX_RECENT_TRADES = 100;

export const useMarketStore = create<MarketState>()((set, get) => ({
  instruments: new Map(),
  instrumentsList: [],
  isLoadingInstruments: false,
  tickers: new Map(),
  orderBooks: new Map(),
  recentTrades: new Map(),
  candles: new Map(),

  setInstruments: (instruments) => {
    const map = new Map<string, DeriveInstrument>();
    for (const inst of instruments) {
      map.set(inst.instrument_name, inst);
    }
    set({ instruments: map, instrumentsList: instruments });
  },

  setLoadingInstruments: (isLoadingInstruments) => set({ isLoadingInstruments }),

  updateTicker: (instrument, ticker) => {
    const tickers = new Map(get().tickers);
    tickers.set(instrument, ticker);
    set({ tickers });
  },

  updateOrderBook: (instrument, book) => {
    const orderBooks = new Map(get().orderBooks);
    orderBooks.set(instrument, book);
    set({ orderBooks });
  },

  addTrade: (instrument, trade) => {
    const recentTrades = new Map(get().recentTrades);
    const existing = recentTrades.get(instrument) || [];
    const updated = [trade, ...existing].slice(0, MAX_RECENT_TRADES);
    recentTrades.set(instrument, updated);
    set({ recentTrades });
  },

  setTrades: (instrument, trades) => {
    const recentTrades = new Map(get().recentTrades);
    recentTrades.set(instrument, trades.slice(0, MAX_RECENT_TRADES));
    set({ recentTrades });
  },

  setCandles: (key, candles) => {
    const candlesMap = new Map(get().candles);
    candlesMap.set(key, candles);
    set({ candles: candlesMap });
  },

  addCandle: (key, candle) => {
    const candlesMap = new Map(get().candles);
    const existing = candlesMap.get(key) || [];
    // Replace last candle if same timestamp, otherwise append
    if (existing.length > 0 && existing[existing.length - 1]!.timestamp === candle.timestamp) {
      const updated = [...existing.slice(0, -1), candle];
      candlesMap.set(key, updated);
    } else {
      candlesMap.set(key, [...existing, candle]);
    }
    set({ candles: candlesMap });
  },

  reset: () =>
    set({
      instruments: new Map(),
      instrumentsList: [],
      isLoadingInstruments: false,
      tickers: new Map(),
      orderBooks: new Map(),
      recentTrades: new Map(),
      candles: new Map(),
    }),
}));

// ─── Selectors ───
// NOTE: Do NOT use factory selectors like `(param) => (state) => ...` with useMarketStore().
// They create new function references per render, causing infinite loops with useSyncExternalStore.
// Instead, use inline selectors: `useMarketStore((s) => s.map.get(key))`
// For array filters, access the source array and use useMemo in the component.
