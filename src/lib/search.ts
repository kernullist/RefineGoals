export type SearchResult = {
  title: string;
  url: string;
  content: string;
};

export type ImageSearchResult = {
  url: string;
  description: string;
};

export async function searchWeb(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey || !query.trim()) {
    return [];
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  let response: Response;

  try {
    response = await fetch("https://api.tavily.com/search", {
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
      signal: controller.signal,
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }

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

export async function searchImages(query: string): Promise<ImageSearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey || !query.trim()) {
    return [];
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  let response: Response;
  try {
    response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        include_answer: false,
        include_images: true,
        max_results: 3,
      }),
      signal: controller.signal,
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as {
    images?: Array<
      | string
      | {
          url?: string;
          description?: string;
        }
    >;
  };

  return (data.images || [])
    .map((item) => {
      if (typeof item === "string") {
        return {
          url: item,
          description: query,
        };
      }

      return {
        url: item.url || "",
        description: item.description || query,
      };
    })
    .filter((item) => item.url);
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
