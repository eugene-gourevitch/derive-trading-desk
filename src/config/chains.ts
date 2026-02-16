import { defineChain } from "viem";

export const deriveMainnet = defineChain({
  id: 957,
  name: "Derive",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.derive.xyz"],
      webSocket: ["wss://rpc.derive.xyz"],
    },
  },
  blockExplorers: {
    default: {
      name: "Derive Explorer",
      url: "https://explorer.derive.xyz",
    },
  },
});

export const deriveTestnet = defineChain({
  id: 901,
  name: "Derive Testnet",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc-demo.derive.xyz"],
      webSocket: ["wss://rpc-demo.derive.xyz"],
    },
  },
  blockExplorers: {
    default: {
      name: "Derive Testnet Explorer",
      url: "https://explorer-demo.derive.xyz",
    },
  },
  testnet: true,
});
