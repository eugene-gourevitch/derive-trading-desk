import { create } from "zustand";
import type { DerivePosition } from "../derive/types";
import Decimal from "decimal.js-light";

interface PortfolioGreeks {
  netDelta: string;
  netGamma: string;
  netTheta: string;
  netVega: string;
}

interface PositionState {
  positions: DerivePosition[];
  isLoading: boolean;

  // Actions
  setPositions: (positions: DerivePosition[]) => void;
  updatePosition: (instrument: string, position: DerivePosition) => void;
  removePosition: (instrument: string) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const usePositionStore = create<PositionState>()((set, get) => ({
  positions: [],
  isLoading: false,

  setPositions: (positions) => set({ positions }),

  updatePosition: (instrument, position) => {
    const positions = get().positions;
    const idx = positions.findIndex((p) => p.instrument_name === instrument);
    if (idx >= 0) {
      const updated = [...positions];
      updated[idx] = position;
      set({ positions: updated });
    } else {
      set({ positions: [...positions, position] });
    }
  },

  removePosition: (instrument) => {
    set({
      positions: get().positions.filter((p) => p.instrument_name !== instrument),
    });
  },

  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ positions: [], isLoading: false }),
}));

// ─── Selectors ───

export const selectPortfolioGreeks = (state: PositionState): PortfolioGreeks => {
  let netDelta = new Decimal(0);
  let netGamma = new Decimal(0);
  let netTheta = new Decimal(0);
  let netVega = new Decimal(0);

  for (const pos of state.positions) {
    const amount = new Decimal(pos.amount);
    netDelta = netDelta.plus(new Decimal(pos.delta).times(amount));
    netGamma = netGamma.plus(new Decimal(pos.gamma).times(amount));
    netTheta = netTheta.plus(new Decimal(pos.theta).times(amount));
    netVega = netVega.plus(new Decimal(pos.vega).times(amount));
  }

  return {
    netDelta: netDelta.toFixed(4),
    netGamma: netGamma.toFixed(6),
    netTheta: netTheta.toFixed(4),
    netVega: netVega.toFixed(4),
  };
};

export const selectTotalUnrealizedPnl = (state: PositionState): string => {
  let total = new Decimal(0);
  for (const pos of state.positions) {
    total = total.plus(new Decimal(pos.unrealized_pnl));
  }
  return total.toFixed(2);
};

export const selectTotalRealizedPnl = (state: PositionState): string => {
  let total = new Decimal(0);
  for (const pos of state.positions) {
    total = total.plus(new Decimal(pos.realized_pnl));
  }
  return total.toFixed(2);
};

export const selectPositionByInstrument =
  (instrument: string) => (state: PositionState) =>
    state.positions.find((p) => p.instrument_name === instrument);
