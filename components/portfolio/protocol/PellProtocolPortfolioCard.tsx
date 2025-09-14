// components/PellProtocolPortfolioCard.tsx

import {
  PellRestakingPortfolio,
  PellToken,
} from "@/app/api/portfolio/pell-restaking-portfolio/route";
import Image from "next/image";
import React from "react";

export function PellProtocolPortfolioCard({
  token,
}: {
  token: PellRestakingPortfolio;
}) {
  const initials = token.currency?.slice(0, 3)?.toUpperCase() || "ASSET";
  console.log("token", token);
  return (
    <div className="flex items-center justify-between rounded-lg p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center gap-3">
        {/* Simple placeholder avatar */}
        <div className="h-10 w-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          {token.stakeIcon ? (
            <Image
              src={token.stakeIcon}
              alt={token.stakeName}
              width={40}
              height={40}
            />
          ) : (
            initials
          )}
        </div>

        <div className="flex flex-col">
          <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {token.stakeName}{" "}
            <span className="text-zinc-400">({token.currency})</span>
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Strategy {shortAddr(token.strategyAddress)} • Chain {token.chainId}
          </div>
          {token.pointDesc ? (
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
              {token.pointDesc}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-right">
        <Info
          label="Restaked"
          value={`${token.restakedAmountHumanReadable} ${token.currency}`}
        />
        <Info
          label="Pending"
          value={`${token.pendingWithdrawHumanReadable} ${token.currency}`}
        />
        <Info
          label="Withdrawable"
          value={`${token.availableToWithdrawHumanReadable} ${token.currency}`}
        />
        <Info
          label="Pending since"
          value={
            token.pendingStartTimeHumanReadable
              ? toLocal(token.pendingStartTimeHumanReadable)
              : "—"
          }
        />
        <Info label="Unlock delay" value={token.deplayTimeHumanReadable} />
        <Info label="Decimals" value={String(token.decimals)} />
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <span className="text-sm text-zinc-800 dark:text-zinc-200">{value}</span>
    </div>
  );
}

function shortAddr(a: string) {
  if (!a) return "";
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

function toLocal(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}
