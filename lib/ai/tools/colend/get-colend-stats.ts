import { COLEND_API } from "@/lib/constants";
import { tool } from "ai";
import z from "zod";

export const getColendStats = tool({
  description:
    "Fetch Colend protocol defi stats like tvlUsd, apy, apyReward, etc., filtered for Core chain and sorted by APY (highest first), then TVL (highest first).",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      console.log("getting colend stats....");
      const res = await fetch(COLEND_API, { method: "GET" });
      if (!res.ok) {
        return { status: "error", data: [], error: `HTTP ${res.status}` };
      }

      const json = await res.json();

      const filtered = Array.isArray(json?.data)
        ? json.data
            .filter(
              (item: any) =>
                typeof item?.chain === "string" &&
                item.chain.toLowerCase() === "core" &&
                item.project === "colend-protocol"
            )
            .sort((a: any, b: any) => {
              const apyDiff = (b.apy ?? 0) - (a.apy ?? 0);
              if (apyDiff !== 0) return apyDiff;
              return (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0);
            })
        : [];

      // console.log("filtered & sorted colend stats ----- ", filtered);

      return {
        status: json?.status ?? "success",
        data: filtered,
      };
    } catch (err: any) {
      return {
        status: "error",
        data: [],
        error: err?.message ?? "Unknown error",
      };
    }
  },
});
