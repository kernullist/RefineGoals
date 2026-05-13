export type SearchResult = {
  title: string;
  url: string;
  content: string;
};

export async function searchWeb(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey || !query.trim()) {
    return [];
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      include_answer: false,
      max_results: 5,
    }),
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as {
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
    }>;
  };

  return (data.results || []).map((item) => ({
    title: item.title || "Untitled",
    url: item.url || "",
    content: item.content || "",
  }));
}

export function summarizeSearch(results: SearchResult[]): string {
  if (results.length === 0) {
    return "No search results available.";
  }

  return results
    .map((result, index) => {
      return `${index + 1}. ${result.title}\n${result.url}\n${result.content}`;
    })
    .join("\n\n");
}
