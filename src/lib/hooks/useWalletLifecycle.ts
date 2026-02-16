"use client";

import { useEffect, useRef } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { useAccountStore } from "@/lib/stores/accountStore";
import { useUiStore } from "@/lib/stores/uiStore";
import { wsManager } from "@/lib/derive/websocket";
import { deriveClient } from "@/lib/derive/client";

const DERIVE_CHAIN_IDS = { mainnet: 957, testnet: 901 } as const;

/**
 * Centralized wallet lifecycle: account change, chain mismatch, reconnect hygiene.
 * Call once in the auth layout so all protected routes get consistent reset/re-auth.
 */
export function useWalletLifecycle() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const environment = useUiStore((s) => s.environment);
  const expectedChainId = DERIVE_CHAIN_IDS[environment];
  const prevAddressRef = useRef<string | undefined>(undefined);
  const prevConnectedRef = useRef(false);

  // On account change or disconnect: clear auth and reset account state
  useEffect(() => {
    const accountStore = useAccountStore.getState();
    const prevAddress = prevAddressRef.current;
    const prevConnected = prevConnectedRef.current;

    if (prevConnected && prevAddress !== undefined) {
      const addressChanged = address !== prevAddress;
      const disconnected = !isConnected;
      if (addressChanged || disconnected) {
        accountStore.reset();
        deriveClient.clearAuth();
        wsManager.disconnect();
      }
    }

    prevAddressRef.current = address;
    prevConnectedRef.current = isConnected;
  }, [address, isConnected]);

  // Expose chain mismatch for UI (e.g. banner or prompt to switch)
  const chainMismatch =
    isConnected && chainId !== undefined && chainId !== expectedChainId;

  return {
    chainMismatch,
    expectedChainId,
    currentChainId: chainId,
    switchToDeriveChain: chainMismatch
      ? () => switchChainAsync({ chainId: expectedChainId })
      : undefined,
  };
}
