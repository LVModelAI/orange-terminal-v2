"use client";

import React, { useEffect, useState } from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import type { Address } from "viem";
import { useAppKitAccount } from "@reown/appkit/react";
import {
  CHAIN_ID,
  CORESCAN_BASE_URL,
  DUALCORE_VAULT_CONTRACT,
} from "@/lib/constants";
import { toWei } from "@/lib/utils";
import Link from "next/link";

// Minimal ABI for a payable stake() function with no arguments
const b14gAbi = [
  {
    type: "function",
    name: "stake",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  // Optionally include a view to fetch something if needed in future
  // { type: "function", name: "totalStaked", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

type B14GStakeProps = {
  // Optional initial value (in CORE) to prefill the input
  amount: string;
};

const B14GStake: React.FC<B14GStakeProps> = ({ amount }) => {
  const { isConnected, address: from } = useAppKitAccount();

  const [error, setError] = useState<string | null>(null);

  const {
    writeContract,
    data: txHash,
    isPending: isSending,
    error: sendError,
  } = useWriteContract();

  const {
    isLoading: isMining,
    isSuccess,
    isError: isTxError,
    data: receipt,
  } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: CHAIN_ID,
    confirmations: 1,
    query: { enabled: !!txHash },
  });

  useEffect(() => {
    if (sendError) console.error("B14G stake send error:", sendError);
    if (isTxError) console.error("B14G stake tx failed or reverted:", receipt);
  }, [sendError, isTxError, receipt]);

  const handleStake = () => {
    setError(null);
    if (!isConnected || !from) {
      setError("Wallet not connected");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError("Enter a valid amount");
      return;
    }

    const valueAsStringWei = toWei(amount);
    const valueInWei = BigInt(valueAsStringWei);

    try {
      writeContract({
        address: DUALCORE_VAULT_CONTRACT,
        abi: b14gAbi,
        functionName: "stake",
        args: [],
        value: valueInWei,
        chainId: CHAIN_ID,
        account: from as Address,
      });
    } catch (e) {
      console.error("Failed to submit stake:", e);
      setError("Failed to submit transaction");
    }
  };

  const isButtonDisabled = isSending || isMining || isSuccess;

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-zinc-900 text-white p-4 rounded-2xl shadow-md w-full border border-zinc-700 max-w-lg">
        <h2 className="text-xl font-semibold mb-4">Stake CORE to B14G</h2>

        <div className="mb-4">
          <div className="block text-sm text-gray-400 mb-1">Amount (CORE)</div>
          <div>{amount} CORE</div>
        </div>

        <button
          disabled={isButtonDisabled}
          onClick={handleStake}
          className="w-full h-10 bg-white text-black rounded-md font-medium hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSending && <span>Awaiting wallet confirmation…</span>}
          {txHash && !isSuccess && !isTxError && !isSending && (
            <span>Waiting for confirmations…</span>
          )}
          {isSuccess && receipt?.status === "success" && (
            <span>Stake Complete</span>
          )}
          {isTxError && <span className="text-red-500">Stake Failed</span>}
          {!isSending && !txHash && !isSuccess && !isTxError && (
            <span>Stake</span>
          )}
        </button>
      </div>

      {isSuccess && receipt?.status === "success" && (
        <div className="bg-zinc-800 rounded-xl p-6 mt-2 flex flex-col items-center text-center border border-green-500 max-w-lg">
          <h3 className="text-lg font-semibold mb-2">Stake Successful</h3>
          <p className="text-gray-400 text-sm mb-2">{amount} CORE</p>
          <p>
            <Link
              href={`${CORESCAN_BASE_URL}/tx/${txHash}`}
              target="_blank"
              className="underline text-blue-600 text-sm"
            >
              View on CoreScan
            </Link>
          </p>
        </div>
      )}
    </div>
  );
};

export default B14GStake;
