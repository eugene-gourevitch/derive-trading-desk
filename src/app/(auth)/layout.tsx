"use client";

import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isConnected, isReconnecting } = useAccount();
  const router = useRouter();
  const [hasWaited, setHasWaited] = useState(false);

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

  return <>{children}</>;
}
