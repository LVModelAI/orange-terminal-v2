// PellWithdrawErc20.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaSpinner, FaCheck, FaTimes } from "react-icons/fa";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContracts,
} from "wagmi";
import { Address } from "viem";
import { useAppKitAccount } from "@reown/appkit/react";
import Link from "next/link";
import { CheckCircleFillIcon } from "@/components/icons";
import {
  CHAIN_ID,
  CORESCAN_BASE_URL,
  PELL_WITHDRAWALS_BASE_API,
  PELL_WITHDRAWALS_CONTRACT,
} from "@/lib/constants";
import { PellWithdrawErc20Props } from "@/lib/ai/tools/pell-restaking-actions/pellWithdrawErc20";

// ABI fragment for completeQueuedWithdrawals
const pellWithdrawalsAbi = [
  {
    type: "function",
    name: "completeQueuedWithdrawals",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "withdrawals",
        type: "tuple[]",
        components: [
          { name: "staker", internalType: "address", type: "address" },
          { name: "delegatedTo", internalType: "address", type: "address" },
          { name: "withdrawer", internalType: "address", type: "address" },
          { name: "nonce", internalType: "uint256", type: "uint256" },
          { name: "startTimestamp", internalType: "uint32", type: "uint32" },
          { name: "strategies", internalType: "address[]", type: "address[]" },
          { name: "shares", internalType: "uint256[]", type: "uint256[]" },
        ],
      },
      { name: "tokens", internalType: "address[][]", type: "address[][]" },
      {
        name: "middlewareTimesIndexes",
        internalType: "uint256[]",
        type: "uint256[]",
      },
      { name: "receiveAsTokens", internalType: "bool[]", type: "bool[]" },
    ],
    outputs: [],
  },
] as const;

const erc20MetaAbi = [
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
] as const;

type Phase = "idle" | "awaiting_wallet" | "withdrawing" | "success" | "error";

type PellQueuedWithdrawal = {
  id: number;
  chainId: number;
  stakeId: string;
  withdrawalQueuedHash: string;
  withdrawalCompletedHash: string;
  withdrawalRoot: string;
  staker: string;
  delegatedTo: string;
  withdrawer: string;
  nonce: number;
  startTime: number;
  strategies: string;
  shares: string;
  status: number;
};

const PellWithdrawErc20: React.FC<PellWithdrawErc20Props> = ({
  tx,
  sendMessage,
}) => {
  const { isConnected, address: from } = useAppKitAccount();

  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [withdrawHash, setWithdrawHash] = useState<`0x${string}` | undefined>();
  const [lastWithdrawHash, setLastWithdrawHash] = useState<
    `0x${string}` | undefined
  >();
  const sentRef = useRef(false);

  // Strategy and token come from tool output (string addresses)
  const strategyAddress = (tx as any).strategy
    ? ((tx as any).strategy as `0x${string}`)
    : (tx as any).withdrawal?.strategies;
  const tokenAddress = (tx as any).tokenAddress as `0x${string}` | undefined;

  const { data: metaData } = useReadContracts({
    allowFailure: true,
    contracts: [
      {
        address: tokenAddress,
        chainId: CHAIN_ID,
        abi: erc20MetaAbi,
        functionName: "decimals",
      },
      {
        address: tokenAddress,
        chainId: CHAIN_ID,
        abi: erc20MetaAbi,
        functionName: "symbol",
      },
    ],
    query: { enabled: !!tokenAddress },
  });

  const tokenDecimals: number | undefined = useMemo(() => {
    const v = metaData?.[0]?.result;
    return typeof v === "number" ? v : undefined;
  }, [metaData]);

  const tokenSymbol: string | undefined = useMemo(() => {
    const v = metaData?.[1]?.result;
    return typeof v === "string" ? v : undefined;
  }, [metaData]);

  const [queued, setQueued] = useState<PellQueuedWithdrawal[]>([]);
  const [amount, setAmount] = useState<number>(0);

  // Fetch queued withdrawals for this wallet and strategy
  useEffect(() => {
    const doFetch = async () => {
      try {
        if (!isConnected || !from || !strategyAddress) return;
        const url = `${PELL_WITHDRAWALS_BASE_API}?chainId=${CHAIN_ID}&strategyAddress=${strategyAddress}&address=${from}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as {
          code: number;
          message: string;
          result: PellQueuedWithdrawal[];
        };
        if (json.code !== 1) throw new Error(json.message || "API error");
        // filter the array by startime before 7 days from now
        const sevenDaysBeforeNow = Date.now() / 1000 - 7 * 24 * 60 * 60;
        const available = (json.result || []).filter(
          (r) => r.startTime < sevenDaysBeforeNow
        );
        const amount = available.reduce((acc, r) => acc + Number(r.shares), 0);
        //parse to human readable
        const amountHuman = amount / 10 ** (tokenDecimals ?? 18);
        setAmount(amountHuman);
        console.log("available to withdraw", available);
        setQueued(available);
      } catch (e: any) {
        console.error("[Pell queued withdrawals] fetch error:", e);
        setErrorMsg(e?.message || "Failed to fetch queued withdrawals");
      }
    };
    void doFetch();
  }, [isConnected, from, strategyAddress]);

  // Build args from queued list
  const withdrawalsArg = useMemo(() => {
    if (!from) return [];
    return queued.map((q) => ({
      staker: q.staker as Address,
      delegatedTo: q.delegatedTo as Address,
      withdrawer: q.withdrawer as Address,
      nonce: BigInt(q.nonce),
      startTimestamp: q.startTime,
      strategies: [q.strategies as Address],
      shares: [BigInt(q.shares)],
    }));
  }, [queued, from]);
  // console.log("withdrawalsArg", withdrawalsArg);

  const tokensArg = useMemo(() => {
    return queued.map(() => [tokenAddress as Address]);
  }, [queued, tokenAddress]);
  // console.log("tokensArg", tokensArg);

  const middlewareTimesIndexesArg = useMemo(() => {
    return queued.map(() => BigInt(0));
  }, [queued]);
  // console.log("middlewareTimesIndexesArg", middlewareTimesIndexesArg);
  // console.log("queued", queued);

  const {
    writeContract,
    data: writeHash,
    isPending: isSending,
    error: sendError,
  } = useWriteContract();

  const withdrawWait = useWaitForTransactionReceipt({
    hash: withdrawHash,
    chainId: CHAIN_ID,
    confirmations: 1,
    query: { enabled: !!withdrawHash },
  });

  useEffect(() => {
    if (!writeHash) return;
    if (phase === "awaiting_wallet" || phase === "withdrawing") {
      setWithdrawHash(writeHash);
    }
  }, [writeHash, phase]);

  useEffect(() => {
    if (!sendError) return;
    const msg = (sendError as any)?.message || "Transaction error";
    if (msg.includes("User rejected the request")) {
      setErrorMsg("User rejected the request");
      setPhase("error");
      sendMessage({
        role: "system",
        parts: [{ type: "text", text: "User cancelled the transaction." }],
      });
    } else {
      console.error("[completeQueuedWithdrawals] error:", sendError);
      setErrorMsg(msg);
      setPhase("error");
    }
  }, [sendError, sendMessage]);

  const handleWithdrawFlow = async () => {
    setErrorMsg("");
    sentRef.current = false;

    if (!isConnected || !from) return setErrorMsg("Connect your wallet first");

    // Basic presence checks
    if (!strategyAddress) return setErrorMsg("Strategy missing");
    if (!tokenAddress) return setErrorMsg("Token missing");
    if (!queued.length) return setErrorMsg("No withdrawals to complete");

    try {
      setPhase("awaiting_wallet");
      await writeContract({
        address: PELL_WITHDRAWALS_CONTRACT,
        abi: pellWithdrawalsAbi,
        functionName: "completeQueuedWithdrawals",
        args: [
          withdrawalsArg,
          tokensArg,
          middlewareTimesIndexesArg,
          queued.map(() => true),
        ],
        chainId: CHAIN_ID,
        account: from as Address,
      });
      setPhase("withdrawing");
    } catch (e: any) {
      console.error("[completeQueuedWithdrawals] send error:", e);
      setErrorMsg(e?.message || "Withdraw failed");
      setPhase("error");
    }
  };

  useEffect(() => {
    if (!withdrawHash) return;
    if (withdrawWait.isError) {
      setErrorMsg("Withdraw failed or reverted");
      setPhase("error");
      return;
    }
    if (withdrawWait.isSuccess) {
      setLastWithdrawHash(withdrawHash);
      setPhase("success");
      if (!sentRef.current) {
        sentRef.current = true;
        sendMessage({
          role: "system",
          parts: [
            {
              type: "text",
              text: `Pell withdrawal completed. ${amount} ${tokenSymbol} have been claimed to your wallet.`,
            },
          ],
        });
      }
    }
  }, [withdrawHash, withdrawWait.isError, withdrawWait.isSuccess, sendMessage]);

  const isAwaitingWithdraw =
    phase === "withdrawing" ||
    (!!withdrawHash && !withdrawWait.isSuccess && !withdrawWait.isError);

  const isButtonDisabled =
    isSending || phase === "withdrawing" || phase === "success";

  function ButtonContent() {
    if (phase === "awaiting_wallet" || isAwaitingWithdraw) {
      return (
        <>
          <FaSpinner className="animate-spin" />
          Withdrawing...
        </>
      );
    }
    if (phase === "success") {
      return (
        <>
          <FaCheck />
          Withdrawn
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
    return <>Withdraw Available Tokens</>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-zinc-900 text-white p-4 rounded-2xl shadow-md w-full border border-zinc-700 max-w-lg">
        <h2 className="text-xl font-semibold mb-4">Pell Withdraw</h2>

        {/* Summary rows */}
        <div className="text-sm grid grid-cols-2 gap-y-2 mb-4">
          <span className="text-gray-400">Token</span>
          <span className="text-right break-all">
            {tokenSymbol ?? "..."}{" "}
            {/* <span className="text-gray-500">
              ({(tokenAddress ?? "") as string})
            </span> */}
          </span>
          {/* 
          <span className="text-gray-400">Strategy</span>
          <span className="text-right break-all">
            {Array.isArray(strategyAddress)
              ? (strategyAddress[0] as string)
              : ((strategyAddress ?? "") as string)}
          </span> */}

          <span className="text-gray-400">Amount</span>
          <span className="text-right">
            {amount} {tokenSymbol ?? ""}
          </span>
        </div>

        {errorMsg && (
          <div className="text-red-400 text-sm mb-2">{errorMsg}</div>
        )}

        <button
          disabled={isButtonDisabled}
          onClick={handleWithdrawFlow}
          className="mt-2 flex items-center justify-center gap-2 bg-white text-black py-2 px-4 rounded-md font-medium hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed w-full h-10"
        >
          <ButtonContent />
        </button>

        <div className="text-xs text-gray-400 mt-3 space-y-1">
          {lastWithdrawHash && (
            <div>
              Tx:{" "}
              <Link
                href={`${CORESCAN_BASE_URL}/tx/${lastWithdrawHash}`}
                target="_blank"
                className="underline text-blue-500"
              >
                {lastWithdrawHash}
              </Link>
            </div>
          )}
          <div>Phase: {phase}</div>
        </div>
      </div>

      {phase === "success" && withdrawWait.data?.status === "success" && (
        <div className="bg-zinc-800 rounded-xl p-6 mt-6 flex flex-col items-center text-center border border-green-500 max-w-lg">
          <div className="text-green-500 mb-3">
            <CheckCircleFillIcon size={40} />
          </div>
          <h3 className="text-xl font-semibold mb-2">Withdrawal Completed</h3>
          <p className="text-gray-500 text-sm">
            Your queued withdrawal has been completed and tokens received in
            your wallet.
          </p>
          {lastWithdrawHash && (
            <p className="mt-2">
              <Link
                href={`${CORESCAN_BASE_URL}/tx/${lastWithdrawHash}`}
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

export default PellWithdrawErc20;
