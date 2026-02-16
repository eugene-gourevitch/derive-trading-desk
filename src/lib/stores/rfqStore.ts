import { create } from "zustand";
import type { RfqLeg, RfqQuote } from "../derive/types";

interface RfqState {
  // Builder state
  legs: RfqLeg[];
  isSubmitting: boolean;

  // Active RFQs
  activeRfqId: string | null;
  quotes: RfqQuote[];
  isPolling: boolean;

  // Actions
  addLeg: (leg: RfqLeg) => void;
  removeLeg: (index: number) => void;
  updateLeg: (index: number, leg: RfqLeg) => void;
  clearLegs: () => void;
  setSubmitting: (submitting: boolean) => void;
  setActiveRfqId: (id: string | null) => void;
  setQuotes: (quotes: RfqQuote[]) => void;
  setPolling: (polling: boolean) => void;
  reset: () => void;
}

export const useRfqStore = create<RfqState>()((set, get) => ({
  legs: [],
  isSubmitting: false,
  activeRfqId: null,
  quotes: [],
  isPolling: false,

  addLeg: (leg) => set({ legs: [...get().legs, leg] }),

  removeLeg: (index) => {
    set({ legs: get().legs.filter((_, i) => i !== index) });
  },

  updateLeg: (index, leg) => {
    const legs = [...get().legs];
    legs[index] = leg;
    set({ legs });
  },

  clearLegs: () => set({ legs: [] }),
  setSubmitting: (isSubmitting) => set({ isSubmitting }),
  setActiveRfqId: (activeRfqId) => set({ activeRfqId }),
  setQuotes: (quotes) => set({ quotes }),
  setPolling: (isPolling) => set({ isPolling }),

  reset: () =>
    set({
      legs: [],
      isSubmitting: false,
      activeRfqId: null,
      quotes: [],
      isPolling: false,
    }),
}));
