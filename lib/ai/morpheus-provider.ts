// /lib/ai/providers.ts
import { createOpenAI } from "@ai-sdk/openai";

const MORPHEUS_API_KEY = process.env.MORPHEUS_API_KEY ?? "";

export function createMorpheusProvider(
  opts: { apiKey?: string; baseURL?: string } = {}
) {
  const baseURL = (opts.baseURL ?? "https://api.mor.org/api/v1").replace(
    /\/$/,
    ""
  );
  const apiKey = opts.apiKey ?? MORPHEUS_API_KEY;

  console.log("[MorpheusProvider:init]", {
    baseURL,
    hasApiKey: Boolean(apiKey),
  });

  return createOpenAI({
    apiKey,
    baseURL,
    fetch: async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const bodyText = typeof init?.body === "string" ? init.body : undefined;
      const isStreaming = bodyText?.includes('"stream":true');
      console.log("isStreaming", isStreaming);
      console.log("bodyText", bodyText);
      console.log("url", url);

      const headers = new Headers(init?.headers ?? {});
      if (!headers.has("Accept")) {
        headers.set(
          "Accept",
          isStreaming ? "text/event-stream" : "application/json"
        );
      }

      const logged = Object.fromEntries(
        Array.from(headers.entries()).map(([k, v]) =>
          k.toLowerCase() === "authorization"
            ? [k, "Bearer ***redacted***"]
            : [k, v]
        )
      );
      console.log("[MorpheusProvider:request]", {
        url,
        method: init?.method,
        isStreaming,
        headers: logged,
        bodyPreview: bodyText?.slice(0, 800),
      });

      const res = await fetch(input as any, { ...init, headers });
      const clone = res.clone();
      let preview: string | undefined;
      try {
        preview = await clone.text();
      } catch {}
      console.log("[MorpheusProvider:response]", {
        status: res.status,
        statusText: res.statusText,
        bodyPreview: preview?.slice(0, 1200),
      });
      return res;
    },
  });
}

export const morpheusProvider = createMorpheusProvider();
