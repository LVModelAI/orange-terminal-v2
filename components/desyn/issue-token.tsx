"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaSpinner, FaCheck, FaTimes } from "react-icons/fa";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { Address, erc20Abi, parseUnits } from "viem";
import { useAppKitAccount } from "@reown/appkit/react";
import Link from "next/link";
import { CheckCircleFillIcon } from "@/components/icons";
import { CHAIN_ID, CORESCAN_BASE_URL } from "@/lib/constants";

// ---- API response types ----
type PoolNetValueTsTokenEntry = {
  token: {
    address: `0x${string}`;
    decimals: number;
    name: string;
    symbol: string;
  };
  token_allocation_ratio: number;
  token_balance: number;
  token_net_value: number;
  token_price: number;
  token_price_change_ratio_by_period: number;
};

type PoolNetValueLatest = {
  pool: `0x${string}`;
  period: string;
  ts_in_seconds: number;
  net_value: number;
  net_value_per_share: number;
  total_shares: number;
  net_value_change_ratio_by_period: number;
  tvl_rate: number;
  tokens: PoolNetValueTsTokenEntry[];
};

type PoolNetValueTsResponse = {
  data: {
    latest: PoolNetValueLatest;
  };
};

type DesynPoolGetResponse = {
  err: { code: number; msg: string; msgDebug: string };
  data: {
    pool: {
      id: `0x${string}`;
      name: string;
      symbol: string;
      controller: `0x${string}`;
      crpController: `0x${string}`;
      tokensList: `0x${string}`[];
      reward_en: string;
    };
  };
};

type SwapInfoBase = {
  aggregator: Address;
  rebalanceAdapter: Address;
  swapType: number; // uint8
};

type SwapData = {
  quantity: bigint;
  data: `0x${string}`;
};

export type DesynIssueTokenTxProps = {
  poolAddress: `0x${string}`; // pool
  amount: string; // human-readable issueAmount in handle token
};

export type DesynIssueTokenProps = {
  tx: DesynIssueTokenTxProps;
  sendMessage: (msg: {
    role: "system" | "user" | "assistant";
    parts: { type: "text"; text: string }[];
  }) => void;
};

// Router contract that exposes autoJoinSmartPool
const DESYN_ROUTER_ADDRESS =
  "0x099d9d991ef4db37e4ad3308452c250097cadb7f" as Address;

const routerAbi = [
  {
    type: "function",
    name: "autoJoinSmartPool",
    stateMutability: "payable",
    inputs: [
      { name: "pool", type: "address" },
      { name: "kol", type: "address" },
      { name: "issueAmount", type: "uint256" },
      { name: "minPoolAmountOut", type: "uint256" },
      { name: "handleToken", type: "address" },
      {
        name: "swapBase",
        type: "tuple",
        components: [
          { name: "aggregator", type: "address" },
          { name: "rebalanceAdapter", type: "address" },
          { name: "swapType", type: "uint8" },
        ],
      },
      {
        name: "swapDatas",
        type: "tuple[]",
        components: [
          { name: "quantity", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
      },
    ],
    outputs: [],
  },
] as const;

type Phase =
  | "idle"
  | "awaiting_wallet"
  | "approving"
  | "approved"
  | "issuing"
  | "success"
  | "error";

const DEFAULT_KOL = "0x0000000000000000000000000000000000000000" as Address;

const DEFAULT_AGGREGATOR =
  "0x74f56a7560ef0c72cf6d677e3f5f51c2d579ff15" as Address;
const DEFAULT_REBALANCE_ADAPTER =
  "0x70a7e085717de64b555066e344bb7bbb262c1b6c" as Address;
const DEFAULT_SWAP_TYPE = 0;

const IssueTokenDesyn: React.FC<DesynIssueTokenProps> = ({
  tx,
  sendMessage,
}) => {
  const { isConnected, address: from } = useAppKitAccount();

  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>();
  const [issueHash, setIssueHash] = useState<`0x${string}` | undefined>();
  const [lastApproveHash, setLastApproveHash] = useState<
    `0x${string}` | undefined
  >();
  const [lastIssueHash, setLastIssueHash] = useState<
    `0x${string}` | undefined
  >();
  const [minOut, setMinOut] = useState<bigint | undefined>();
  const [poolName, setPoolName] = useState<string | undefined>();
  const [poolShareSymbol, setPoolShareSymbol] = useState<string | undefined>();
  const [tokenAddress, setTokenAddress] = useState<Address | undefined>();
  const [tokenDecimals, setTokenDecimals] = useState<number | undefined>();
  const [tokenSymbol, setTokenSymbol] = useState<string | undefined>();
  const [tokenName, setTokenName] = useState<string | undefined>();
  const [kolAddr, setKolAddr] = useState<Address | undefined>();
  const [controllerAddr, setControllerAddr] = useState<Address | undefined>();
  const [handleToken, setHandleToken] = useState<Address | undefined>();
  const [outWeiHuman, setOutWeiHuman] = useState<number | undefined>();
  const [rewards, setRewards] = useState<string | undefined>();
  const [outTokenName, setOutTokenName] = useState<string | undefined>();
  const [outTokenSymbol, setOutTokenSymbol] = useState<string | undefined>();

  const sentApproveRef = useRef(false);
  const sentIssueRef = useRef(false);

  // Fetch DeSyn pool info to compute minPoolAmountOut
  useEffect(() => {
    let aborted = false;
    const fetchPool = async () => {
      if (!tx.poolAddress || !tx.amount) return;
      try {
        const res = await fetch(
          `https://api.desyn.io/core/etf/pool_net_value_ts_seq/${tx.poolAddress}?period=DAY`
        );
        const json = (await res.json()) as PoolNetValueTsResponse;
        const latest_data = json?.data?.latest;
        if (!latest_data) return;
        // latest_data is like
        /* 
        {
  "pool": "0x9368c6A5a3bf6945C2567C524C4461adD26268DA",
  "period": "HOUR",
  "ts_in_seconds": 1758649320,
  "net_value": 3502180.587530172,
  "net_value_per_share": 0.010005010004884485,
  "total_shares": 350042687.1957543,
  "net_value_change_ratio_by_period": -0.0001998600979315,
  "tvl_rate": -0.0001998600979314,
  "tokens": [
    {
      "token": {
        "address": "0x900101d06A7426441Ae63e9AB3B9b0F63Be145F1",
        "decimals": 6,
        "name": "Tether USD",
        "symbol": "USDT"
      },
      "token_allocation_ratio": 1,
      "token_balance": 3500430.372344,
      "token_net_value": 3502180.587530172,
      "token_price": 1.0005,
      "token_price_change_ratio_by_period": -0.000199860097931426
    }
  ]
}
  */
        const firstToken = latest_data.tokens?.[0]?.token as
          | {
              address: `0x${string}`;
              decimals: number;
              name: string;
              symbol: string;
            }
          | undefined;
        if (firstToken?.address) setTokenAddress(firstToken.address as Address);
        if (typeof firstToken?.decimals === "number")
          setTokenDecimals(firstToken.decimals);
        if (firstToken?.symbol) setTokenSymbol(firstToken.symbol);
        if (firstToken?.name) setTokenName(firstToken.name);
        // minPoolAmountOut = issueAmount(human) / netValuePerShare
        const amtNumber = Number(tx.amount);
        if (!(amtNumber > 0)) return;
        const outHuman = amtNumber / Number(latest_data.net_value_per_share);
        // Pool share tokens appear to have 18 decimals typically; use 18 unless API indicates otherwise
        console.log("outHuman", outHuman);
        const outWei = parseUnits(String(outHuman), 18);
        const outWeiWithSlippage = (outWei * 995n) / 1000n;
        console.log("outWeiWithSlippage", outWeiWithSlippage);
        setOutWeiHuman(outHuman);

        if (!aborted) {
          setMinOut(outWeiWithSlippage);
        }
      } catch (e) {
        console.error("Failed to fetch DeSyn pool data", e);
      }
    };
    void fetchPool();
    return () => {
      aborted = true;
    };
  }, [tx.poolAddress, tx.amount]);

  // fetch controller and handle token address
  useEffect(() => {
    if (!tx.poolAddress) return;
    const fetchPool = async () => {
      const res = await fetch(
        `https://api.desyn.io/core/api/v1/chaindata/pool/get?pool_id=${tx.poolAddress}`
      );
      const json = (await res.json()) as DesynPoolGetResponse;
      /* json is like 
      {
  "err": {
    "code": 0,
    "msg": "Success",
    "msgDebug": ""
  },
  "data": {
    "pool": {
      "id": "0x9368c6A5a3bf6945C2567C524C4461adD26268DA",
      "name": "USDT Basis Trading Fund",
      "symbol": "USDBX",
      "controller": "0x4d22c0D3459CC20e6726E567Fae000792DBe7Df2",
      "crpController": "0xE1e91bE218232d479972e59Aa438a2BDa5c43425",
      "upperCap": "115792089237316195423570985008687907853269984665640564039457584007913129639935",
      "floorCap": "0",
      "swapFee": "0.000001",
      "crp": true,
      "managerFee": "0",
      "totalWeight": "25",
      "totalSwapVolume": "0",
      "totalSwapFee": "0",
      "totalShares": "350042697.19574429676366531",
      "createTime": 1731582718,
      "joinsCount": 0,
      "exitsCount": 0,
      "liquidity": "0",
      "swapsCount": 0,
      "holdersCount": 0,
      "etype": "0",
      "issueFee": "0",
      "redeemFee": "0",
      "perfermanceFee": "300000000000000000",
      "tx": "0x077cce36452f219a5f664b10fc1a7324e02085f6baafefa7247e47096acd4419",
      "tokensList": [
        "0x900101d06A7426441Ae63e9AB3B9b0F63Be145F1"
      ],
      "tokenWhiteLists": [
        {
          "id": "0x9368c6A5a3bf6945C2567C524C4461adD26268DA-0x900101d06A7426441Ae63e9AB3B9b0F63Be145F1",
          "token": "0x900101d06A7426441Ae63e9AB3B9b0F63Be145F1",
          "sort": "0",
          "spender": "0x4d22c0D3459CC20e6726E567Fae000792DBe7Df2",
          "caller": "0x7F7E7937010d98f8A09C3D7D63200Ab20c507B16"
        }
      ],
      "investorLists": [],
      "tokens": [
        {
          "id": "0x9368c6A5a3bf6945C2567C524C4461adD26268DA-0x900101d06A7426441Ae63e9AB3B9b0F63Be145F1",
          "address": "0x900101d06A7426441Ae63e9AB3B9b0F63Be145F1",
          "balance": "3500430.472344",
          "decimals": 6,
          "symbol": "USDT",
          "denormWeight": "25",
          "price": "1.0004",
          "netValue": "3501830.644533",
          "netValueRatio": "100",
          "latestRebalancedInfo": null
        }
      ],
      "swaps": [],
      "rights": [
        "canTokenWhiteLists"
      ],
      "collectEndTime": "0",
      "closureEndTime": "0",
      "isExistDTBT": false,
      "fundImage": "https://api.desyn.io/file/pic/0024d1d5a65a62181c5b6bc096b3507e.png",
      "collectInfo": {
        "fundRaisingTokenMax": "",
        "fundRaisingTokenMin": "",
        "fundRaisingRemaining": "",
        "fundRaisingRatio": "",
        "fundRaisedToken": ""
      },
      "createdWalletAddr": "0x7F7E7937010d98f8A09C3D7D63200Ab20c507B16",
      "isCompletedCollect": false,
      "netValuePerShare": "0.010004",
      "totalNetValue": "3501830.644533",
      "etfTypes": [1, 4],
      "etfStatus": 3,
      "can_active4626": 0,
      "canSubscribe": true,
      "canRedeem": true,
      "isProxyVersion": false,
      "canGeneralSubscribe": false,
      "canSmartSubscribe": true,
      "IsOpenSTBT": false,
      "erc4626Vault": {
        "address": "",
        "symbol": "",
        "name": ""
      },
      "erc4626Asset": "",
      "redeem_day": 0,
      "points_type": 3,
      "profit_symbol": "USDT",
      "reward_en": "1 x DeSyn Points,7x Core Points"
    }
  }
} 
*/
      const ctrl = json?.data?.pool?.controller as `0x${string}` | undefined;
      const token0 = json?.data?.pool?.tokensList?.[0] as
        | `0x${string}`
        | undefined;
      const outTokenName = json?.data?.pool?.name;
      const outTokenSymbol = json?.data?.pool?.symbol;
      const reward_en = json?.data?.pool?.reward_en;
      if (ctrl) {
        setKolAddr(ctrl as Address);
        setControllerAddr(ctrl as Address);
      }
      if (token0) {
        setHandleToken(token0 as Address);
      }
      if (outTokenName) {
        setOutTokenName(outTokenName);
        setPoolName(outTokenName);
      }
      if (outTokenSymbol) {
        setOutTokenSymbol(outTokenSymbol);
        setPoolShareSymbol(outTokenSymbol);
      }
      if (reward_en) {
        setRewards(reward_en);
      }
    };
    void fetchPool();
  }, [tx.poolAddress]);

  const parsedIssueAmount = useMemo(() => {
    try {
      if (!tx.amount || typeof tokenDecimals !== "number") return undefined;
      return parseUnits(tx.amount, tokenDecimals);
    } catch {
      return undefined;
    }
  }, [tx.amount, tokenDecimals]);

  const {
    writeContract,
    data: writeHash,
    isPending: isSending,
    error: sendError,
  } = useWriteContract();

  const approveWait = useWaitForTransactionReceipt({
    hash: approveHash,
    chainId: CHAIN_ID,
    confirmations: 1,
    query: { enabled: !!approveHash },
  });

  const issueWait = useWaitForTransactionReceipt({
    hash: issueHash,
    chainId: CHAIN_ID,
    confirmations: 1,
    query: { enabled: !!issueHash },
  });

  // Route hashes into correct buckets based on phase
  useEffect(() => {
    if (!writeHash) return;
    if (phase === "awaiting_wallet" || phase === "approving")
      setApproveHash(writeHash);
    if (phase === "issuing") setIssueHash(writeHash);
  }, [writeHash, phase]);

  // Handle write errors
  useEffect(() => {
    if (!sendError) return;
    const msg = (sendError as any)?.message || "Transaction error";
    if (msg.includes("User rejected")) {
      setErrorMsg("User rejected the request");
      setPhase("error");
      sendMessage({
        role: "system",
        parts: [{ type: "text", text: "User cancelled the transaction." }],
      });
    } else {
      console.error("[Desyn] tx error:", sendError);
      setErrorMsg(msg);
      setPhase("error");
    }
  }, [sendError, sendMessage]);

  // When approve confirms, advance
  useEffect(() => {
    if (!approveHash) return;
    if (approveWait.isError) {
      setErrorMsg("Approve failed or reverted");
      setPhase("error");
      return;
    }
    if (approveWait.isSuccess) {
      setLastApproveHash(approveHash);
      setPhase("approved");
      if (!sentApproveRef.current) {
        sentApproveRef.current = true;
      }
    }
  }, [approveHash, approveWait.isError, approveWait.isSuccess]);

  // After approved, call autoJoinSmartPool
  useEffect(() => {
    const doIssue = async () => {
      if (phase !== "approved") return;
      if (
        !parsedIssueAmount ||
        !from ||
        !minOut ||
        !handleToken ||
        !kolAddr ||
        !controllerAddr
      ) {
        setErrorMsg("Missing parsed amount, sender, or minOut");
        setPhase("error");
        return;
      }
      try {
        setPhase("issuing");
        const swapBase: SwapInfoBase = {
          aggregator: DEFAULT_AGGREGATOR as Address,
          rebalanceAdapter: DEFAULT_REBALANCE_ADAPTER as Address,
          swapType: DEFAULT_SWAP_TYPE,
        };
        const swapDatas: SwapData[] = [
          {
            quantity: parsedIssueAmount,
            data: "0x",
          },
        ];
        console.log("[Desyn issue args]", {
          controllerAddr,
          kolAddr,
          parsedIssueAmount,
          minOut,
          handleToken,
          swapBase,
          swapDatas,
        });
        await writeContract({
          address: DESYN_ROUTER_ADDRESS,
          abi: routerAbi,
          functionName: "autoJoinSmartPool",
          args: [
            controllerAddr,
            kolAddr,
            parsedIssueAmount,
            minOut,
            handleToken as Address,
            swapBase,
            swapDatas,
          ],
          chainId: CHAIN_ID,
          account: from as Address,
          value: 0n, // payable, but using ERC20 so no native value
        });
      } catch (e: any) {
        console.error("[Desyn autoJoinSmartPool] error:", e);
        setErrorMsg(e?.message || "Issue failed");
        setPhase("error");
      }
    };
    void doIssue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // On issue confirmed
  useEffect(() => {
    if (!issueHash) return;
    if (issueWait.isError) {
      setErrorMsg("Issue failed or reverted");
      setPhase("error");
      return;
    }
    if (issueWait.isSuccess) {
      setLastIssueHash(issueHash);
      setPhase("success");
      if (!sentIssueRef.current) {
        sentIssueRef.current = true;
        sendMessage({
          role: "system",
          parts: [
            {
              type: "text",
              text: `Issued ${tx.amount} ${tokenSymbol ?? "TOKEN"} into pool ${
                poolName ?? poolShareSymbol ?? "POOL"
              }`,
            },
          ],
        });
      }
    }
  }, [
    issueHash,
    issueWait.isError,
    issueWait.isSuccess,
    tx.amount,
    tokenSymbol,
    poolName,
    poolShareSymbol,
    sendMessage,
  ]);

  const handleIssueFlow = async () => {
    setErrorMsg("");
    sentApproveRef.current = false;
    sentIssueRef.current = false;

    if (!isConnected || !from) return setErrorMsg("Connect your wallet first");
    if (typeof tokenDecimals !== "number")
      return setErrorMsg("Could not fetch token decimals");
    if (!parsedIssueAmount)
      return setErrorMsg("Invalid amount for token decimals");
    if (!handleToken)
      return setErrorMsg("Handle token address not resolved yet");
    // Approval skipped for now

    try {
      setPhase("awaiting_wallet");
      console.log("[Desyn approve]", {
        token: handleToken,
        spender: DESYN_ROUTER_ADDRESS,
        amountWei: parsedIssueAmount.toString(),
        chainId: CHAIN_ID,
        account: from,
      });
      await writeContract({
        address: handleToken,
        abi: erc20Abi,
        functionName: "approve",
        args: [DESYN_ROUTER_ADDRESS, parsedIssueAmount],
        chainId: CHAIN_ID,
        account: from as Address,
      });
      setPhase("approving");
    } catch (e: any) {
      console.error("[approve] error:", e);
      setErrorMsg(e?.message || "Approve failed");
      setPhase("error");
    }
  };

  const isAwaitingApproval =
    phase === "awaiting_wallet" || phase === "approving";

  const isButtonDisabled =
    isSending || phase === "issuing" || phase === "success";

  function ButtonContent() {
    if (isAwaitingApproval) {
      return (
        <>
          <FaSpinner className="animate-spin" />
          Approving...
        </>
      );
    }
    if (phase === "issuing") {
      return (
        <>
          <FaSpinner className="animate-spin" />
          Issuing...
        </>
      );
    }
    if (phase === "success") {
      return (
        <>
          <FaCheck />
          Issued
        </>
      );
    }
    if (phase === "error") {
      return (
        <>
          <FaTimes />
          Retry
        </>
      );
    }
    return <>Issue</>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-zinc-900 text-white p-4 rounded-2xl shadow-md w-full border border-zinc-700 max-w-lg">
        <h2 className="text-xl font-semibold mb-4">DeSyn Issue Token</h2>

        <div className="text-sm grid grid-cols-2 gap-y-2 mb-4">
          <span className="text-gray-400">Pool</span>
          <span className="text-right break-all">
            {poolName ?? tx.poolAddress}
          </span>
          <span className="text-gray-400">Handle Token</span>
          <span className="text-right break-all">
            {tokenName ?? tokenAddress}
          </span>
          <span className="text-gray-400">Amount</span>
          <span className="text-right">
            {tx.amount} {tokenSymbol ?? ""}
          </span>
          <span className="text-gray-400">Estimated Shares Out</span>
          <span className="text-right">
            {outWeiHuman !== undefined
              ? `${outWeiHuman} ${poolShareSymbol ?? ""}`
              : "..."}
          </span>
          {/* rewards */}
          <span className="text-gray-400">Rewards</span>
          <span className="text-right">{rewards}</span>
        </div>

        {errorMsg && (
          <div className="text-red-400 text-sm mb-2">{errorMsg}</div>
        )}

        <button
          disabled={isButtonDisabled}
          onClick={handleIssueFlow}
          className="mt-2 flex items-center justify-center gap-2 bg-white text-black py-2 px-4 rounded-md font-medium hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed w-full h-10"
        >
          <ButtonContent />
        </button>

        <div className="text-xs text-gray-400 mt-3 space-y-1">
          {lastApproveHash && (
            <div>
              Approve tx:{" "}
              <Link
                href={`${CORESCAN_BASE_URL}/tx/${lastApproveHash}`}
                target="_blank"
                className="underline text-blue-500"
              >
                {lastApproveHash}
              </Link>
            </div>
          )}
          {lastIssueHash && (
            <div>
              Issue tx:{" "}
              <Link
                href={`${CORESCAN_BASE_URL}/tx/${lastIssueHash}`}
                target="_blank"
                className="underline text-blue-500"
              >
                {lastIssueHash}
              </Link>
            </div>
          )}
          <div>Phase: {phase}</div>
        </div>
      </div>

      {phase === "success" && issueWait.data?.status === "success" && (
        <div className="bg-zinc-800 rounded-xl p-6 mt-6 flex flex-col items-center text-center border border-green-500 max-w-lg">
          <div className="text-green-500 mb-3">
            <CheckCircleFillIcon size={40} />
          </div>
          <h3 className="text-xl font-semibold mb-2">
            Successfully issued {tx.amount} {tokenSymbol ?? ""}
          </h3>
          <p className="text-gray-500 text-sm">
            Into pool {poolName ?? poolShareSymbol ?? tx.poolAddress}
          </p>
          {lastIssueHash && (
            <p className="mt-2">
              <Link
                href={`${CORESCAN_BASE_URL}/tx/${lastIssueHash}`}
                target="_blank"
                className="underline text-blue-600 text-sm"
              >
                View on CoreScan
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default IssueTokenDesyn;
