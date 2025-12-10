"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet, sepolia, arbitrumSepolia, foundry } from "wagmi/chains";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { useState, type ReactNode } from "react";
import { defineChain } from "viem";

// 自定义 Anvil 本地链配置
const anvil = defineChain({
  id: 31337,
  name: "Anvil Local",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
  blockExplorers: {
    default: { name: "Local", url: "http://127.0.0.1:8545" },
  },
  testnet: true,
});

// 配置 wagmi - Anvil 放在第一位作为默认网络
const config = createConfig({
  chains: [anvil, mainnet, sepolia, arbitrumSepolia],
  transports: {
    [anvil.id]: http("http://127.0.0.1:8545"),
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [arbitrumSepolia.id]: http(),
  },
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5000,
          },
        },
      })
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#d946ef",
            accentColorForeground: "white",
            borderRadius: "large",
            fontStack: "system",
          })}
          initialChain={anvil}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
