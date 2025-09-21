"use client";
import PellWithdrawErc20 from "@/components/pell/pell-withdraw-erc20";
import { PellWithdrawErc20TxProps } from "@/lib/ai/tools/pell-restaking-actions/pellWithdrawErc20";
import React from "react";

const tx: PellWithdrawErc20TxProps = {
  strategy: "0x1F6b05eb565cb596952E991Db4614A29F80e7d71",
  tokenAddress: "0xb3a8f0f0da9ffc65318aa39e55079796093029ad",
};

const sendMessage = () => {};

export default function page() {
  return (
    <div className="p-5">
      <PellWithdrawErc20 tx={tx} sendMessage={sendMessage} />
    </div>
  );
}
