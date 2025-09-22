// pellStakeErc20.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaSpinner, FaCheck, FaTimes } from "react-icons/fa";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContracts,
} from "wagmi";
import { Address, erc20Abi, parseUnits } from "viem";
import { useAppKitAccount } from "@reown/appkit/react";
import Link from "next/link";
import { CheckCircleFillIcon } from "@/components/icons";
import {
  CHAIN_ID,
  CORESCAN_BASE_URL,
  PELL_ADMIN_UPGRADEABLILITY_PROXY_CONTRACT_ADDRESS,
} from "@/lib/constants";
import { PellStakeErc20Props } from "@/lib/ai/tools/pell-restaking-actions/pellStakeErc20";

/** ------------------------------------------------------------------------------- */

// Minimal ABI for Pell deposit.
// Event observed: Deposit(address staker, address token, address strategy, uint256 shares)
// Commonly, the function is `deposit(token, strategy, shares)`; if Pell uses a different name/signature,
// change it here.
const pellAbi = [
  {
    type: "function",
    name: "depositIntoStrategy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "strategy", type: "address" },
      { name: "token", type: "address" },
      { name: "shares", type: "uint256" },
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

type Phase =
  | "idle"
  | "awaiting_wallet"
  | "approving"
  | "approved"
  | "staking"
  | "success"
  | "error";

const PellStakeErc20: React.FC<PellStakeErc20Props> = ({ tx, sendMessage }) => {
  const { isConnected, address: from } = useAppKitAccount();

  const token = tx.tokenAddress as Address;
  const strategy = tx.strategyAddress as Address;
  const spender = PELL_ADMIN_UPGRADEABLILITY_PROXY_CONTRACT_ADDRESS; // default spender is strategy
  const amountHuman = tx.amount;

  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Track hashes independently for approve and deposit
  const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>();
  const [stakeHash, setStakeHash] = useState<`0x${string}` | undefined>();
  const [lastApproveHash, setLastApproveHash] = useState<
    `0x${string}` | undefined
  >();
  const [lastStakeHash, setLastStakeHash] = useState<
    `0x${string}` | undefined
  >();

  const sentApproveRef = useRef(false);
  const sentStakeRef = useRef(false);

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

  const stakeWait = useWaitForTransactionReceipt({
    hash: stakeHash,
    chainId: CHAIN_ID,
    confirmations: 1,
    query: { enabled: !!stakeHash },
  });

  // Route latest writeHash to the correct bucket
  useEffect(() => {
    if (!writeHash) return;
    if (phase === "awaiting_wallet" || phase === "approving") {
      setApproveHash(writeHash);
    } else if (phase === "staking") {
      setStakeHash(writeHash);
    }
  }, [writeHash, phase]);

  // Surface write errors
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
      console.error("[writeContract] error:", sendError);
      setErrorMsg(msg);
      setPhase("error");
    }
  }, [sendError, sendMessage]);

  // On approve confirmed
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
        // Optional: emit a message for approve success
        // sendMessage({ role: "system", parts: [{ type: "text", text: `Approval confirmed for ${tx.tokenName}.` }]});
      }
    }
  }, [approveHash, approveWait.isError, approveWait.isSuccess, tx.tokenName]);

  const parsedAmount = useMemo(() => {
    try {
      if (!amountHuman || typeof tokenDecimals !== "number") return undefined;
      return parseUnits(amountHuman, tokenDecimals);
    } catch {
      return undefined;
    }
  }, [amountHuman, tokenDecimals]);

  // Kick off: approve
  const handleStakeFlow = async () => {
    setErrorMsg("");
    sentApproveRef.current = false;
    sentStakeRef.current = false;

    if (!isConnected || !from) return setErrorMsg("Connect your wallet first");
    if (typeof tokenDecimals !== "number")
      return setErrorMsg("Could not fetch token decimals");
    if (!parsedAmount) return setErrorMsg("Invalid amount for token decimals");

    try {
      setPhase("awaiting_wallet");
      await writeContract({
        address: token,
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, parsedAmount],
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

  // After approved, call Pell deposit
  useEffect(() => {
    const doStake = async () => {
      if (phase !== "approved") return;
      if (!parsedAmount || !from) {
        setErrorMsg("Parsed amount or sender not available");
        setPhase("error");
        return;
      }
      try {
        setPhase("staking");
        await writeContract({
          address: PELL_ADMIN_UPGRADEABLILITY_PROXY_CONTRACT_ADDRESS, // calling the strategy contract (or router) that exposes `deposit`
          abi: pellAbi,
          functionName: "depositIntoStrategy",
          args: [strategy, token, parsedAmount], // deposit(strategy, token, shares)
          chainId: CHAIN_ID,
          account: from as Address,
        });
      } catch (e: any) {
        console.error("[stake/deposit] error:", e);
        setErrorMsg(e?.message || "Stake failed");
        setPhase("error");
      }
    };
    void doStake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const isAwaitingApproval =
    phase === "awaiting_wallet" ||
    phase === "approving" ||
    (!!approveHash && !approveWait.isSuccess && !approveWait.isError);

  const isAwaitingStake =
    phase === "staking" ||
    (!!stakeHash && !stakeWait.isSuccess && !stakeWait.isError);

  const isButtonDisabled =
    isSending ||
    phase === "approving" ||
    phase === "staking" ||
    phase === "success";

  // On stake confirmed
  useEffect(() => {
    if (!stakeHash) return;

    if (stakeWait.isError) {
      setErrorMsg("Stake failed or reverted");
      setPhase("error");
      return;
    }
    if (stakeWait.isSuccess) {
      setLastStakeHash(stakeHash);
      setPhase("success");

      if (!sentStakeRef.current) {
        sentStakeRef.current = true;
        sendMessage({
          role: "system",
          parts: [
            {
              type: "text",
              text: `Successfully staked ${tx.amount} ${tx.tokenName} in Pell`,
            },
          ],
        });
      }
    }
  }, [
    stakeHash,
    stakeWait.isError,
    stakeWait.isSuccess,
    tx.amount,
    tx.tokenName,
    sendMessage,
  ]);

  function ButtonContent() {
    if (isAwaitingApproval) {
      return (
        <>
          <FaSpinner className="animate-spin" />
          Approving...
        </>
      );
    }
    if (isAwaitingStake) {
      return (
        <>
          <FaSpinner className="animate-spin" />
          Staking...
        </>
      );
    }
    if (phase === "success") {
      return (
        <>
          <FaCheck />
          Staked
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
    return <>Approve then Stake</>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-zinc-900 text-white p-4 rounded-2xl shadow-md w-full border border-zinc-700 max-w-lg">
        <h2 className="text-xl font-semibold mb-4">
          Stake {tx.tokenName} in Pell
        </h2>

        <div className="text-sm grid grid-cols-2 gap-y-2 mb-4">
          <span className="text-gray-400">Token</span>
          <span className="text-right break-all">
            {tx.tokenName} ({tokenSymbol ?? "..."})
          </span>

          <span className="text-gray-400">Amount</span>
          <span className="text-right">{amountHuman}</span>

          <span className="text-gray-400">Strategy</span>
          <span className="text-right break-all">{strategy}</span>
        </div>

        {errorMsg && (
          <div className="text-red-400 text-sm mb-2">{errorMsg}</div>
        )}

        <button
          disabled={isButtonDisabled}
          onClick={handleStakeFlow}
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
          {lastStakeHash && (
            <div>
              Stake tx:{" "}
              <Link
                href={`${CORESCAN_BASE_URL}/tx/${lastStakeHash}`}
                target="_blank"
                className="underline text-blue-500"
              >
                {lastStakeHash}
              </Link>
            </div>
          )}
          <div>Phase: {phase}</div>
        </div>
      </div>

      {phase === "success" && stakeWait.data?.status === "success" && (
        <div className="bg-zinc-800 rounded-xl p-6 mt-6 flex flex-col items-center text-center border border-green-500 max-w-lg">
          <div className="text-green-500 mb-3">
            <CheckCircleFillIcon size={40} />
          </div>
          <h3 className="text-xl font-semibold mb-2">Stake Successful</h3>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-bold">
              {amountHuman} {tokenSymbol ?? tx.tokenName}
            </span>
          </div>
          <p className="text-gray-500 text-sm">in Pell</p>
          {lastStakeHash && (
            <p>
              <Link
                href={`${CORESCAN_BASE_URL}/tx/${lastStakeHash}`}
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

export default PellStakeErc20;
