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

function normalizeModelName(provider: ProviderId, model: string): string {
  if (provider === "deepseek" && model.startsWith("deepseek/")) {
    return model.slice("deepseek/".length);
  }

  return model;
}

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
    model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
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
      model: normalizeModelName(input.provider, config.model),
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
    "If the user's request is unclear, underspecified, contradictory, or conflicts with the current goal state, do not force a decision.",
    "In that case, restate what you understood, identify the unclear or conflicting parts, and ask targeted clarification questions before updating those fields as decisions.",
    "Separate confirmed decisions from assumptions. Put uncertain items in unknowns, not decisions.",
    "When asking about UX, dashboard layout, charting, visualization, navigation, or interaction choices, do not only ask an open-ended question.",
    "Instead, create concrete selectable UX options so the user can choose after seeing the tradeoffs.",
    "If the user cannot choose between options or asks you to recommend, propose one clear default instead of staying neutral.",
    "For recommendations, combine available search evidence, domain reasoning, implementation complexity, user workflow impact, and future extensibility.",
    "Explain why the recommended option is best, when it would not be best, and what the second-best fallback is.",
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
    '  "suggestedChoices": [',
    '    {',
    '      "title": "Option title",',
    '      "description": "What the user would see and how it behaves",',
    '      "tradeoff": "Main strength and caveat",',
    '      "reply": "A ready-to-send user reply selecting this option"',
    "    }",
    "  ],",
    '  "suggestedArtifacts": ["PRODUCT_BRIEF.md", "TECHNICAL_SPEC.md"]',
    "}",
    "When clarification is needed, assistantMessage should use this structure in Korean: 1. understood summary, 2. unclear/conflicting points, 3. questions to resolve them.",
    "Ask no more than five clarification questions at once. Prefer questions that unblock architecture, output format, target users, constraints, and success criteria.",
    "For UX choice questions, provide 2 to 4 suggestedChoices. Example for cppcheck dashboard visualization: A. issue-type chart plus trend, B. file risk heatmap, C. code-owner/action queue, D. hybrid executive overview.",
    "When the user asks you to choose, mark the recommended suggestedChoice title clearly with '(추천)' and make its reply ready to accept the recommendation.",
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
