"use client";

import { useState, useCallback } from "react";
import { parseUnits } from "viem";
import { useAccount, useWalletClient, useSwitchChain, useWriteContract } from "wagmi";
import { useAccountStore } from "@/lib/stores/accountStore";
import { useUiStore } from "@/lib/stores/uiStore";
import { SUPPORTED_COLLATERALS, type DeriveAccount, type DeriveSubaccount } from "@/lib/derive/types";
import { getProtocolConstants } from "@/lib/derive/protocol-constants";
import { getDepositTypedData, getSignatureExpirySec, generateActionNonce } from "@/lib/derive/action-encoding";
import { deriveClient } from "@/lib/derive/client";
import { cn } from "@/lib/utils/cn";
import { getWalletErrorMessage } from "@/lib/utils/wallet-errors";

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
  const setAccount = useAccountStore((s) => s.setAccount);
  const setSubaccount = useAccountStore((s) => s.setSubaccount);
  const setActiveSubaccountId = useAccountStore((s) => s.setActiveSubaccountId);
  const setAuthenticated = useAccountStore((s) => s.setAuthenticated);
  const setStoreError = useAccountStore((s) => s.setError);

  const [selectedAsset, setSelectedAsset] = useState<string>("USDC");
  const [amount, setAmount] = useState("");
  const [isDepositing, setIsDepositing] = useState(false);
  const [txStatus, setTxStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  const [isStartingOnboarding, setIsStartingOnboarding] = useState(false);
  const selectedCollateral = SUPPORTED_COLLATERALS.find((c) => c.name === selectedAsset);
  const environment = useUiStore((s) => s.environment);
  const deriveWallet = useAccountStore((s) => s.deriveWallet);
  const { address: eoaAddress } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const startOnboarding = useCallback(async () => {
    if (!isConnected || !eoaAddress || !walletClient) {
      setOnboardingStatus({
        state: "failed",
        error: "Connect your wallet first to create an account.",
      });
      return;
    }

    const wallet = deriveWallet ?? eoaAddress;
    setIsStartingOnboarding(true);
    setOnboardingStatus({ state: "loading" });
    setErrorMsg(null);
    try {
      deriveClient.setEnvironment(environment);
      deriveClient.setAuth(wallet, (timestamp) =>
        walletClient.signMessage({ message: timestamp })
      );

      await deriveClient.createAccount(wallet);

      const nonce = generateActionNonce();
      const expirySec = getSignatureExpirySec();
      const amountWei = parseUnits("0", 6);
      const typedData = getDepositTypedData(
        {
          subaccountId: 0,
          nonce,
          amountWei,
          expirySec,
          wallet: wallet as `0x${string}`,
          signer: wallet as `0x${string}`,
        },
        environment
      );
      const signature = await walletClient.signTypedData({
        domain: typedData.domain,
        types: typedData.types,
        primaryType: typedData.primaryType,
        message: typedData.message,
      });

      const createResult = await deriveClient.createSubaccount({
        wallet,
        signer: wallet,
        margin_type: "SM",
        amount: "0",
        asset_name: "USDC",
        nonce,
        signature,
        signature_expiry_sec: expirySec,
      });
      setOnboardingStatus({
        state: "waiting_for_chain",
        transactionId: createResult.transaction_id,
      });

      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        const account = await deriveClient.getAccount();
        const subaccounts = await deriveClient.getSubaccounts(wallet);
        const latest = subaccounts.subaccounts?.[subaccounts.subaccounts.length - 1];
        if (!latest) continue;

        const loadedSubaccount = await deriveClient.getSubaccount(latest.subaccount_id);
        setAccount(account as DeriveAccount);
        setSubaccount(loadedSubaccount as DeriveSubaccount);
        setActiveSubaccountId(latest.subaccount_id);
        setAuthenticated(true);
        setStoreError(null);
        setOnboardingStatus({
          state: "completed",
          subaccountId: latest.subaccount_id,
        });
        return;
      }

      setOnboardingStatus({
        state: "failed",
        error: "Created account, but subaccount confirmation timed out. Please retry.",
      });
    } catch (err) {
      setOnboardingStatus({ state: "failed", error: (err as Error).message });
      setErrorMsg((err as Error).message);
    } finally {
      setIsStartingOnboarding(false);
    }
  }, [
    deriveWallet,
    eoaAddress,
    environment,
    isConnected,
    setAccount,
    setActiveSubaccountId,
    setAuthenticated,
    setStoreError,
    setSubaccount,
    walletClient,
  ]);

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
      const { message } = getWalletErrorMessage(err, "Deposit failed. Please try again.");
      setErrorMsg(message);
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
      status?.state === "waiting_for_chain" || status?.state === "loading";
    const isFailed =
      status?.state === "failed" || status?.state === "failed_signature";
    const isCompleted = status?.state === "completed" && "subaccountId" in status;

    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-center text-xs text-text-muted">
        <div className="mb-2 text-sm font-medium text-text-secondary">Deposit</div>
        {!status && (
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
          </>
        )}
        {isWaiting && (
          <p className="mb-2">
            {status?.state === "loading"
              ? "Creating account…"
              : "Waiting for chain confirmation…"}
          </p>
        )}
        {isFailed && (
          <>
            <p className="mb-2 text-red">
              {(status && "error" in status && status.error) || "Onboarding failed."}
            </p>
            <button
              onClick={startOnboarding}
              disabled={isStartingOnboarding}
              className="rounded-md border border-border-default bg-bg-tertiary px-4 py-2 text-sm hover:bg-bg-hover disabled:opacity-50"
            >
              {isStartingOnboarding ? "Retrying…" : "Retry"}
            </button>
          </>
        )}
        {isCompleted && (
          <p className="text-green">
            Account ready (Sub #{status.subaccountId}).
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
