import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DeriveEnvironment } from "../derive/constants";

export type LayoutPreset = "default" | "options-focus" | "perp-scalping" | "risk-monitor";

interface UiState {
  // Environment
  environment: DeriveEnvironment;
  setEnvironment: (env: DeriveEnvironment) => void;

  // Selected instrument
  selectedInstrument: string | null;
  setSelectedInstrument: (name: string) => void;

  // Selected underlying for options chain
  selectedUnderlying: string;
  setSelectedUnderlying: (underlying: string) => void;

  // Layout
  layoutPreset: LayoutPreset;
  setLayoutPreset: (preset: LayoutPreset) => void;

  // Active tabs per panel
  leftPanelTab: number;
  centerPanelTab: number;
  rightPanelTab: number;
  bottomPanelTab: number;
  setLeftPanelTab: (tab: number) => void;
  setCenterPanelTab: (tab: number) => void;
  setRightPanelTab: (tab: number) => void;
  setBottomPanelTab: (tab: number) => void;

  // Command palette
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;

  // Connection status
  wsConnected: boolean;
  setWsConnected: (connected: boolean) => void;

  // Sound effects
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      environment: "mainnet",
      setEnvironment: (environment) => set({ environment }),

      selectedInstrument: "ETH-PERP",
      setSelectedInstrument: (selectedInstrument) => set({ selectedInstrument }),

      selectedUnderlying: "ETH",
      setSelectedUnderlying: (selectedUnderlying) => set({ selectedUnderlying }),

      layoutPreset: "default",
      setLayoutPreset: (layoutPreset) => set({ layoutPreset }),

      leftPanelTab: 0,
      centerPanelTab: 0,
      rightPanelTab: 0,
      bottomPanelTab: 0,
      setLeftPanelTab: (leftPanelTab) => set({ leftPanelTab }),
      setCenterPanelTab: (centerPanelTab) => set({ centerPanelTab }),
      setRightPanelTab: (rightPanelTab) => set({ rightPanelTab }),
      setBottomPanelTab: (bottomPanelTab) => set({ bottomPanelTab }),

      commandPaletteOpen: false,
      setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
      toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),

      wsConnected: false,
      setWsConnected: (wsConnected) => set({ wsConnected }),

      soundEnabled: false,
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
    }),
    {
      name: "derive-desk-ui",
      partialize: (state) => ({
        environment: state.environment,
        selectedInstrument: state.selectedInstrument,
        selectedUnderlying: state.selectedUnderlying,
        layoutPreset: state.layoutPreset,
        soundEnabled: state.soundEnabled,
      }),
    }
  )
);
