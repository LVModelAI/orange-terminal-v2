// tokenSwapTransaction.ts
import { tool } from "ai";
import { isAddress } from "viem";
import z from "zod";
import { checkTokenBalance } from "@/lib/utils/checkTokenBalance";

export type TokenSwapProps = {
  tokenIn: string;
  tokenOut: string;
  amount: string;
  slippage: string;
  error?: string;
};

export const tokenSwapTransaction = tool({
  description:
    "Create a payload for swapping one tokenIn to another tokenOut via the Molten Swap Router. provide both token addresses. never give the token symbol, always give token address.",
  inputSchema: z.object({
    tokenIn: z.string().describe(" contract address for token in"),
    tokenOut: z.string().describe(" contract address for token out"),
    amount: z
      .string()
      .describe(
        "Amount of tokenIn to swap, up to 6 decimals rounded down, human-readable (e.g., '25.521312')"
      ),
    slippage: z.string().describe("Maximum allowed slippage"),
    walletAddress: z.string().describe("User's wallet address"),
  }),
  execute: async ({
    tokenIn,
    tokenOut,
    walletAddress,
    amount,
    slippage,
  }): Promise<TokenSwapProps> => {
    console.log("Executing tokenSwapTransaction with params:", {
      tokenIn,
      tokenOut,
      walletAddress,
      amount,
      slippage,
    });

    // --- Step 1: Resolve CORE ---
    if (!isAddress(tokenIn)) {
      if (tokenIn === "CORE") {
        tokenIn = "0x0000000000000000000000000000000000000000"; // Convert CORE to its address
      } else {
        throw new Error("tokenIn must be a valid address or 'CORE'.");
      }
    }

    if (!isAddress(tokenOut)) {
      throw new Error("tokenOut must be a valid address.");
    }
    const tokenAddress =
      tokenIn === "0x0000000000000000000000000000000000000000"
        ? "core"
        : tokenIn;

    // --- Step 2: Check balance of tokenIn ---
    const result = await checkTokenBalance(walletAddress, tokenAddress, amount);

    if (!result.ok) {
      console.log("Balance check failed:", result.error);
      return {
        tokenIn,
        tokenOut,
        amount,
        slippage,
        error: result.error,
      };
    }

    // --- Step 3: Return tx payload ---
    return {
      tokenIn,
      tokenOut,
      amount,
      slippage,
    };
  },
});
