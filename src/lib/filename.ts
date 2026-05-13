export function fileSafeName(value: string) {
  return (
    value
      .normalize("NFKC")
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, " ")
      .replace(/_+/g, "_")
      .replace(/^[_\s]+|[_\s.]+$/g, "") || "goal"
  );
}

export function handoffFileName(title: string) {
  return `[RefineGoals] Handoff - ${fileSafeName(title)}.md`;
}

export function dashboardFileName(title: string) {
  return `[RefineGoals] Dashboard - ${fileSafeName(title)}.html`;
}
