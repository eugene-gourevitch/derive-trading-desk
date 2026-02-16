"use client";

import { useState, useCallback, useEffect } from "react";
import { parseUnits } from "viem";
import { useAccount, useWalletClient, useSwitchChain, useWriteContract } from "wagmi";
import { useAccountStore } from "@/lib/stores/accountStore";
import { useUiStore } from "@/lib/stores/uiStore";
import { SUPPORTED_COLLATERALS } from "@/lib/derive/types";
import { getProtocolConstants } from "@/lib/derive/protocol-constants";
import { getDepositTypedData, getSignatureExpirySec, generateActionNonce } from "@/lib/derive/action-encoding";
import { deriveClient } from "@/lib/derive/client";
import { cn } from "@/lib/utils/cn";

const DERIVE_XYZ_URL = "https://derive.xyz";
const POLL_INTERVAL_MS = 2500;

type OnboardingStatus =
  | { state: "loading" }
  | { state: "waiting_for_chain"; transactionId?: string }
  | { state: "failed_signature"; error?: string }
  | { state: "completed"; subaccountId: number }
  | { state: "failed"; error?: string }
  | { state: string; error?: string; subaccountId?: number; transactionId?: string };

export function DepositPanel() {
  const subaccount = useAccountStore((s) => s.subaccount);
  const isConnected = useAccountStore((s) => s.isConnected);
  const isAuthenticated = useAccountStore((s) => s.isAuthenticated);
  const isLoadingAccount = useAccountStore((s) => s.isLoadingAccount);
  const accountError = useAccountStore((s) => s.error);

  const [selectedAsset, setSelectedAsset] = useState<string>("USDC");
  const [amount, setAmount] = useState("");
  const [isDepositing, setIsDepositing] = useState(false);
  const [txStatus, setTxStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [onboardingId, setOnboardingId] = useState<string | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  const [isStartingOnboarding, setIsStartingOnboarding] = useState(false);

  useEffect(() => {
    if (!onboardingId) return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/onboarding/${onboardingId}/status`);
        const data = await res.json();
        setOnboardingStatus(data.status);
        if (data.status?.state === "completed" || data.status?.state === "failed") {
          clearInterval(t);
        }
      } catch {
        // keep polling
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [onboardingId]);

  const startOnboarding = useCallback(async () => {
    setIsStartingOnboarding(true);
    setOnboardingStatus({ state: "loading" });
    setErrorMsg(null);
    try {
      const res = await fetch("/api/onboarding/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setOnboardingStatus({ state: "failed", error: data.error ?? "Failed to start" });
        setErrorMsg(data.error ?? "Failed to start onboarding");
        return;
      }
      setOnboardingId(data.id);
      setOnboardingStatus(data.status ?? { state: "loading" });
    } catch (err) {
      setOnboardingStatus({ state: "failed", error: (err as Error).message });
      setErrorMsg((err as Error).message);
    } finally {
      setIsStartingOnboarding(false);
    }
  }, []);

  const retryOnboarding = useCallback(async () => {
    if (!onboardingId) return;
    setIsStartingOnboarding(true);
    setOnboardingStatus({ state: "loading" });
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/onboarding/${onboardingId}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setOnboardingStatus({ state: "failed", error: data.error ?? "Retry failed" });
        setErrorMsg(data.error ?? "Retry failed");
        return;
      }
      setOnboardingStatus(data.status ?? { state: "loading" });
    } catch (err) {
      setOnboardingStatus({ state: "failed", error: (err as Error).message });
      setErrorMsg((err as Error).message);
    } finally {
      setIsStartingOnboarding(false);
    }
  }, [onboardingId]);

  const selectedCollateral = SUPPORTED_COLLATERALS.find((c) => c.name === selectedAsset);
  const environment = useUiStore((s) => s.environment);
  const deriveWallet = useAccountStore((s) => s.deriveWallet);
  const { address: eoaAddress } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const DERIVE_CHAIN_ID = environment === "testnet" ? 901 : 957;
  const POLL_DEPOSIT_MS = 3000;
  const POLL_DEPOSIT_ATTEMPTS = 40;

  const handleDeposit = useCallback(async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setTxStatus("error");
      setErrorMsg("Please enter a valid amount");
      return;
    }

    if (!isConnected || !eoaAddress || !walletClient) {
      setTxStatus("error");
      setErrorMsg("Connect your wallet first to deposit");
      return;
    }

    if (!subaccount) {
      setTxStatus("error");
      setErrorMsg(
        accountError ||
          "No Derive subaccount found. Create an account first."
      );
      return;
    }

    if (!deriveWallet) {
      setTxStatus("error");
      setErrorMsg("Account not loaded");
      return;
    }

    const decimals = selectedCollateral?.decimals ?? 6;
    const amountWei = parseUnits(amount, decimals);
    const c = getProtocolConstants(environment);
    const tokenAddress = c.tokenAddresses[selectedAsset];
    if (!tokenAddress || tokenAddress === "0x0000000000000000000000000000000000000000") {
      setTxStatus("error");
      setErrorMsg(`Deposit for ${selectedAsset} not configured on this network`);
      return;
    }

    setIsDepositing(true);
    setTxStatus("pending");
    setErrorMsg(null);
    setTxHash(null);

    try {
      deriveClient.setEnvironment(environment);

      // 1. Switch to Derive chain if needed
      const chainId = walletClient.chain?.id;
      if (chainId !== DERIVE_CHAIN_ID && switchChainAsync) {
        await switchChainAsync({ chainId: DERIVE_CHAIN_ID });
      }

      // 2. Approve token for deposit module
      const { depositModuleAddress } = c;
      await writeContractAsync({
        address: tokenAddress,
        abi: [
          {
            name: "approve",
            type: "function",
            stateMutability: "nonpayable",
            inputs: [
              { name: "spender", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            outputs: [{ type: "bool" }],
          },
        ],
        functionName: "approve",
        args: [depositModuleAddress, amountWei],
      });

      // 3. Sign deposit action (EIP-712)
      const nonce = generateActionNonce();
      const expirySec = getSignatureExpirySec();
      const typedData = getDepositTypedData(
        {
          subaccountId: subaccount.subaccount_id,
          nonce,
          amountWei,
          expirySec,
          wallet: deriveWallet as `0x${string}`,
          signer: deriveWallet as `0x${string}`,
        },
        environment
      );
      const signature = await walletClient.signTypedData({
        domain: typedData.domain,
        types: typedData.types,
        primaryType: typedData.primaryType,
        message: typedData.message,
      });

      // 4. Submit deposit to Derive API
      const result = await deriveClient.deposit({
        subaccount_id: subaccount.subaccount_id,
        amount,
        asset_name: selectedAsset,
        nonce,
        signature,
        signature_expiry_sec: expirySec,
        signer: deriveWallet,
      });

      const txId = result.transaction_id;
      setTxHash(txId);

      // 5. Poll until transfer appears or timeout
      let confirmed = false;
      for (let i = 0; i < POLL_DEPOSIT_ATTEMPTS; i++) {
        await new Promise((r) => setTimeout(r, POLL_DEPOSIT_MS));
        const history = await deriveClient.getTransferHistory({
          subaccount_id: subaccount.subaccount_id,
        });
        const transfers = (history as { transfers?: { transaction_id?: string; transfer_id?: string }[] })?.transfers ?? [];
        if (Array.isArray(transfers) && transfers.some((t) => (t.transaction_id ?? t.transfer_id) === txId)) {
          confirmed = true;
          break;
        }
      }
      setTxStatus("success");
      setAmount("");
    } catch (err) {
      setTxStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Deposit failed");
    } finally {
      setIsDepositing(false);
    }
  }, [
    amount,
    selectedAsset,
    subaccount,
    isConnected,
    accountError,
    deriveWallet,
    eoaAddress,
    walletClient,
    environment,
    selectedCollateral?.decimals,
    switchChainAsync,
    writeContractAsync,
  ]);

  if (!isConnected && !isAuthenticated) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-xs text-text-muted">
        <div className="mb-2 text-sm font-medium text-text-secondary">Deposit</div>
        <div>Connect wallet to deposit collateral</div>
      </div>
    );
  }

  if (isConnected && !subaccount && isLoadingAccount) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-xs text-text-muted">
        <div className="mb-2 text-sm font-medium text-text-secondary">Deposit</div>
        <div>Loading account…</div>
      </div>
    );
  }

  if (isConnected && !subaccount) {
    const status = onboardingStatus;
    const isWaiting =
      status?.state === "waiting_for_chain" || status?.state === "loading" || (onboardingId && !status);
    const isFailed =
      status?.state === "failed" || status?.state === "failed_signature";
    const isCompleted = status?.state === "completed" && "subaccountId" in status;

    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-center text-xs text-text-muted">
        <div className="mb-2 text-sm font-medium text-text-secondary">Deposit</div>
        {!onboardingId && !status && (
          <>
            <p className="mb-3">
              {accountError || "No Derive account or subaccount found."}
            </p>
            <button
              onClick={startOnboarding}
              disabled={isStartingOnboarding}
              className="mb-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-primary hover:brightness-110 disabled:opacity-50"
            >
              {isStartingOnboarding ? "Creating account…" : "Create account (automated)"}
            </button>
            <a
              href={DERIVE_XYZ_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              Or create at derive.xyz →
            </a>
          </>
        )}
        {onboardingId && isWaiting && (
          <p className="mb-2">
            {status?.state === "loading"
              ? "Creating account…"
              : "Waiting for chain confirmation…"}
          </p>
        )}
        {onboardingId && isFailed && (
          <>
            <p className="mb-2 text-red">
              {(status && "error" in status && status.error) || "Onboarding failed."}
            </p>
            <button
              onClick={retryOnboarding}
              disabled={isStartingOnboarding}
              className="rounded-md border border-border-default bg-bg-tertiary px-4 py-2 text-sm hover:bg-bg-hover disabled:opacity-50"
            >
              {isStartingOnboarding ? "Retrying…" : "Retry"}
            </button>
          </>
        )}
        {onboardingId && isCompleted && (
          <p className="text-green">
            Account ready (Sub #{status.subaccountId}). Refresh the page to load your account.
          </p>
        )}
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
