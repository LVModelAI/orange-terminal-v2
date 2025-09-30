// colend-supply-erc20.ts
import { COLEND_POOL_ADDRESS } from "@/lib/constants";
import { ChatMessage } from "@/lib/types";
import { UseChatHelpers } from "@ai-sdk/react";
import { tool } from "ai";
import z from "zod";
import { checkTokenBalance } from "@/lib/utils/checkTokenBalance";

export type ColendSupplyErc20Approval = {
  method: "approve";
  tokenAddress: string; // ERC20 contract to call approve on
  spender: string; // pool address
  amount: string; // MAX_UINT256 for unlimited
};

export type ColendSupplyErc20Supply = {
  method: "supply";
  poolAddress: string; // pool to call supply on
  tokenAddress: string; // ERC20 asset
  tokenName: string;
  amount: string; // human-readable amount (component converts using decimals)
  referralCode: number; // 0
};

export type ColendSupplyErc20TxProps = {
  stage: "erc20-approval-and-supply";
  approval: ColendSupplyErc20Approval;
  supply: ColendSupplyErc20Supply;
  error?: string;
};

export type ColendSupplyErc20Props = {
  tx: ColendSupplyErc20TxProps;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
};

// const MAX_UINT256 =
//   "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

export const colendSupplyErc20 = tool({
  description:
    "Create a two-stage Colend ERC20 supply payload: (1) approve allowance to the pool, (2) supply the token to the pool. Input: human-readable amount, token address, token name.",
  inputSchema: z.object({
    value: z
      .string()
      .describe("Amount of ERC20 to supply, human-readable (e.g., '25.5')"),
    tokenAddress: z.string().describe("ERC20 token contract address to supply"),
    tokenName: z
      .string()
      .describe("Display name for the token (e.g., 'stCORE')"),
    walletAddress: z
      .string()
      .describe("User's wallet address to fetch balance from"),
  }),
  execute: async ({
    value,
    tokenAddress,
    tokenName,
    walletAddress,
  }): Promise<ColendSupplyErc20TxProps> => {
    console.log("Executing colendSupplyErc20 with params:", {
      value,
      tokenAddress,
      tokenName,
      walletAddress,
    });

    // --- Step 1: Check token balance using helper ---
    const result = await checkTokenBalance(
      walletAddress,
      tokenAddress,
      tokenName,
      value
    );

    // --- Step 2: Handle insufficient balance or missing token ---
    if (!result.ok) {
      console.log(result.error);
      return {
        stage: "erc20-approval-and-supply",
        approval: {
          method: "approve",
          tokenAddress,
          spender: COLEND_POOL_ADDRESS,
          amount: value,
        },
        supply: {
          method: "supply",
          poolAddress: COLEND_POOL_ADDRESS,
          tokenAddress,
          tokenName,
          amount: value,
          referralCode: 0,
        },
        error: result.error,
      };
    }

    // --- Step 3: Return tx payload ---
    return {
      stage: "erc20-approval-and-supply",
      approval: {
        method: "approve",
        tokenAddress,
        spender: COLEND_POOL_ADDRESS,
        amount: value, // UI can choose MAX_UINT256 instead
      },
      supply: {
        method: "supply",
        poolAddress: COLEND_POOL_ADDRESS,
        tokenAddress,
        tokenName,
        amount: value,
        referralCode: 0,
      },
    };
  },
});
