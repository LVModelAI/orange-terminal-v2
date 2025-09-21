import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { openai } from "@ai-sdk/openai";
import { morpheusProvider } from "@/lib/ai/morpheus-provider";

export const myProvider = customProvider({
  languageModels: {
    // "chat-model": openai("gpt-4o"),
    "chat-model": morpheusProvider.chat("llama-3.3-70b"),

    "chat-model-reasoning": wrapLanguageModel({
      model: openai("o3"),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    }),
    "title-model": openai("gpt-4o-mini"),
  },
});
