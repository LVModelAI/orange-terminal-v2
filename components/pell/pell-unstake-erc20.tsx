// PellUnstakeErc20.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaSpinner, FaCheck, FaTimes } from "react-icons/fa";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContracts,
} from "wagmi";
import { Address, parseUnits } from "viem";
import { useAppKitAccount } from "@reown/appkit/react";
import Link from "next/link";
import { CheckCircleFillIcon } from "@/components/icons";
import {
  CHAIN_ID,
  CORESCAN_BASE_URL,
  PELL_WITHDRAWALS_CONTRACT,
} from "@/lib/constants";

export type PellUnstakeErc20TxProps = {
  // Pell params
  tokenName: string;
  tokenAddress: string;
  strategyAddress: string; // e.g., 0x1f6b05... (strategy)
  amount: string; // e.g., "0.1"
};

export type PellUnstakeErc20Props = {
  tx: PellUnstakeErc20TxProps;
  sendMessage: (msg: {
    role: "system" | "user" | "assistant";
    parts: { type: "text"; text: string }[];
  }) => void;
};

// queueWithdrawals((address[] strategies, uint256[] shares, address withdrawer)[] queuedWithdrawalParams)
const pellWithdrawalsAbi = [
  {
    type: "function",
    name: "queueWithdrawals",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "queuedWithdrawalParams",
        type: "tuple[]",
        components: [
          { name: "strategies", type: "address[]" },
          { name: "shares", type: "uint256[]" },
          { name: "withdrawer", type: "address" },
        ],
      },
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

type Phase = "idle" | "awaiting_wallet" | "queuing" | "success" | "error";

const PellUnstakeErc20: React.FC<PellUnstakeErc20Props> = ({
  tx,
  sendMessage,
}) => {
  const { isConnected, address: from } = useAppKitAccount();

  const token = tx.tokenAddress as Address;
  const strategy = tx.strategyAddress as Address;
  const withdrawer = from as Address | undefined;
  const amountHuman = tx.amount;

  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [queueHash, setQueueHash] = useState<`0x${string}` | undefined>();
  const [lastQueueHash, setLastQueueHash] = useState<
    `0x${string}` | undefined
  >();
  const sentQueueRef = useRef(false);

  const { data: metaData } = useReadContracts({
    allowFailure: true,
    contracts: [
      {
        address: token,
        chainId: CHAIN_ID,
        abi: erc20MetaAbi,
        functionName: "decimals",
      },
      {
        address: token,
        chainId: CHAIN_ID,
        abi: erc20MetaAbi,
        functionName: "symbol",
      },
    ],
    query: { enabled: !!token },
  });

  const tokenDecimals: number | undefined = useMemo(() => {
    const v = metaData?.[0]?.result;
    return typeof v === "number" ? v : undefined;
  }, [metaData]);

  const tokenSymbol: string | undefined = useMemo(() => {
    const v = metaData?.[1]?.result;
    return typeof v === "string" ? v : undefined;
  }, [metaData]);

  const parsedAmount = useMemo(() => {
    try {
      if (!amountHuman || typeof tokenDecimals !== "number") return undefined;
      return parseUnits(amountHuman, tokenDecimals);
    } catch {
      return undefined;
    }
  }, [amountHuman, tokenDecimals]);

  const {
    writeContract,
    data: writeHash,
    isPending: isSending,
    error: sendError,
  } = useWriteContract();

  const queueWait = useWaitForTransactionReceipt({
    hash: queueHash,
    chainId: CHAIN_ID,
    confirmations: 1,
    query: { enabled: !!queueHash },
  });

  // Route latest hash into our queue bucket
  useEffect(() => {
    if (!writeHash) return;
    if (phase === "awaiting_wallet" || phase === "queuing") {
      setQueueHash(writeHash);
    }
  }, [writeHash, phase]);

  // Handle write errors
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
      console.error("[queueWithdrawals] error:", sendError);
      setErrorMsg(msg);
      setPhase("error");
    }
  }, [sendError, sendMessage]);

  // Start flow: queueWithdrawals (single tx)
  const handleUnstakeFlow = async () => {
    setErrorMsg("");
    sentQueueRef.current = false;

    if (!isConnected || !from) return setErrorMsg("Connect your wallet first");
    if (!withdrawer) return setErrorMsg("Withdrawer address unavailable");
    if (!strategy) return setErrorMsg("Strategy address missing");

    try {
      setPhase("awaiting_wallet");
      await writeContract({
        address: PELL_WITHDRAWALS_CONTRACT,
        abi: pellWithdrawalsAbi,
        functionName: "queueWithdrawals",
        args: [
          [
            {
              strategies: [strategy],
              shares: [parsedAmount as bigint],
              withdrawer,
            },
          ],
        ],
        chainId: CHAIN_ID,
        account: from as Address,
      });
      setPhase("queuing");
    } catch (e: any) {
      console.error("[queueWithdrawals] send error:", e);
      setErrorMsg(e?.message || "Queue failed");
      setPhase("error");
    }
  };

  // On queue confirmed
  useEffect(() => {
    if (!queueHash) return;

    if (queueWait.isError) {
      setErrorMsg("Withdraw queue failed or reverted");
      setPhase("error");
      return;
    }
    if (queueWait.isSuccess) {
      setLastQueueHash(queueHash);
      setPhase("success");

      if (!sentQueueRef.current) {
        sentQueueRef.current = true;
        const humanText = tx.amount
          ? `${tx.amount}`
          : `${parsedAmount ? parsedAmount.toString() : "?"} (wei)`;
        sendMessage({
          role: "system",
          parts: [
            {
              type: "text",
              text: `Withdrawal queued on Pell for ${humanText}. Tokens will be available to withdraw in 7 days`,
            },
          ],
        });
      }
    }
  }, [
    queueHash,
    queueWait.isError,
    queueWait.isSuccess,
    parsedAmount,
    tx.amount,
    sendMessage,
  ]);

  const isAwaitingQueue =
    phase === "queuing" ||
    (!!queueHash && !queueWait.isSuccess && !queueWait.isError);

  const isButtonDisabled =
    isSending || phase === "queuing" || phase === "success";

  function ButtonContent() {
    if (phase === "awaiting_wallet" || isAwaitingQueue) {
      return (
        <>
          <FaSpinner className="animate-spin" />
          Queuing...
        </>
      );
    }
    if (phase === "success") {
      return (
        <>
          <FaCheck />
          Queued
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
    return <>Unstake</>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-zinc-900 text-white p-4 rounded-2xl shadow-md w-full border border-zinc-700 max-w-lg">
        <h2 className="text-xl font-semibold mb-4">Pell Unstake</h2>

        <div className="text-sm grid grid-cols-2 gap-y-2 mb-4">
          <span className="text-gray-400">Token</span>
          <span className="text-right break-all">
            {tx.tokenName} ({tokenSymbol ?? "..."})
          </span>
          <span className="text-gray-400">Strategy</span>
          <span className="text-right break-all">{strategy}</span>
          <span className="text-gray-400">Amount</span>
          <span className="text-right">{tx.amount}</span>
        </div>

        {errorMsg && (
          <div className="text-red-400 text-sm mb-2">{errorMsg}</div>
        )}

        <button
          disabled={isButtonDisabled}
          onClick={handleUnstakeFlow}
          className="mt-2 flex items-center justify-center gap-2 bg-white text-black py-2 px-4 rounded-md font-medium hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed w-full h-10"
        >
          <ButtonContent />
        </button>

        <div className="text-xs text-gray-400 mt-3 space-y-1">
          {lastQueueHash && (
            <div>
              Tx:{" "}
              <Link
                href={`${CORESCAN_BASE_URL}/tx/${lastQueueHash}`}
                target="_blank"
                className="underline text-blue-500"
              >
                {lastQueueHash}
              </Link>
            </div>
          )}
          <div>Phase: {phase}</div>
        </div>
      </div>

      {phase === "success" && queueWait.data?.status === "success" && (
        <div className="bg-zinc-800 rounded-xl p-6 mt-6 flex flex-col items-center text-center border border-green-500 max-w-lg">
          <div className="text-green-500 mb-3">
            <CheckCircleFillIcon size={40} />
          </div>
          <h3 className="text-xl font-semibold mb-2">Withdrawal Queued</h3>
          <p className="text-gray-500 text-sm">
            Your unstake request has been queued on Pell.
          </p>
          {lastQueueHash && (
            <p className="mt-2">
              <Link
                href={`${CORESCAN_BASE_URL}/tx/${lastQueueHash}`}
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

export default PellUnstakeErc20;
