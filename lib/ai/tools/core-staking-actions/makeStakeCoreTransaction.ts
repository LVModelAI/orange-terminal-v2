import { CHAIN_ID } from "@/lib/constants";
import { ChatMessage } from "@/lib/types";
import { toWei } from "@/lib/utils";
import { UseChatHelpers } from "@ai-sdk/react";
import { tool } from "ai";
import z from "zod";
import { checkTokenBalance } from "@/lib/utils/checkTokenBalance";

export type StakeComponentProps = {
  candidateAddress: string; // validator operator address
  candidateName: string; // validator operator name
  humanReadableValue: string;
  valueInWei: string; // amount in wei
  chainId: number;
  error?: string;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
};

export const makeStakeCoreTransaction = tool({
  description: `Make a transaction object for staking CORE on the Core blockchain. Validate balance first. Ensure the user has enough CORE to stake plus at least 0.5 CORE left for gas. The chainId is ${CHAIN_ID} for the Core blockchain.`,
  inputSchema: z.object({
    candidateAddress: z.string().describe("The candidate (validator) address"),
    candidateName: z.string().describe("The candidate (validator) name"),
    value: z
      .string()
      .describe(
        "The amount of CORE to stake (in human-readable form, e.g. '1.5')"
      ),
    walletAddress: z.string().describe("User's wallet address"),
    chainId: z.number().default(CHAIN_ID),
  }),
  execute: async ({
    candidateAddress,
    candidateName,
    value,
    walletAddress,
    chainId,
  }) => {
    console.log("makeStakeCoreTransaction input:", {
      candidateAddress,
      candidateName,
      value,
      walletAddress,
      chainId,
    });

    // --- Step 1: Balance check ---
    const result = await checkTokenBalance(
      walletAddress,
      "core",
      "CORE",
      value
    );

    // --- Step 2: Handle insufficient or missing balance ---
    if (!result.ok) {
      return {
        candidateAddress,
        candidateName,
        humanReadableValue: value,
        valueInWei: toWei(value),
        chainId,
        error: result.error,
      };
    }

    // --- Step 3: Gas requirement ---
    if (result.balanceHuman - result.requested < 0.5) {
      return {
        candidateAddress,
        candidateName,
        humanReadableValue: value,
        valueInWei: toWei(value),
        chainId,
        error: `Not enough CORE left for gas: you would have ${
          result.balanceHuman - result.requested
        } CORE after staking, but need at least 0.5.`,
      };
    }

    // --- Step 4: Valid transaction ---
    const transaction = {
      candidateAddress,
      candidateName,
      humanReadableValue: value,
      valueInWei: toWei(value),
      chainId,
    };

    console.log("transaction in makeStakeCoreTransaction", transaction);
    return transaction;
  },
});
