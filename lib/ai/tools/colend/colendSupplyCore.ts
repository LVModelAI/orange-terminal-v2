// supply-core.ts
import {
  COLEND_POOL_ADDRESS,
  COLEND_WrappedTokenGatewayV3,
} from "@/lib/constants";
import { ChatMessage } from "@/lib/types";
import { UseChatHelpers } from "@ai-sdk/react";
import { tool } from "ai";
import z from "zod";
import { checkTokenBalance } from "@/lib/utils/checkTokenBalance";

export type ColendSupplyCoreTxProps = {
  method: "depositETH";
  gatewayAddress: string;
  poolAddress: string;
  referralCode: number;
  value: string;
  error?: string;
};

export type ColendSupplyCoreProps = {
  tx: ColendSupplyCoreTxProps;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
};

export const colendSupplyCore = tool({
  description:
    "Create a Colend supply CORE payload (depositETH -> aCoreWCORE). Input: human-readable CORE amount (e.g., '1.0').",
  inputSchema: z.object({
    value: z
      .string()
      .describe("Amount of CORE to supply, human-readable (e.g., '1.5')"),
    walletAddress: z
      .string()
      .describe("User's wallet address to fetch balance from"),
  }),
  execute: async ({
    value,
    walletAddress,
  }): Promise<ColendSupplyCoreTxProps> => {
    console.log("Executing colendSupplyCore with params:", {
      value,
      walletAddress,
    });

    // --- Step 1: Check CORE balance using helper ---
    const result = await checkTokenBalance(
      walletAddress,
      "core", // special case for native CORE
      "CORE",
      value
    );

    // --- Step 3: Handle insufficient balance or errors ---
    if (!result.ok) {
      return {
        method: "depositETH",
        gatewayAddress: COLEND_WrappedTokenGatewayV3,
        poolAddress: COLEND_POOL_ADDRESS,
        referralCode: 0,
        value,
        error: result.error,
      };
    }

    // --- Step 2: Enforce gas requirement (0.5 CORE left after tx) ---
    if (result.ok && result.balanceHuman - result.requested < 0.5) {
      return {
        method: "depositETH",
        gatewayAddress: COLEND_WrappedTokenGatewayV3,
        poolAddress: COLEND_POOL_ADDRESS,
        referralCode: 0,
        value,
        error: `Not enough CORE left for gas: you would have ${
          result.balanceHuman - result.requested
        } CORE after supplying, but need at least 0.5.`,
      };
    }

    // --- Step 4: Return tx payload ---
    return {
      method: "depositETH",
      gatewayAddress: COLEND_WrappedTokenGatewayV3,
      poolAddress: COLEND_POOL_ADDRESS,
      referralCode: 0,
      value,
    };
  },
});
