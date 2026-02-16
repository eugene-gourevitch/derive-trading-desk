"use client";

import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useWalletLifecycle } from "@/lib/hooks/useWalletLifecycle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isConnected, isReconnecting } = useAccount();
  const router = useRouter();
  const [hasWaited, setHasWaited] = useState(false);
  const { chainMismatch, switchToDeriveChain } = useWalletLifecycle();

  // Give wagmi time to auto-reconnect on page refresh before redirecting
  useEffect(() => {
    const timer = setTimeout(() => setHasWaited(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Only redirect after we've waited for reconnection
    if (hasWaited && !isConnected && !isReconnecting) {
      router.push("/");
    }
  }, [isConnected, isReconnecting, hasWaited, router]);

  if (!hasWaited || isReconnecting) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-text-muted text-sm">Connecting...</div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-text-muted text-sm">Redirecting...</div>
      </div>
    );
  }

  return (
    <>
      {chainMismatch && switchToDeriveChain && (
        <div className="flex items-center justify-center gap-3 border-b border-yellow/30 bg-yellow-dim px-3 py-2 text-sm text-yellow">
          <span>Wrong network. Switch to Derive to trade.</span>
          <button
            type="button"
            onClick={() => switchToDeriveChain()}
            className="rounded bg-yellow px-2 py-1 text-bg-primary font-medium hover:brightness-110"
          >
            Switch network
          </button>
        </div>
      )}
      {children}
    </>
  );
}
