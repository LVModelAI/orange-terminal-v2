import { tool } from "ai";
import { z } from "zod";

const ProtocolIdEnum = z.enum([
  "core-dao",
  "colend",
  "desyn",
  "pell-network",
  "molten",
]);

type ProtocolId = z.infer<typeof ProtocolIdEnum>;

const PROTOCOL_LINKS: Record<ProtocolId, string[]> = {
  "core-dao": ["https://coredao.org/", "https://docs.coredao.org/"],
  colend: ["https://www.colend.xyz/", "https://app.colend.xyz/"],
  desyn: [
    "https://www.desyn.io/",
    "https://app.desyn.io/",
    "https://docs.desyn.io/",
  ],
  "pell-network": [
    "https://www.pell.network/",
    "https://app.pell.network/",
    "https://docs.pell.network/",
  ],
  molten: ["https://molten.finance/", "https://docs.molten.finance/"],
};

export const getProtocolInformation = tool({
  description:
    "Search through official domains of a Core DeFi protocol using Tavily Search API. Returns summarized information or direct answers from protocol sources.",
  inputSchema: z.object({
    protocol: ProtocolIdEnum.describe(
      "Protocol id from the allowed list: core-dao, colend, desyn, pell-network, molten"
    ),
    query: z
      .string()
      .describe(
        "User's search question about the protocol, e.g.  'how to lend', 'supported tokens'"
      ),
  }),

  execute: async ({
    protocol,
    query,
  }: {
    protocol: ProtocolId;
    query: string;
  }) => {
    console.log("Executing searchProtocolInfo with:", { protocol, query });

    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) throw new Error("TAVILY_API_KEY not set");

    const includeDomains = PROTOCOL_LINKS[protocol];

    const body = {
      query,
      topic: "general",
      search_depth: "advanced",
      max_results: 5,
      include_answer: true,
      include_raw_content: true,
      include_domains: includeDomains,
    };

    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Tavily API error: ${res.status} - ${errText}`);
    }

    const data = await res.json();

    const summary = {
      answer: data.answer || "No direct answer found",
      topSources: data.results?.map((r: any) => ({
        title: r.title,
        url: r.url,
        snippet: r.content,
      })),
      responseTime: data.response_time,
    };

    console.log("summary---- ", summary);

    return summary;
  },
});

export type { ProtocolId };
