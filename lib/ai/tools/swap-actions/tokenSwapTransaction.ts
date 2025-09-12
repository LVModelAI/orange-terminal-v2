// tokenSwapTransaction.ts
import { tool } from "ai";
import { isAddress } from "viem";
import z from "zod";

export type TokenSwapProps = {
  tokenIn: string;
  tokenOut: string;
  amount: string;
  slippage: string;
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
        "Amount of tokenIn to swap upto 6 decimals rounded down, human-readable (e.g., '25.521312')"
      ),
    slippage: z.string().describe("Maximum allowed slippage"),
  }),
  execute: async ({
    tokenIn,
    tokenOut,
    amount,
    slippage,
  }): Promise<TokenSwapProps> => {
    console.log("Executing tokenSwapTransaction with params:", {
      tokenIn,
      tokenOut,
      amount,
      slippage,
    });

    // Check if tokenIn or tokenOut are valid addresses or symbols
    if (!isAddress(tokenIn)) {
      if (tokenIn === "CORE") {
        tokenIn = "0x0000000000000000000000000000000000000000"; // Convert CORE to its address
      } else {
        throw new Error("tokenIn must be a valid address, not a symbol.");
      }
    }

    if (!isAddress(tokenOut)) {
      throw new Error("tokenOut must be a valid address, not a symbol.");
    }

    return {
      tokenIn,
      tokenOut,
      amount,
      slippage,
    };
  },
});
