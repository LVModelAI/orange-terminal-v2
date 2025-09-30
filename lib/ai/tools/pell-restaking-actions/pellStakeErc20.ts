// pell-stake-erc20.ts
import { tool } from "ai";
import z from "zod";
import { UseChatHelpers } from "@ai-sdk/react";
import type { ChatMessage } from "@/lib/types";
import { checkTokenBalance } from "@/lib/utils/checkTokenBalance";

export type PellStakeErc20TxProps = {
  tokenName: string; // e.g. "USDC"
  tokenAddress: string; // ERC-20
  strategyAddress: string; // Pell strategy/receiver of deposit
  amount: string; // human-readable amount, e.g. "0.5"
  error?: string;
};

export type PellStakeErc20Props = {
  tx: PellStakeErc20TxProps;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
};

export const pellStakeErc20 = tool({
  description:
    "Create a Pell ERC20 stake payload UI. Input: amount (human-readable), tokenAddress, tokenName, strategyAddress, walletAddress.",
  inputSchema: z.object({
    value: z
      .string()
      .describe("Amount of ERC20 to stake, human-readable (e.g., '0.5')"),
    tokenAddress: z.string().describe("ERC20 token contract address"),
    tokenName: z
      .string()
      .describe("Display name for the token (e.g., 'stCORE')"),
    strategyAddress: z
      .string()
      .describe("Pell strategy contract address that receives the stake"),
    walletAddress: z.string().describe("User's wallet address"),
  }),
  execute: async ({
    value,
    tokenAddress,
    tokenName,
    strategyAddress,
    walletAddress,
  }): Promise<PellStakeErc20TxProps> => {
    console.log("Executing pellStakeErc20 with params:", {
      value,
      tokenAddress,
      tokenName,
      strategyAddress,
      walletAddress,
    });

    // --- Step 1: Check balance ---
    const result = await checkTokenBalance(walletAddress, tokenAddress, value);

    if (!result.ok) {
      console.log("Balance check failed:", result.error);
      return {
        tokenName,
        tokenAddress,
        strategyAddress,
        amount: value,
        error: result.error,
      };
    }

    // --- Step 2: Return tx payload ---
    return {
      tokenName,
      tokenAddress,
      strategyAddress,
      amount: value, // convert to base units in caller
    };
  },
});
