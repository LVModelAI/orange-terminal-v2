import { tool } from "ai";
import { z } from "zod";

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
  raw.map((p) => ({
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
  }));

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

// ------------------- API URLs -------------------
const VALIDATORS_API =
  "https://staking-api.coredao.org/staking/status/validators";
const COLEND_API = "https://yields.llama.fi/pools";
const DESYN_API =
  "https://api.desyn.io/core/etf/stats?offset=0&num=10&period=DAY&sortby=BY_NET_VALUE&desc=true&etype=&invest_label=&risk_label=&pay_token=&strategy_type=&strategy_token_label=&etf_status=-1&pool_name=";
const PELL_API =
  "https://api.pell.network/v1/stakeListByPage?page=1&pageSize=20&params=1116";
/* 
 response : {
    "code": 1,
    "message": "success",
    "result": {
        "records": [
            {
                "chainId": 1116,
                "strategyAddress": "0x4282868539C7E22B9Bc9248fd7c8196cDaeeEF13",
                "stakeName": "coreBTC",
                "stakeIcon": "https://dchsaf64zopar.cloudfront.net/coins/corebtc.png",
                "currency": "coreBTC",
                "restakeAssetNumber": 0.032667900000000000,
                "tvl": 3785.218614310028455674000000000000000000000000000000,
                "rewards": [
                    {
                        "key": "Pell Points",
                        "value": "1.50X",
                        "type": 1
                    }
                ],
                "tagType": null,
                "chainType": 1
            },
            {
                "chainId": 1116,
                "strategyAddress": "0x6FF890b47ebaA297D1aa2AcE17f1e989462eB5fa",
                "stakeName": "SolvBTC.b",
                "stakeIcon": "https://dchsaf64zopar.cloudfront.net/coins/solvbtc.b.png",
                "currency": "SolvBTC.b",
                "restakeAssetNumber": 0.027026495186208722,
                "tvl": 3131.550930987227007809268215731320000000000000000000,
                "rewards": [
                    {
                        "key": "Pell Points",
                        "value": "1.25X",
                        "type": 1
                    },
                    {
                        "key": "Solv Points",
                        "value": "3XP",
                        "type": 2
                    }
                ],
                "tagType": null,
                "chainType": 1
            },
            {
                "chainId": 1116,
                "strategyAddress": "0x5F42E359cC166D79e0468F3439F952c115984286",
                "stakeName": "SolvBTC.m",
                "stakeIcon": "https://dchsaf64zopar.cloudfront.net/coins/solvbtc.m.png",
                "currency": "SolvBTC.m",
                "restakeAssetNumber": 0.008651708478430782,
                "tvl": 1002.470559115832035591075510894920000000000000000000,
                "rewards": [
                    {
                        "key": "Pell Points",
                        "value": "1.25X",
                        "type": 1
                    },
                    {
                        "key": "Solv Points",
                        "value": "3XP",
                        "type": 2
                    }
                ],
                "tagType": null,
                "chainType": 1
            },
            {
                "chainId": 1116,
                "strategyAddress": "0xe049552410c7a533dD1eaeDaE20b527a51d343E6",
                "stakeName": "aBTC",
                "stakeIcon": "https://dchsaf64zopar.cloudfront.net/coins/abtc.png",
                "currency": "aBTC",
                "restakeAssetNumber": 0.000975825080743373,
                "tvl": 113.068524757955117394624272974380000000000000000000,
                "rewards": [
                    {
                        "key": "Pell Points",
                        "value": "1.0X",
                        "type": 1
                    }
                ],
                "tagType": null,
                "chainType": 1
            },
            {
                "chainId": 1116,
                "strategyAddress": "0x25B737513fD2588f2b0Ffc8Dee06d2B999f7E595",
                "stakeName": "uBTC",
                "stakeIcon": "https://dchsaf64zopar.cloudfront.net/coins/btc.png",
                "currency": "uBTC",
                "restakeAssetNumber": 207.000500000000000000,
                "tvl": 23985078.495143031702030000000000000000000000000000000000,
                "rewards": [
                    {
                        "key": "Pell Points",
                        "value": "0X",
                        "type": 1
                    }
                ],
                "tagType": null,
                "chainType": 1
            },
            {
                "chainId": 1116,
                "strategyAddress": "0x4642De2853A9F9dB3080F51CdA267f1e9C900971",
                "stakeName": "oBTC",
                "stakeIcon": "https://dchsaf64zopar.cloudfront.net/coins/obtc.png",
                "currency": "oBTC",
                "restakeAssetNumber": 0.000150000000000000,
                "tvl": 17.380449681384609000000000000000000000000000000000,
                "rewards": [
                    {
                        "key": "Pell Points",
                        "value": "1.25X",
                        "type": 1
                    }
                ],
                "tagType": null,
                "chainType": 1
            },
            {
                "chainId": 1116,
                "strategyAddress": "0x93c76cc2b322E66C99ac482a6BAE9B34bF49F67e",
                "stakeName": "uBTC",
                "stakeIcon": "https://dchsaf64zopar.cloudfront.net/coins/btc.png",
                "currency": "uBTC",
                "restakeAssetNumber": 0.000101000000000000,
                "tvl": 11.702836118798970060000000000000000000000000000000,
                "rewards": [
                    {
                        "key": "Pell Points",
                        "value": "1.05X",
                        "type": 1
                    }
                ],
                "tagType": null,
                "chainType": 1
            },
            {
                "chainId": 1116,
                "strategyAddress": "0x57bF5B3492Fef24A4f883135CB2AAD27Ce227183",
                "stakeName": "suBTC",
                "stakeIcon": "https://dchsaf64zopar.cloudfront.net/coins/subtc.png",
                "currency": "suBTC",
                "restakeAssetNumber": 100.100342001000000000,
                "tvl": 11598593.048251805627451084060000000000000000000000000000,
                "rewards": [
                    {
                        "key": "Pell Points",
                        "value": "1.25X",
                        "type": 1
                    }
                ],
                "tagType": null,
                "chainType": 1
            },
            {
                "chainId": 1116,
                "strategyAddress": "0xAd92CEdF3A75611E369aBDA28f099F09802d2a5E",
                "stakeName": "stBTC",
                "stakeIcon": "https://dchsaf64zopar.cloudfront.net/coins/stbtc.png",
                "currency": "stBTC",
                "restakeAssetNumber": 0.000150000000000000,
                "tvl": 17.380449681384609000000000000000000000000000000000,
                "rewards": [
                    {
                        "key": "PellPoints",
                        "value": "1.15X",
                        "type": 1
                    }
                ],
                "tagType": null,
                "chainType": 1
            },
            {
                "chainId": 1116,
                "strategyAddress": "0x1F6b05eb565cb596952E991Db4614A29F80e7d71",
                "stakeName": "stCORE",
                "stakeIcon": "https://dchsaf64zopar.cloudfront.net/coins/stcore.png",
                "currency": "stCORE",
                "restakeAssetNumber": 7894.709541585211381941,
                "tvl": 7898.516772499998450904932808276912753800000000000000,
                "rewards": [
                    {
                        "key": "Pell Points",
                        "value": "1.50X",
                        "type": 1
                    }
                ],
                "tagType": null,
                "chainType": 1
            }
        ],
        "total": 10,
        "size": 20,
        "current": 1,
        "orders": [],
        "optimizeCountSql": true,
        "hitCount": false,
        "countId": null,
        "maxLimit": null,
        "searchCount": true,
        "pages": 1
    }
}
*/

// ------------------- Tool -------------------
export const getDefiProtocolsStats = tool({
  description:
    "Fetch validator stats from Core DAO, Colend protocol, and DeSyn protocol (raw + summary).",
  inputSchema: z.object({}),
  execute: async () => {
    console.log("Fetching DeFi stats (Core DAO + Colend + DeSyn)...");

    // --- Core DAO Validators ---
    let coreRaw: ValidatorResponse[] = [];
    let validatorsSummary: ValidatorSummary[] = [];
    try {
      const res = await fetch(VALIDATORS_API);
      if (res.ok) {
        const data = await res.json();
        coreRaw = data?.data?.validatorsList || [];
        console.log("coreRaw---- ", coreRaw);

        validatorsSummary = summarizeCoreDaoValidators(coreRaw);
        console.log("validatorsSummary---- ", validatorsSummary);
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
    console.log("res from pell --- ", pellSummary);
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
