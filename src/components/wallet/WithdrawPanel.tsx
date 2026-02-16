"use client";

import { useState, useMemo, useCallback } from "react";
import { useAccountStore } from "@/lib/stores/accountStore";
import { SUPPORTED_COLLATERALS } from "@/lib/derive/types";
import { formatPrice } from "@/lib/utils/formatting";
import { cn } from "@/lib/utils/cn";

export function WithdrawPanel() {
  const subaccount = useAccountStore((s) => s.subaccount);
  const isConnected = useAccountStore((s) => s.isConnected);
  const isAuthenticated = useAccountStore((s) => s.isAuthenticated);

  const [selectedAsset, setSelectedAsset] = useState<string>("USDC");
  const [amount, setAmount] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [txStatus, setTxStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedCollateral = SUPPORTED_COLLATERALS.find((c) => c.name === selectedAsset);

  // Find the collateral balance for the selected asset
  const assetBalance = useMemo(() => {
    if (!subaccount) return "0";
    const col = subaccount.collaterals.find((c) => c.asset_name === selectedAsset);
    return col?.amount ?? "0";
  }, [subaccount, selectedAsset]);

  const handleWithdraw = useCallback(async () => {
    if (!amount || parseFloat(amount) <= 0 || !subaccount) return;

    const bal = parseFloat(assetBalance);
    const amt = parseFloat(amount);
    if (amt > bal) {
      setTxStatus("error");
      setErrorMsg(`Insufficient balance. Available: ${formatPrice(assetBalance, 6)}`);
      return;
    }

    setIsWithdrawing(true);
    setTxStatus("pending");
    setErrorMsg(null);
    setTxHash(null);

    try {
      // Withdraw flow:
      // 1. Sign withdrawal request (EIP-712)
      // 2. Submit to private/withdraw
      // 3. Funds bridge back from Derive Chain
      // For now, log the intent — signing will be wired in Phase 8
      console.log("[Withdraw]", {
        asset: selectedAsset,
        amount,
        subaccount_id: subaccount.subaccount_id,
      });

      await new Promise((r) => setTimeout(r, 1500));
      setTxStatus("success");
      setTxHash("0x" + Math.random().toString(16).slice(2, 66));
      setAmount("");
    } catch (err) {
      setTxStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Withdrawal failed");
    } finally {
      setIsWithdrawing(false);
    }
  }, [amount, selectedAsset, subaccount, assetBalance]);

  if (!isConnected && !isAuthenticated) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-xs text-text-muted">
        <div className="mb-2 text-sm font-medium text-text-secondary">Withdraw</div>
        <div>Connect wallet to withdraw collateral</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col text-xs">
      {/* Header */}
      <div className="shrink-0 border-b border-border-subtle px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Withdraw Collateral
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
                onClick={() => { setSelectedAsset(col.name); setAmount(""); }}
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

        {/* Available Balance */}
        <div className="rounded-md border border-border-subtle bg-bg-secondary p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-muted">Available to withdraw</span>
            <span className="font-mono-nums text-sm font-medium text-text-primary">
              {formatPrice(assetBalance, 6)} {selectedCollateral?.symbol}
            </span>
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
                onClick={() => setAmount(assetBalance)}
                className="rounded bg-accent-dim px-1.5 py-0.5 text-[9px] font-medium text-accent hover:bg-accent/20"
              >
                MAX
              </button>
            </div>
          </div>
        </div>

        {/* Percentage shortcuts */}
        <div className="flex gap-1.5">
          {[25, 50, 75, 100].map((pct) => {
            const val = (parseFloat(assetBalance) * pct / 100);
            return (
              <button
                key={pct}
                onClick={() => setAmount(val > 0 ? val.toString() : "")}
                className="flex-1 rounded border border-border-subtle bg-bg-tertiary py-1 text-[10px] text-text-secondary hover:border-border-active hover:text-text-primary"
              >
                {pct}%
              </button>
            );
          })}
        </div>

        {/* Margin check warning */}
        {amount && parseFloat(amount) > 0 && (
          <div className="rounded-md border border-yellow/30 bg-yellow-dim p-2 text-[10px] text-yellow">
            Withdrawing collateral reduces your margin. Ensure you have
            sufficient margin for open positions.
          </div>
        )}

        {/* Withdraw Button */}
        <button
          onClick={handleWithdraw}
          disabled={!amount || parseFloat(amount) <= 0 || isWithdrawing}
          className={cn(
            "w-full rounded-md px-4 py-2.5 text-sm font-semibold transition-colors",
            "bg-red text-white hover:brightness-110",
            "disabled:cursor-not-allowed disabled:opacity-40"
          )}
        >
          {isWithdrawing ? "Withdrawing..." : `Withdraw ${selectedCollateral?.symbol}`}
        </button>

        {/* Status */}
        {txStatus === "success" && txHash && (
          <div className="rounded-md border border-green/30 bg-green-dim p-2 text-[10px]">
            <div className="font-medium text-green">Withdrawal submitted</div>
            <div className="mt-0.5 text-text-muted">
              Funds will arrive after L2 confirmation (~2 min)
            </div>
            <div className="mt-0.5 font-mono-nums text-text-muted truncate">
              {txHash}
            </div>
          </div>
        )}

        {txStatus === "error" && errorMsg && (
          <div className="rounded-md border border-red/30 bg-red-dim p-2 text-[10px]">
            <div className="font-medium text-red">Withdrawal failed</div>
            <div className="mt-0.5 text-text-muted">{errorMsg}</div>
          </div>
        )}
      </div>
    </div>
  );
}
