export type GoalState = {
  id: string;
  title: string;
  rawIntent: string;
  domain: string;
  targetUsers: string;
  constraints: string[];
  references: string[];
  mustHaveFeatures: string[];
  niceToHaveFeatures: string[];
  risks: string[];
  unknowns: string[];
  decisions: string[];
  outputType: string;
  completenessScore: number;
};

type SerializedSession = {
  id: string;
  title: string;
  rawIntent: string;
  domain: string;
  targetUsers: string;
  constraints: string;
  references: string;
  mustHaveFeatures: string;
  niceToHaveFeatures: string;
  risks: string;
  unknowns: string;
  decisions: string;
  outputType: string;
  completenessScore: number;
};

export function parseList(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => typeof item === "string");
    }
  } catch {
    return [];
  }

  return [];
}

export function toGoalState(session: SerializedSession): GoalState {
  return {
    id: session.id,
    title: session.title,
    rawIntent: session.rawIntent,
    domain: session.domain,
    targetUsers: session.targetUsers,
    constraints: parseList(session.constraints),
    references: parseList(session.references),
    mustHaveFeatures: parseList(session.mustHaveFeatures),
    niceToHaveFeatures: parseList(session.niceToHaveFeatures),
    risks: parseList(session.risks),
    unknowns: parseList(session.unknowns),
    decisions: parseList(session.decisions),
    outputType: session.outputType,
    completenessScore: session.completenessScore,
  };
}

export function serializeList(value: unknown): string {
  if (!Array.isArray(value)) {
    return "[]";
  }

  return JSON.stringify(
    value
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

export function createFallbackState(message: string): Partial<GoalState> {
  const compact = message.replace(/\s+/g, " ").trim();

  return {
    title: compact.length > 32 ? `${compact.slice(0, 32)}...` : compact || "새 목표",
    rawIntent: compact,
    domain: "software_or_product",
    targetUsers: "아직 구체화되지 않음",
    constraints: [],
    references: [],
    mustHaveFeatures: [],
    niceToHaveFeatures: [],
    risks: ["요구사항이 아직 충분히 구체화되지 않음"],
    unknowns: [
      "주요 사용자",
      "반드시 필요한 기능",
      "성공 기준",
      "기술/운영 제약",
    ],
    decisions: [],
    outputType: "dashboard",
    completenessScore: 15,
  };
}
