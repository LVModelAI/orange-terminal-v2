import PellStakeErc20 from "@/components/pell/pell-stake-erc20";
import PellUnstakeErc20 from "@/components/pell/pell-unstake-erc20";
import React from "react";

export default function page() {
  return (
    <div className="p-10">
      <div className="mb-4 text-2xl font-bold">Pell stake erc20</div>
      <PellStakeErc20
        tx={{
          tokenName: "stCORE",
          tokenAddress: "0xb3a8f0f0da9ffc65318aa39e55079796093029ad",
          strategyAddress: "0x1f6b05eb565cb596952e991db4614a29f80e7d71",
          amount: "0.1",
        }}
      />

      <div className="mb-4 text-2xl font-bold">Pell unstake erc20</div>
      <PellUnstakeErc20
        tx={{
          tokenName: "stCORE",
          tokenAddress: "0xb3a8f0f0da9ffc65318aa39e55079796093029ad",
          strategyAddress: "0x1f6b05eb565cb596952e991db4614a29f80e7d71",
          amount: "0.1",
        }}
      />
    </div>
  );
}
