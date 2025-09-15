import { PELL_API } from "@/lib/constants";
import { tool } from "ai";
import { z } from "zod";

type PellStrategyResponse = {
  chainId: number;
  strategyAddress: string;
  stakeName: string;
  currency: string;
  restakeAssetNumber: number;
  tvl: number;
  rewards: { key: string; value: string; type: number }[];
  tagType: string | null;
  chainType: number;
};

type PellStrategySummary = {
  strategyAddress: string;
  stakeName: string;
  currency: string; // staked asset symbol (BTC, CORE, etc.)
  restakeAsset: string; // formatted, e.g. "0.0327"
  tvlUSD: string; // formatted in USD, with commas
  rewards: { name: string; value: string }[]; // keeps reward names like Pell Points
};

export const getPellStrategies = tool({
  description:
    "Get Pell staking strategies (Core chain) with TVL (USD), restake amounts, and reward multipliers",
  inputSchema: z.object({}),
  execute: async () => {
    console.log("fetching Pell strategies ...");
    const apiUrl = PELL_API;

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();

    const formatNum = (n: number, decimals = 4) =>
      n.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals,
      });

    let records: PellStrategySummary[] =
      data?.result?.records?.map((r: PellStrategyResponse) => ({
        strategyAddress: r.strategyAddress,
        stakeName: r.stakeName,
        currency: r.currency,
        restakeAsset: formatNum(r.restakeAssetNumber),
        tvlUSD: formatNum(r.tvl, 2),
        rewards: r.rewards.map((rw) => ({
          name: rw.key,
          value: rw.value,
        })),
      })) || [];

    // Sort by TVL descending
    records = records.sort((a, b) => {
      const tvlA = Number((a.tvlUSD || "0").replace(/,/g, ""));
      const tvlB = Number((b.tvlUSD || "0").replace(/,/g, ""));
      return tvlB - tvlA;
    });

    console.log(records);

    return { pell_restaking_strategies: records };
  },
});
