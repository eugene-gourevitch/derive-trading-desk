"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAccountStore } from "@/lib/stores/accountStore";

export default function LandingPage() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const router = useRouter();
  const setEoaAddress = useAccountStore((s) => s.setEoaAddress);
  const setConnected = useAccountStore((s) => s.setConnected);

  // Store address when connected, but don't auto-redirect
  useEffect(() => {
    if (isConnected && address) {
      setEoaAddress(address);
      setConnected(true);
    }
  }, [isConnected, address, setEoaAddress, setConnected]);

  return (
    <div className="flex h-screen items-center justify-center bg-bg-primary">
      <div className="w-full max-w-md space-y-8 px-6">
        {/* Logo / Title */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">
            Derive Trading Desk
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            Professional derivatives trading for Derive.xyz
          </p>
        </div>

        {/* Connection Panel */}
        <div className="rounded-lg border border-border-default bg-bg-secondary p-6">
          {isConnected ? (
            <div className="space-y-4 text-center">
              <div className="text-sm text-text-secondary">
                Connected as
              </div>
              <div className="font-mono-nums text-sm text-text-primary">
                {address}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => router.push("/desk")}
                  className="flex-1 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
                >
                  Enter Trading Desk
                </button>
                <button
                  onClick={() => disconnect()}
                  className="rounded-md border border-border-default px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="mb-4 text-center text-sm text-text-secondary">
                Connect your wallet to start trading
              </div>
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  onClick={() => connect({ connector })}
                  disabled={isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-border-default bg-bg-tertiary px-4 py-3 text-sm font-medium text-text-primary transition-colors hover:border-border-active hover:bg-bg-hover disabled:opacity-50"
                >
                  {isPending ? "Connecting..." : connector.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: "Options", desc: "Full chain" },
            { label: "Perps", desc: "Low latency" },
            { label: "Risk", desc: "Portfolio Greeks" },
          ].map((f) => (
            <div
              key={f.label}
              className="rounded-md border border-border-subtle bg-bg-secondary p-3"
            >
              <div className="text-xs font-semibold text-accent">
                {f.label}
              </div>
              <div className="mt-0.5 text-[10px] text-text-muted">
                {f.desc}
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-[10px] text-text-muted">
          Self-custodial. Your keys, your trades.
        </p>
      </div>
    </div>
  );
}
