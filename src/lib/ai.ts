import { GoalState } from "@/lib/goal-state";

export type ProviderId = "openrouter" | "deepseek" | "lmstudio" | "ollama";

export type ChatInput = {
  provider: ProviderId;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
};

export type ModelResult = {
  content: string;
  providerUsed: ProviderId;
};

const providerConfig: Record<
  ProviderId,
  {
    baseUrl: string;
    apiKey?: string;
    model: string;
  }
> = {
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini",
  },
  deepseek: {
    baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
  },
  lmstudio: {
    baseUrl: process.env.LOCAL_LLM_BASE_URL || "http://localhost:1234/v1",
    model: process.env.LOCAL_LLM_MODEL || "local-model",
  },
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
    model: process.env.OLLAMA_MODEL || "llama3.1",
  },
};

export async function callModel(input: ChatInput): Promise<ModelResult> {
  const config = providerConfig[input.provider];

  if (input.provider === "openrouter" && !config.apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  if (input.provider === "deepseek" && !config.apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not configured.");
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      ...(input.provider === "openrouter"
        ? {
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "RefineGoals",
          }
        : {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages: input.messages,
      temperature: 0.35,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Model request failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Model returned an empty response.");
  }

  return {
    content,
    providerUsed: input.provider,
  };
}

export function buildSystemPrompt(): string {
  return [
    "You are RefineGoals, a Korean goal-refinement assistant.",
    "Help the user turn vague product, software, image, or project goals into an actionable dashboard.",
    "Maintain a durable internal goal state and ask concrete follow-up questions.",
    "Return strict JSON only. No markdown outside JSON.",
    "JSON shape:",
    "{",
    '  "assistantMessage": "Korean conversational response",',
    '  "goalState": {',
    '    "title": "short Korean title",',
    '    "rawIntent": "original or improved intent",',
    '    "domain": "software|image|product|research|other",',
    '    "targetUsers": "specific users",',
    '    "constraints": ["..."],',
    '    "references": ["..."],',
    '    "mustHaveFeatures": ["..."],',
    '    "niceToHaveFeatures": ["..."],',
    '    "risks": ["..."],',
    '    "unknowns": ["..."],',
    '    "decisions": ["..."],',
    '    "outputType": "dashboard",',
    '    "completenessScore": 0',
    "  },",
    '  "nextQuestions": ["question 1", "question 2", "question 3"],',
    '  "suggestedArtifacts": ["PRODUCT_BRIEF.md", "TECHNICAL_SPEC.md"]',
    "}",
    "Use the current state, attached image notes, and search evidence when present.",
    "Do not invent confirmed facts from search snippets. Mark uncertain items as assumptions.",
  ].join("\n");
}

export function buildUserPrompt(params: {
  currentState: GoalState;
  userMessage: string;
  searchSummary: string;
  attachmentSummary: string;
}): string {
  return JSON.stringify(
    {
      currentState: params.currentState,
      userMessage: params.userMessage,
      searchSummary: params.searchSummary,
      attachmentSummary: params.attachmentSummary,
    },
    null,
    2,
  );
}
