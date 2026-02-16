import { create } from "zustand";
import type { DeriveSubaccount, DeriveAccount } from "../derive/types";

interface AccountState {
  // Wallet
  eoaAddress: string | null;
  deriveWallet: string | null;
  isConnected: boolean;
  isAuthenticated: boolean;

  // Session key (in memory only - never persisted)
  sessionKeyAddress: string | null;
  sessionKeyPrivateKey: string | null;

  // Account data
  account: DeriveAccount | null;
  subaccount: DeriveSubaccount | null;
  activeSubaccountId: number | null;

  // Loading states
  isLoadingAccount: boolean;
  isLoadingSubaccount: boolean;
  error: string | null;

  // Actions
  setEoaAddress: (address: string | null) => void;
  setDeriveWallet: (wallet: string | null) => void;
  setConnected: (connected: boolean) => void;
  setAuthenticated: (authenticated: boolean) => void;
  setSessionKey: (address: string, privateKey: string) => void;
  clearSessionKey: () => void;
  setAccount: (account: DeriveAccount) => void;
  setSubaccount: (subaccount: DeriveSubaccount) => void;
  setActiveSubaccountId: (id: number) => void;
  setLoadingAccount: (loading: boolean) => void;
  setLoadingSubaccount: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  eoaAddress: null,
  deriveWallet: null,
  isConnected: false,
  isAuthenticated: false,
  sessionKeyAddress: null,
  sessionKeyPrivateKey: null,
  account: null,
  subaccount: null,
  activeSubaccountId: null,
  isLoadingAccount: false,
  isLoadingSubaccount: false,
  error: null,
};

export const useAccountStore = create<AccountState>()((set) => ({
  ...initialState,

  setEoaAddress: (eoaAddress) => set({ eoaAddress }),
  setDeriveWallet: (deriveWallet) => set({ deriveWallet }),
  setConnected: (isConnected) => set({ isConnected }),
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),

  setSessionKey: (address, privateKey) =>
    set({
      sessionKeyAddress: address,
      sessionKeyPrivateKey: privateKey,
    }),

  clearSessionKey: () =>
    set({
      sessionKeyAddress: null,
      sessionKeyPrivateKey: null,
      isAuthenticated: false,
    }),

  setAccount: (account) =>
    set({
      account,
      activeSubaccountId: account.default_subaccount_id,
    }),

  setSubaccount: (subaccount) => set({ subaccount }),
  setActiveSubaccountId: (activeSubaccountId) => set({ activeSubaccountId }),
  setLoadingAccount: (isLoadingAccount) => set({ isLoadingAccount }),
  setLoadingSubaccount: (isLoadingSubaccount) => set({ isLoadingSubaccount }),
  setError: (error) => set({ error }),

  reset: () => set(initialState),
}));

// ─── Derived selectors ───

export const selectPortfolioValue = (state: AccountState) =>
  state.subaccount?.subaccount_value ?? "0";

export const selectMarginUsed = (state: AccountState) =>
  state.subaccount?.initial_margin ?? "0";

export const selectMarginAvailable = (state: AccountState) => {
  if (!state.subaccount) return "0";
  const total = parseFloat(state.subaccount.collaterals_value);
  const used = parseFloat(state.subaccount.initial_margin);
  return (total - used).toString();
};

export const selectMarginUtilization = (state: AccountState) => {
  if (!state.subaccount) return 0;
  const total = parseFloat(state.subaccount.collaterals_value);
  if (total === 0) return 0;
  const used = parseFloat(state.subaccount.initial_margin);
  return used / total;
};

export const selectIsLiquidationRisk = (state: AccountState) =>
  state.subaccount?.is_under_liquidation ?? false;
