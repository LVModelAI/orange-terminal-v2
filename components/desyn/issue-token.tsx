"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaSpinner, FaCheck, FaTimes } from "react-icons/fa";
import {
  useWaitForTransactionReceipt,
  useWriteContract,
  useReadContract,
} from "wagmi";
import { Address, erc20Abi, parseUnits } from "viem";
import { useAppKitAccount } from "@reown/appkit/react";
import Link from "next/link";
import { CheckCircleFillIcon } from "@/components/icons";
import { CHAIN_ID, CORESCAN_BASE_URL } from "@/lib/constants";
import { DesynIssueTokenTxProps } from "@/lib/ai/tools/desyn/desynIssueToken";

// ---- Props ----
type DesynIssueTokenProps = {
  tx: DesynIssueTokenTxProps;

  sendMessage: (msg: {
    role: "system" | "user" | "assistant";
    parts: { type: "text"; text: string }[];
  }) => void;
};

type Phase =
  | "idle"
  | "awaiting_wallet"
  | "approving"
  | "approved"
  | "issuing"
  | "success"
  | "error";

// Router contract
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

  const sentApproveRef = useRef(false);
  const sentIssueRef = useRef(false);

  const parsedIssueAmount = useMemo(() => {
    try {
      return parseUnits(tx.amount, tx.tokenDecimals);
    } catch {
      return undefined;
    }
  }, [tx.amount, tx.tokenDecimals]);

  // allowance check
  const { data: allowance } = useReadContract({
    address: tx.tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [from as Address, DESYN_ROUTER_ADDRESS],
    chainId: CHAIN_ID,
    query: { enabled: !!from },
  });

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

  // route hashes
  useEffect(() => {
    if (!writeHash) return;
    if (phase === "awaiting_wallet" || phase === "approving")
      setApproveHash(writeHash);
    if (phase === "issuing") setIssueHash(writeHash);
  }, [writeHash, phase]);

  // errors
  useEffect(() => {
    if (!sendError) return;
    const msg = (sendError as any)?.message || "Transaction error";
    setErrorMsg(msg);
    setPhase("error");
  }, [sendError]);

  // approve confirmed
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

  // issue after approved
  useEffect(() => {
    const doIssue = async () => {
      if (phase !== "approved") return;
      if (!parsedIssueAmount || !from) {
        setErrorMsg("Missing parsed amount or sender");
        setPhase("error");
        return;
      }
      const minOut = BigInt(tx.minOutStr);

      try {
        setPhase("issuing");
        await writeContract({
          address: DESYN_ROUTER_ADDRESS,
          abi: routerAbi,
          functionName: "autoJoinSmartPool",
          args: [
            tx.controllerAddr,
            tx.kolAddr ?? DEFAULT_KOL,
            parsedIssueAmount,
            minOut,
            tx.tokenAddress,
            {
              aggregator: DEFAULT_AGGREGATOR,
              rebalanceAdapter: DEFAULT_REBALANCE_ADAPTER,
              swapType: DEFAULT_SWAP_TYPE,
            },
            [{ quantity: parsedIssueAmount, data: "0x" }],
          ],
          chainId: CHAIN_ID,
          account: from as Address,
          value: 0n,
        });
      } catch (e: any) {
        setErrorMsg(e?.message || "Issue failed");
        setPhase("error");
      }
    };
    void doIssue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // confirm issue
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
              text: `Issued ${tx.amount} ${tx.tokenSymbol} into pool ${tx.poolName}`,
            },
          ],
        });
      }
    }
  }, [issueHash, issueWait.isError, issueWait.isSuccess, tx, sendMessage]);

  const handleIssueFlow = async () => {
    setErrorMsg("");
    sentApproveRef.current = false;
    sentIssueRef.current = false;

    if (!isConnected || !from) return setErrorMsg("Connect your wallet first");
    if (!parsedIssueAmount) return setErrorMsg("Invalid amount");

    try {
      // 👇 check allowance first
      if (allowance !== undefined && allowance >= parsedIssueAmount) {
        console.log("[Desyn] already approved, skipping approve");
        setPhase("approved"); // jump straight to issuing step
        return;
      }

      // otherwise go through approve flow
      setPhase("awaiting_wallet");
      await writeContract({
        address: tx.tokenAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [DESYN_ROUTER_ADDRESS, parsedIssueAmount],
        chainId: CHAIN_ID,
        account: from as Address,
      });
      setPhase("approving");
    } catch (e: any) {
      setErrorMsg(e?.message || "Approve failed");
      setPhase("error");
    }
  };

  const isAwaitingApproval =
    phase === "awaiting_wallet" || phase === "approving";
  const isButtonDisabled =
    isSending || phase === "issuing" || phase === "success";

  function ButtonContent() {
    if (isAwaitingApproval)
      return (
        <>
          <FaSpinner className="animate-spin" /> Approving...
        </>
      );
    if (phase === "issuing")
      return (
        <>
          <FaSpinner className="animate-spin" /> Issuing...
        </>
      );
    if (phase === "success")
      return (
        <>
          <FaCheck /> Issued
        </>
      );
    if (phase === "error")
      return (
        <>
          <FaTimes /> Retry
        </>
      );
    return <>Issue</>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-zinc-900 text-white p-4 rounded-2xl shadow-md w-full border border-zinc-700 max-w-lg">
        <h2 className="text-xl font-semibold mb-4">DeSyn Issue Token</h2>

        <div className="text-sm grid grid-cols-2 gap-y-2 mb-4">
          <span className="text-gray-400">Strategy</span>
          <span className="text-right break-all">{tx.poolName}</span>
          <span className="text-gray-400">Pay Token</span>
          <span className="text-right break-all">{tx.tokenName}</span>
          <span className="text-gray-400">Amount</span>
          <span className="text-right">
            {tx.amount} {tx.tokenSymbol}
          </span>
          <span className="text-gray-400">Rewards</span>
          <span className="text-right">{tx.rewards ?? "-"}</span>
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
            Successfully issued {tx.amount} {tx.tokenSymbol}
          </h3>
          <p className="text-gray-500 text-sm">Into pool {tx.poolName}</p>
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
