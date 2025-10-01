// desynIssueToken.ts
import { tool } from "ai";
import z from "zod";
import { UseChatHelpers } from "@ai-sdk/react";
import type { ChatMessage } from "@/lib/types";
import { Address, parseUnits } from "viem";

export type DesynIssueTokenTxProps = {
  poolAddress: `0x${string}`;
  amount: string; // human-readable

  // supplied externally instead of fetching
  tokenAddress: Address;
  tokenDecimals: number;
  tokenSymbol: string;
  tokenName: string;

  controllerAddr: Address;
  kolAddr?: Address;

  poolName: string;
  poolShareSymbol: string;
  rewards?: string;

  // computed outside (latest net value per share, with slippage applied)
  minOutStr: string;
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

    // ---------- 1. Fetch pool net value ----------
    const netRes = await fetch(
      `https://api.desyn.io/core/etf/pool_net_value_ts_seq/${poolAddress}?period=DAY`
    );
    const netJson = await netRes.json();
    const latest = netJson?.data?.latest;
    if (!latest) throw new Error("Failed to fetch pool net value info");

    const firstToken = latest.tokens?.[0]?.token;
    if (!firstToken) throw new Error("No token info in pool");

    const tokenAddress = firstToken.address as Address;
    const tokenDecimals = firstToken.decimals;
    const tokenSymbol = firstToken.symbol;
    const tokenName = firstToken.name;

    // compute minOut
    const amtNumber = Number(amount);
    if (!(amtNumber > 0)) throw new Error("Invalid amount");
    const outHuman = amtNumber / Number(latest.net_value_per_share);
    const outWei = parseUnits(String(outHuman.toFixed(6)), 18); // pool shares 18 decimals
    const minOut = (outWei * 995n) / 1000n; // 0.5% slippage

    // ---------- 2. Fetch pool info ----------
    const poolRes = await fetch(
      `https://api.desyn.io/core/api/v1/chaindata/pool/get?pool_id=${poolAddress}`
    );
    const poolJson = await poolRes.json();
    const poolData = poolJson?.data?.pool;
    if (!poolData) throw new Error("Failed to fetch pool details");

    const controllerAddr = poolData.controller as Address;
    const kolAddr = (poolData.controller as Address) ?? undefined;
    const poolName = poolData.name;
    const poolShareSymbol = poolData.symbol;
    const rewards = poolData.reward_en;

    console.log("--------------------------------");

    console.log("poolAddress", poolAddress);
    console.log("amount", amount);
    console.log("tokenAddress", tokenAddress);
    console.log("tokenDecimals", tokenDecimals);
    console.log("tokenSymbol", tokenSymbol);
    console.log("tokenName", tokenName);
    console.log("controllerAddr", controllerAddr);
    console.log("kolAddr", kolAddr);
    console.log("poolName", poolName);
    console.log("poolShareSymbol", poolShareSymbol);
    console.log("rewards", rewards);
    console.log("minOut", minOut);
    console.log("--------------------------------");

    return {
      poolAddress: poolAddress as `0x${string}`,
      amount,
      tokenAddress,
      tokenDecimals,
      tokenSymbol,
      tokenName,
      controllerAddr,
      kolAddr,
      poolName,
      poolShareSymbol,
      rewards,
      minOutStr: minOut.toString(),
    };
  },
});
