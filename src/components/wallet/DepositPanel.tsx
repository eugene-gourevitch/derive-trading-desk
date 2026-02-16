"use client";

import { useState, useCallback } from "react";
import { useAccountStore } from "@/lib/stores/accountStore";
import { SUPPORTED_COLLATERALS } from "@/lib/derive/types";
import { cn } from "@/lib/utils/cn";

export function DepositPanel() {
  const subaccount = useAccountStore((s) => s.subaccount);
  const isConnected = useAccountStore((s) => s.isConnected);
  const isAuthenticated = useAccountStore((s) => s.isAuthenticated);

  const [selectedAsset, setSelectedAsset] = useState<string>("USDC");
  const [amount, setAmount] = useState("");
  const [isDepositing, setIsDepositing] = useState(false);
  const [txStatus, setTxStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedCollateral = SUPPORTED_COLLATERALS.find((c) => c.name === selectedAsset);

  const handleDeposit = useCallback(async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setTxStatus("error");
      setErrorMsg("Please enter a valid amount");
      return;
    }

    if (!isConnected) {
      setTxStatus("error");
      setErrorMsg("Connect your wallet first to deposit");
      return;
    }

    if (!subaccount) {
      // Redirect to derive.xyz to create/manage account
      setTxStatus("error");
      setErrorMsg("No Derive subaccount found. Authenticate first or visit derive.xyz to create an account.");
      return;
    }

    setIsDepositing(true);
    setTxStatus("pending");
    setErrorMsg(null);
    setTxHash(null);

    try {
      // Deposit flow:
      // 1. Approve token spend on L1/L2
      // 2. Call bridge contract to deposit to Derive Chain subaccount
      // 3. Poll for confirmation
      // For now, log the intent — EIP-712 signing and bridge tx will be wired in Phase 8
      console.log("[Deposit]", {
        asset: selectedAsset,
        amount,
        subaccount_id: subaccount.subaccount_id,
      });

      // Simulate tx for now
      await new Promise((r) => setTimeout(r, 1500));
      setTxStatus("success");
      setTxHash("0x" + Math.random().toString(16).slice(2, 66));
      setAmount("");
    } catch (err) {
      setTxStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Deposit failed");
    } finally {
      setIsDepositing(false);
    }
  }, [amount, selectedAsset, subaccount, isConnected]);

  if (!isConnected && !isAuthenticated) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-xs text-text-muted">
        <div className="mb-2 text-sm font-medium text-text-secondary">Deposit</div>
        <div>Connect wallet to deposit collateral</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col text-xs">
      {/* Header */}
      <div className="shrink-0 border-b border-border-subtle px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Deposit Collateral
        </span>
        {subaccount && (
          <span className="ml-2 text-text-muted">
            Sub #{subaccount.subaccount_id}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-4">
        {/* Asset Selector */}
        <div>
          <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-text-muted">
            Asset
          </label>
          <div className="grid grid-cols-5 gap-1">
            {SUPPORTED_COLLATERALS.map((col) => (
              <button
                key={col.name}
                onClick={() => setSelectedAsset(col.name)}
                className={cn(
                  "rounded-md border px-2 py-2 text-center text-[10px] font-medium transition-colors",
                  selectedAsset === col.name
                    ? "border-accent bg-accent-dim text-accent"
                    : "border-border-subtle bg-bg-tertiary text-text-secondary hover:border-border-active hover:text-text-primary"
                )}
              >
                <div className="text-sm">{col.icon}</div>
                <div className="mt-0.5">{col.symbol}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-text-muted">
            Amount ({selectedCollateral?.symbol ?? selectedAsset})
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                const val = e.target.value;
                if (/^\d*\.?\d*$/.test(val)) setAmount(val);
              }}
              placeholder="0.00"
              className="w-full rounded-md border border-border-default bg-bg-primary px-3 py-2.5 font-mono-nums text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              <button
                onClick={() => setAmount("")}
                className="rounded px-1.5 py-0.5 text-[9px] text-text-muted hover:bg-bg-hover hover:text-text-secondary"
              >
                CLEAR
              </button>
            </div>
          </div>
        </div>

        {/* Quick amounts */}
        <div className="flex gap-1.5">
          {["10", "100", "1000", "5000"].map((preset) => (
            <button
              key={preset}
              onClick={() => setAmount(preset)}
              className="flex-1 rounded border border-border-subtle bg-bg-tertiary py-1 text-[10px] text-text-secondary hover:border-border-active hover:text-text-primary"
            >
              {selectedAsset === "ETH" || selectedAsset === "WBTC"
                ? preset === "10" ? "0.01" : preset === "100" ? "0.1" : preset === "1000" ? "1" : "5"
                : preset}
            </button>
          ))}
        </div>

        {/* Info */}
        <div className="rounded-md border border-border-subtle bg-bg-secondary p-2.5 text-[10px] text-text-muted space-y-1">
          <div className="flex justify-between">
            <span>Network</span>
            <span className="text-text-secondary">Derive Chain (957)</span>
          </div>
          <div className="flex justify-between">
            <span>Asset</span>
            <span className="text-text-secondary">{selectedCollateral?.symbol}</span>
          </div>
          {amount && parseFloat(amount) > 0 && (
            <div className="flex justify-between">
              <span>Deposit amount</span>
              <span className="font-mono-nums text-text-primary">{amount} {selectedCollateral?.symbol}</span>
            </div>
          )}
        </div>

        {/* Deposit Button */}
        <button
          onClick={handleDeposit}
          disabled={isDepositing}
          className={cn(
            "w-full rounded-md px-4 py-2.5 text-sm font-semibold transition-colors",
            "bg-green text-bg-primary hover:brightness-110",
            "disabled:cursor-not-allowed disabled:opacity-40"
          )}
        >
          {isDepositing ? "Depositing..." : `Deposit ${selectedCollateral?.symbol}`}
        </button>

        {/* Status */}
        {txStatus === "success" && txHash && (
          <div className="rounded-md border border-green/30 bg-green-dim p-2 text-[10px]">
            <div className="font-medium text-green">Deposit submitted</div>
            <div className="mt-0.5 font-mono-nums text-text-muted truncate">
              {txHash}
            </div>
          </div>
        )}

        {txStatus === "error" && errorMsg && (
          <div className="rounded-md border border-red/30 bg-red-dim p-2 text-[10px]">
            <div className="font-medium text-red">Deposit failed</div>
            <div className="mt-0.5 text-text-muted">{errorMsg}</div>
          </div>
        )}
      </div>
    </div>
  );
}
