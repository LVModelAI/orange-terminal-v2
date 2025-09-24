import {
  COLEND_API,
  DESYN_API,
  PELL_API,
  VALIDATORS_API,
  WCORE_TOKEN_ADDRESS,
  USDC_TOKEN_ADDRESS,
  USDT_TOKEN_ADDRESS,
  SOLVBTC_B_ADDRESS,
  SOLVBTC_M_ADDRESS,
  SOLVBTC_C_ADDRESS,
  STCORE_TOKEN_ADDRESS,
  DUALCORE_TOKEN_ADDRESS,
} from "@/lib/constants";
import { tool } from "ai";
import { z } from "zod";

const tokenAddressList = [
  { name: "CORE", address: "0x0000000000000000000000000000000000000000" },
  { name: "WCORE", address: WCORE_TOKEN_ADDRESS },
  { name: "USDC", address: USDC_TOKEN_ADDRESS },
  { name: "USDT", address: USDT_TOKEN_ADDRESS },
  { name: "SolvBTC.b", address: SOLVBTC_B_ADDRESS },
  { name: "SolvBTC.m", address: SOLVBTC_M_ADDRESS },
  { name: "SolvBTC.c", address: SOLVBTC_C_ADDRESS },
  { name: "stCORE", address: STCORE_TOKEN_ADDRESS },
  { name: "dualCORE", address: DUALCORE_TOKEN_ADDRESS },
];

// ------------------- Types -------------------

// Core DAO
type ValidatorResponse = {
  name: string;
  operatorAddress: string;
  status: number;
  stakedCoreAmount: string;
  stakedBTCAmount: string;
  stakedHashAmount: string;
  stakedCoreScore: string;
  realtimeCoreAmount: string;
  estimatedCoreRewardRate: string;
  estimatedBTCRewardRate: string;
  hybridScore: string;
};

type ValidatorSummary = {
  name: string;
  operatorAddress: string;
  stakedCORE: string;
  stakedBTC: string;
  coreRewardRate: string;
  btcRewardRate: string;
  hybridScore: string;
  coreScoreEfficiency: string;
  realtimeDeltaCORE_M: string;
  realtimeDeltaCOREPct: string;
};

// Colend
type ColendPoolRaw = {
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apyBase: number;
  apyReward: number;
  apy: number;
  pool: string;
  apyPct1D: number;
  apyPct7D: number;
  apyPct30D: number;
  stablecoin: boolean;
  ilRisk: string;
  exposure: string;
  predictions: {
    predictedClass: string;
    predictedProbability: number;
    binnedConfidence: number;
  };
  underlyingTokens: string[];
  [key: string]: any;
};

type ColendPoolSummary = {
  symbol: string;
  chain: string;
  project: string;
  tvlUsd: number;
  apy: number;
  apyReward: number;
  ilRisk: string;
};

// DeSyn
type DesynPoolRaw = {
  pool: string;
  controller: string;
  pool_name: string;
  net_value: number;
  net_value_per_share: number;
  net_value_change_ratio_by_period: number;
  APY: number;
  symbol: string;
  invest_label: string;
  strategy_token_label: string;
  risk_label: string;
  [key: string]: any;
  pay_token: string[];
  reward_en: boolean[];
  reward_cn: string[];
};

type DesynPoolSummary = {
  pool: string;
  pool_name: string;
  symbol: string;
  net_value: number;
  net_value_per_share: number;
  net_value_change_ratio_by_period: number;
  APY: number;
  invest_label: string;
  strategy_token_label: string;
  risk_label: string;
  pay_with_token: string[];
  reward_en: boolean[];
  reward_cn: string[];
};

type PellPoolRaw = {
  chainId: number;
  strategyAddress: string;
  stakeName: string;
  stakeIcon: string;
  currency: string;
  restakeAssetNumber: number;
  tvl: number;
  rewards: {
    key: string;
    value: string;
    type: number;
  }[];
  tagType: string;
  chainType: number;
};

type PellPoolSummary = {
  chainId: number;
  strategyAddress: string;
  stakeName: string;
  stakeIcon: string;
  currency: string;
  restakeAssetNumber: number;
  tvl: number;
  rewards: {
    key: string;
    value: string;
    type: number;
  }[];
  tagType: string;
  chainType: number;
};

// ------------------- Helpers -------------------
const toCore = (weiStr: string) => Number(weiStr || "0") / 1e18;
const toMillions = (core: number) => `${(core / 1_000_000).toFixed(2)}M`;
const pct = (x: number) => `${x.toFixed(2)}%`;
const safeDiv = (a: number, b: number) => (b === 0 ? 0 : a / b);

function summarizeCoreDaoValidators(
  coreRaw: ValidatorResponse[] = []
): ValidatorSummary[] {
  // Build with numeric fields for sorting, then map to display
  const enriched = coreRaw
    .filter((v) => v.status === 17) // active only
    .map((v) => {
      const coreAmt = toCore(v.stakedCoreAmount || "0"); // number
      const coreScore = toCore(v.stakedCoreScore || "0"); // number
      const rtCoreAmt = toCore(v.realtimeCoreAmount || "0"); // number
      const coreRewardRateNum = Number(v.estimatedCoreRewardRate || "0"); // e.g. 0.0558

      const scoreEff = coreAmt > 0 ? safeDiv(coreScore, coreAmt) : 0;
      const deltaCore = rtCoreAmt - coreAmt;
      const deltaPct = coreAmt > 0 ? safeDiv(deltaCore, coreAmt) * 100 : 0;

      const btcInUnits = Number(v.stakedBTCAmount || "0") / 1e8; // satoshis -> BTC

      return {
        // original
        v,
        // computed numeric for sorting and display
        _coreAmt: coreAmt,
        _coreRewardRate: coreRewardRateNum,
        summary: {
          name: v.name || "Unknown",
          operatorAddress: v.operatorAddress || "Unknown",
          stakedCORE: toMillions(coreAmt),
          stakedBTC: btcInUnits.toLocaleString(undefined, {
            maximumFractionDigits: 8,
          }),
          coreRewardRate: pct(coreRewardRateNum * 100),
          btcRewardRate: pct(Number(v.estimatedBTCRewardRate || "0") * 100),
          hybridScore: Number(v.hybridScore || "0").toLocaleString(),
          coreScoreEfficiency: `${scoreEff.toFixed(2)}x`,
          realtimeDeltaCORE_M: `${deltaCore >= 0 ? "+" : ""}${(
            deltaCore / 1_000_000
          ).toFixed(2)}M`,
          realtimeDeltaCOREPct: `${deltaPct >= 0 ? "+" : ""}${pct(deltaPct)}`,
        } as ValidatorSummary,
      };
    });

  // Sort: by CORE amount desc, then by core reward rate desc
  enriched.sort((a, b) => {
    if (b._coreAmt !== a._coreAmt) return b._coreAmt - a._coreAmt;
    return b._coreRewardRate - a._coreRewardRate;
  });

  // Return display objects
  return enriched.map((e) => e.summary);
}

const summarizeColend = (raw: ColendPoolRaw[]): ColendPoolSummary[] =>
  raw.map((p) => ({
    symbol: p.symbol,
    chain: p.chain,
    project: p.project,
    tvlUsd: p.tvlUsd,
    apy: p.apy,
    apyReward: p.apyReward,
    ilRisk: p.ilRisk,
  }));

const summarizeDesyn = (raw: DesynPoolRaw[]): DesynPoolSummary[] =>
  raw.map((p) => {
    const payWithTokens = (p.pay_token || []).map((addr) => {
      const match = tokenAddressList.find(
        (t) => t.address.toLowerCase() === addr.toLowerCase()
      );
      return match ? match.name : addr; // fallback to showing address
    });

    return {
      pool: p.pool,
      pool_name: p.pool_name,
      symbol: p.symbol,
      net_value: p.net_value,
      net_value_per_share: p.net_value_per_share,
      net_value_change_ratio_by_period: p.net_value_change_ratio_by_period,
      APY: p.APY,
      invest_label: p.invest_label,
      strategy_token_label: p.strategy_token_label,
      risk_label: p.risk_label,
      pay_with_token: payWithTokens,
      reward_en: p.reward_en,
      reward_cn: p.reward_cn,
    };
  });

const summarizePell = (raw: PellPoolRaw[]): PellPoolSummary[] => {
  //sort by tvl desc
  const sorted = raw.sort((a, b) => b.tvl - a.tvl);
  return sorted.map((p) => ({
    chainId: p.chainId,
    strategyAddress: p.strategyAddress,
    stakeName: p.stakeName,
    stakeIcon: p.stakeIcon,
    currency: p.currency,
    restakeAssetNumber: p.restakeAssetNumber,
    tvl: p.tvl,
    rewards: p.rewards,
    tagType: p.tagType,
    chainType: p.chainType,
  }));
};

// ------------------- Tool -------------------
export const getDefiProtocolsStats = tool({
  description:
    "Fetch validator stats from Core DAO, Colend protocol, and DeSyn protocol (raw + summary).",
  inputSchema: z.object({}),
  execute: async () => {
    console.log("Fetching DeFi stats (Core DAO + Colend + DeSyn + Pell)...");

    // --- Core DAO Validators ---
    let coreRaw: ValidatorResponse[] = [];
    let validatorsSummary: ValidatorSummary[] = [];
    try {
      const res = await fetch(VALIDATORS_API);
      if (res.ok) {
        const data = await res.json();
        coreRaw = data?.data?.validatorsList || [];
        // console.log("coreRaw---- ", coreRaw);

        validatorsSummary = summarizeCoreDaoValidators(coreRaw);
        // console.log("validatorsSummary---- ", validatorsSummary);
      }
    } catch (err) {
      console.error("Error fetching Core validators:", err);
    }

    // --- Colend Pools ---
    let colendRaw: ColendPoolRaw[] = [];
    let colendSummary: ColendPoolSummary[] = [];
    try {
      const res = await fetch(COLEND_API);
      if (res.ok) {
        const json = await res.json();
        colendRaw = Array.isArray(json?.data)
          ? json.data.filter(
              (item: any) =>
                item.chain?.toLowerCase() === "core" &&
                item.project === "colend-protocol"
            )
          : [];
        colendSummary = summarizeColend(colendRaw);
      }
    } catch (err) {
      console.error("Error fetching Colend stats:", err);
    }

    // --- DeSyn Pools ---
    let desynRaw: DesynPoolRaw[] = [];
    let desynSummary: DesynPoolSummary[] = [];
    try {
      const res = await fetch(DESYN_API);
      if (res.ok) {
        const json = await res.json();
        desynRaw = json?.data?.items || [];
        desynSummary = summarizeDesyn(desynRaw);
        console.log("desynSummary---- ", desynSummary);
      }
    } catch (err) {
      console.error("Error fetching DeSyn stats:", err);
    }

    // --- Pell Pools ---
    let pellRaw: PellPoolRaw[] = [];
    let pellSummary: PellPoolSummary[] = [];
    try {
      const res = await fetch(PELL_API);
      if (res.ok) {
        const json = await res.json();
        pellRaw = json?.result?.records || [];
        pellSummary = summarizePell(pellRaw);
      }
    } catch (err) {
      console.error("Error fetching Pell stats:", err);
    }

    // console.log("res from colend --- ", colendSummary);
    // console.log("res from pell --- ", pellSummary);
    // --- Return unified ---
    return {
      results: [
        {
          protocol: "core-dao-validators",
          summary: { validators: validatorsSummary },
        },
        {
          protocol: "colend",
          summary: { pools: colendSummary },
        },
        {
          protocol: "desyn",
          summary: { pools: desynSummary },
        },
        {
          protocol: "pell",
          summary: { pools: pellSummary },
        },
      ],
    };
  },
});
