"use client";

import { http, createConfig } from "wagmi";
import { mainnet } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";
import { deriveMainnet, deriveTestnet } from "./chains";

const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "";

export const wagmiConfig = createConfig({
  chains: [mainnet, deriveMainnet, deriveTestnet],
  connectors: [
    injected(),
    ...(WALLETCONNECT_PROJECT_ID
      ? [walletConnect({ projectId: WALLETCONNECT_PROJECT_ID })]
      : []),
  ],
  transports: {
    [mainnet.id]: http(),
    [deriveMainnet.id]: http("https://rpc.derive.xyz"),
    [deriveTestnet.id]: http("https://rpc-demo.derive.xyz"),
  },
  ssr: true,
});
