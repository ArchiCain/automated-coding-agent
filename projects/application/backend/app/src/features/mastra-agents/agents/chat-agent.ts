import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { getLLMModel, MODELS } from "../model-catalog";

export const chatAgent = new Agent({
  name: "chat-agent",
  model: getLLMModel(MODELS.GPT_4_1),
  instructions: `You are a helpful conversational Conversational AI.`,
  memory: new Memory({
    options: {
      workingMemory: {
        enabled: true,
      },
      // lastMessages: 10,
      threads: {
        generateTitle: true,
      },
    },
  }),
});
