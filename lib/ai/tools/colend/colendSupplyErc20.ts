// colend-supply-erc20.ts
import { COLEND_POOL_ADDRESS } from "@/lib/constants";
import { ChatMessage } from "@/lib/types";
import { UseChatHelpers } from "@ai-sdk/react";
import { tool } from "ai";
import z from "zod";

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

    // --- Step 1: Fetch portfolio tokens ---
    const res = await fetch(
      `${
        process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
      }/api/portfolio/tokens?address=${walletAddress}`
    );
    if (!res.ok) {
      throw new Error("Failed to fetch portfolio");
    }
    const { tokens } = (await res.json()) as { tokens: any[] };

    // --- Step 2: Find matching token in portfolio ---
    const tokenData = tokens.find(
      (t) => t.token_address.toLowerCase() === tokenAddress.toLowerCase()
    );

    if (!tokenData) {
      console.log("No balance found for token ", tokenName, tokenAddress);
      return {
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
        stage: "erc20-approval-and-supply",
        error: `No balance found for token ${tokenName} (${tokenAddress})`,
      };
    }

    // --- Step 3: Convert balance to human-readable ---
    const decimals = tokenData.decimals || 18;
    const rawBalance = BigInt(tokenData.balance);
    const balanceHuman = Number(rawBalance) / 10 ** decimals;

    const requested = Number(value);

    if (balanceHuman < requested) {
      console.log("Insufficient balance for token ", tokenName, tokenAddress);
      return {
        stage: "erc20-approval-and-supply",
        approval: {
          method: "approve",
          tokenAddress,
          spender: COLEND_POOL_ADDRESS,
          amount: value,
        },
        error: `Insufficient balance: user has ${balanceHuman} ${tokenName}, but tried to supply ${requested}.`,
        supply: {
          method: "supply",
          poolAddress: COLEND_POOL_ADDRESS,
          tokenAddress,
          tokenName,
          amount: value,
          referralCode: 0,
        },
      };
    }

    // --- Step 4: Return tx payload ---
    return {
      stage: "erc20-approval-and-supply",
      approval: {
        method: "approve",
        tokenAddress,
        spender: COLEND_POOL_ADDRESS,
        amount: value, // UI can choose to use MAX_UINT256 instead
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
