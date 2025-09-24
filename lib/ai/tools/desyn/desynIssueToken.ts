// desynIssueToken.ts
import { tool } from "ai";
import z from "zod";
import { UseChatHelpers } from "@ai-sdk/react";
import type { ChatMessage } from "@/lib/types";

export type DesynIssueTokenTxProps = {
  poolAddress: `0x${string}`;
  amount: string; // human-readable amount of handle token (e.g., "100")
};

export type DesynIssueTokenProps = {
  tx: DesynIssueTokenTxProps;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
};

export const desynIssueToken = tool({
  description:
    "Create a DeSyn issue token payload UI. Inputs: poolAddress (DeSyn pool) and amount (human-readable). First call getDefiProtocolsStats to fetch DeSyn pools and select a valid poolAddress, then pass it here.",
  inputSchema: z.object({
    poolAddress: z
      .string()
      .describe("DeSyn pool address (from getDefiProtocolsStats)"),
    amount: z
      .string()
      .describe("Human-readable amount of handle token to issue (e.g., '100')"),
  }),
  execute: async ({ poolAddress, amount }): Promise<DesynIssueTokenTxProps> => {
    console.log("Executing desynIssueToken with params:", {
      poolAddress,
      amount,
    });

    return {
      poolAddress: poolAddress as `0x${string}`,
      amount,
    };
  },
});
