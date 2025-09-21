// pellWithdrawErc20.ts
import { tool } from "ai";
import z from "zod";

export type PellWithdrawErc20TxProps = {
  strategy: string;
  tokenAddress: string;
};

export type PellWithdrawErc20Props = {
  tx: PellWithdrawErc20TxProps;
  sendMessage: (msg: {
    role: "system" | "user" | "assistant";
    parts: { type: "text"; text: string }[];
  }) => void;
};

export const pellWithdrawErc20 = tool({
  description:
    "Create a Pell ERC20 withdraw payload UI. Input: strategy, tokenAddress.",
  inputSchema: z.object({
    strategy: z
      .string()
      .describe("the strategy address of the token to withdraw"),
    tokenAddress: z
      .string()
      .describe("the token address of the token to withdraw"),
  }),
  execute: async ({
    strategy,
    tokenAddress,
  }): Promise<PellWithdrawErc20TxProps> => {
    console.log("Executing pellWithdrawErc20 with params:", {
      strategy,
      tokenAddress,
    });

    // console.log("strategy ---- ", strategy);

    return {
      strategy,
      tokenAddress,
    };
  },
});
