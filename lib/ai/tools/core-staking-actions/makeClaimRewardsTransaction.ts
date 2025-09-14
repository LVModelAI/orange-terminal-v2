import { CHAIN_ID } from "@/lib/constants";
import { ChatMessage } from "@/lib/types";
import { toWei } from "@/lib/utils";
import { UseChatHelpers } from "@ai-sdk/react";
import { tool } from "ai";
import z from "zod";

export interface ClaimRewardsComponentProps {
  candidateAddress: string;
  candidateName?: string;
  humanReadableValue: string;
  valueInWei: string;
  chainId: number;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
}

// 1. Unstake (undelegate) CORE
export const makeClaimRewardsTransaction = tool({
  description: `Create a claim rewards object to claim rewards from candidates. Pass the candidate address, name, value to unstake (in human-readable value) like 1.5 core, and chainId (default is ${CHAIN_ID}).`,
  inputSchema: z.object({
    candidateAddress: z
      .string()
      .describe("The candidate (validator) address to undelegate from"),
    candidateName: z.string().describe("The candidate (validator) name"),
    value: z
      .string()
      .describe(
        "The amount of CORE to undelegate (in human-readable value) like 1.5 core"
      ),
    chainId: z.number().default(CHAIN_ID),
  }),
  execute: async ({ candidateAddress, candidateName, value, chainId }) => {
    const valueInWei = toWei(value);

    const transaction = {
      candidateAddress,
      candidateName,
      humanReadableValue: value,
      valueInWei,
      chainId,
    };

    console.log("transaction in makeUnDelegateCoreTransaction", transaction);
    return transaction;
  },
});
