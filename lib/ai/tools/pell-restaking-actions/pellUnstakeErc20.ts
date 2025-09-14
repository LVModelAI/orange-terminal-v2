// pell-unstake-erc20.ts
import { tool } from "ai";
import z from "zod";

export type PellUnstakeTxProps = {
  // Pell params
  tokenName: string;
  tokenAddress: string;
  strategyAddress: string; // Pell strategy
  amount: string; // human readable, for example "0.1"
};

export type PellUnstakeErc20Props = {
  tx: PellUnstakeTxProps;
  sendMessage: (msg: {
    role: "system" | "user" | "assistant";
    parts: { type: "text"; text: string }[];
  }) => void;
};

/**
 * Create a Pell ERC20 unstake payload UI descriptor.
 * Input: human readable amount, token address, token name, strategy address.
 *
 * UI should:
 * 1) fetch ERC20.decimals()
 * 2) convert amount to base units
 * 3) call the Pell strategy withdrawal flow as required by your contract
 *    (for example queueWithdrawals or withdraw)
 */
export const pellUnstakeErc20 = tool({
  description:
    "Create a Pell ERC20 unstake payload UI. Input: amount (human readable), tokenAddress, tokenName, strategyAddress.",
  inputSchema: z.object({
    value: z
      .string()
      .describe(
        "Amount of ERC20 to unstake, human readable (for example '0.1')"
      ),
    tokenAddress: z.string().describe("ERC20 token contract address"),
    tokenName: z
      .string()
      .describe("Display name for the token (for example 'stCORE')"),
    strategyAddress: z
      .string()
      .describe("Pell strategy contract address that will process the unstake"),
  }),
  execute: async ({
    value,
    tokenAddress,
    tokenName,
    strategyAddress,
  }): Promise<PellUnstakeTxProps> => {
    console.log("Executing pellUnstakeErc20 with params:", {
      value,
      tokenAddress,
      tokenName,
      strategyAddress,
    });

    const tx = {
      tokenName,
      tokenAddress,
      strategyAddress,
      amount: value, // convert to base units using decimals in the caller
    };

    return tx;
  },
});
