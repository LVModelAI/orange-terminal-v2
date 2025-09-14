import { CHAIN_ID } from "@/lib/constants";
import { ChatMessage } from "@/lib/types";
import { toWei } from "@/lib/utils";
import { UseChatHelpers } from "@ai-sdk/react";
import { tool } from "ai";
import z from "zod";

export type StakeComponentProps = {
  candidateAddress: string; // validator operator address
  candidateName: string; // validator operator address
  humanReadableValue: string;
  valueInWei: string; // amount in wei or decimal CORE string
  chainId: number;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
};

export const makeStakeCoreTransaction = tool({
  description: `Make a transaction object on the Core blockchain. Pass the receiver,recever ens name if avalaible, sender, amount (in human-readable value) like 1.5 core, and chainId. The chainId is ${CHAIN_ID} for the Core blockchain.`,
  inputSchema: z.object({
    candidateAddress: z.string().describe("The candidate (validator) address"),
    candidateName: z.string().describe("the candidate (validator) name"),
    value: z
      .string()
      .describe(
        "The amount of token to stake (in human-readable value) like 1.5 core"
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

    console.log("transaction in makeStakeCoreTransaction", transaction);

    return transaction;
  },
});
