import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";

export type Provider = "openai" | "anthropic" | "gemini";

// Single source of truth - contains both the API key and metadata
export const MODELS = {
  GPT_4O: {
    key: "gpt-4o",
    label: "GPT-4o",
    provider: "openai" as Provider,
  },
  GPT_4O_MINI: {
    key: "gpt-4o-mini",
    label: "GPT-4o-mini",
    provider: "openai" as Provider,
  },
  GPT_4_1: {
    key: "gpt-4.1",
    label: "GPT-4.1",
    provider: "openai" as Provider,
  },
  GPT_5: {
    key: "gpt-5",
    label: "GPT-5",
    provider: "openai" as Provider,
  },
  CLAUDE_3_7_SONNET: {
    key: "claude-3-7-sonnet-latest",
    label: "Claude 3.7 Sonnet",
    provider: "anthropic" as Provider,
  },
  CLAUDE_SONNET_4: {
    key: "claude-sonnet-4-0",
    label: "Claude Sonnet 4",
    provider: "anthropic" as Provider,
  },
  GEMINI_2_5_PRO: {
    key: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "gemini" as Provider,
  },
} as const;

// Type for the model object values
export type Model = typeof MODELS[keyof typeof MODELS];

/**
 * Utility function to get the wrapped provider model using model data.
 */
export function getLLMModel(model: Model) {
  switch (model.provider) {
    case "openai":
      return openai(model.key);
    case "anthropic":
      return anthropic(model.key);
    case "gemini":
      return google(model.key);
    default:
      throw new Error(`Provider not supported: ${model.provider}`);
  }
}
