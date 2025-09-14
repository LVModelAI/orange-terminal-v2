// app/api/portfolio/tokens/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { CHAIN_ID, PELL_PORTFOLIO_BASE_API } from "@/lib/constants";

// ----- Types -----
export const PellTokenSchema = z.object({
  chainId: z.number(),
  stakeName: z.string(),
  pointDesc: z.string().nullable().optional(),
  stakeIcon: z.string().url().nullable().optional(),
  strategyAddress: z.string(),
  currency: z.string(),
  restakedAmount: z.string(),
  pendingStartTime: z.number().nullable(),
  deplayTime: z.number(),
  pendingWithdraw: z.string(),
  availableToWithdraw: z.string(),
  decimals: z.number(),
  stakeType: z.number(),
  originalUnderlineAddress: z.string().nullable(),
  assetType: z.number(),
  busType: z.number(),
  chainType: z.number(),
});

export type PellToken = z.infer<typeof PellTokenSchema>;

const PellResponseSchema = z.object({
  code: z.number(),
  message: z.string(),
  result: z.array(PellTokenSchema),
});

type PellResponse = z.infer<typeof PellResponseSchema>;

// With human readable fields
// 1) TYPE: extend what your route returns
export type PellRestakingPortfolio = PellToken & {
  restakedAmountHumanReadable: string;
  pendingWithdrawHumanReadable: string;
  availableToWithdrawHumanReadable: string;
  pendingStartTimeHumanReadable: string | null;
  deplayTimeHumanReadable: string;
};

// ----- Helpers -----
function formatAmount(raw: string, decimals: number): string {
  try {
    const divisor = BigInt(10) ** BigInt(decimals);
    const value = BigInt(raw);
    const integerPart = value / divisor;
    const fractionalPart = value % divisor;

    if (fractionalPart === BigInt(0)) {
      return integerPart.toString();
    }

    // Pad fractional part to decimals length, then trim trailing zeros
    const fractionStr = fractionalPart
      .toString()
      .padStart(decimals, "0")
      .replace(/0+$/, "");
    return `${integerPart.toString()}.${fractionStr}`;
  } catch {
    return "0";
  }
}

// 2) HELPERS: add these below formatAmount(...)
function formatEpochSecondsToISO(epoch: number | null): string | null {
  if (epoch === null) return null;
  try {
    return new Date(epoch * 1000).toISOString();
  } catch {
    return null;
  }
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0m";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m || parts.length === 0) parts.push(`${m}m`);
  return parts.join(" ");
}

// ----- Fetcher -----
async function getPellRestakingPortfolio(
  walletAddress: string
): Promise<PellRestakingPortfolio[]> {
  try {
    const url = `${PELL_PORTFOLIO_BASE_API}?chainId=${CHAIN_ID}&address=${walletAddress}`;
    const res = await fetch(url, { method: "GET", cache: "no-store" });

    if (!res.ok) {
      console.error("Pell API HTTP error", res.status, res.statusText);
      return [];
    }

    const json = (await res.json()) as unknown;
    const parsed = PellResponseSchema.safeParse(json);

    if (!parsed.success) {
      console.error("Pell API shape invalid", parsed.error.flatten());
      return [];
    }

    const data: PellResponse = parsed.data;

    if (data.code !== 1 || !Array.isArray(data.result)) {
      return [];
    }

    // console.log("data.result --- ", data.result);

    // 3) MAPPING: add two formatted fields inside the .map(...) that builds the return
    return data.result.map((t) => ({
      ...t,
      restakedAmountHumanReadable: formatAmount(t.restakedAmount, t.decimals),
      pendingWithdrawHumanReadable: formatAmount(t.pendingWithdraw, t.decimals),
      availableToWithdrawHumanReadable: formatAmount(
        t.availableToWithdraw,
        t.decimals
      ),
      pendingStartTimeHumanReadable: formatEpochSecondsToISO(
        t.pendingStartTime
      ),
      deplayTimeHumanReadable: formatDuration(t.deplayTime),
    }));
  } catch (err) {
    console.error("Error fetching token data from Pell:", err);
    return [];
  }
}

// ----- Route -----
export async function GET(req: Request) {
  if (!PELL_PORTFOLIO_BASE_API) {
    return NextResponse.json(
      { error: "Missing environment configuration" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  const tokens = await getPellRestakingPortfolio(address);
  return NextResponse.json({ tokens });
}
