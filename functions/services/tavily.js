/**
 * UNCOVER - Tavily Search API Integration
 * Secure backend service for live web grounding
 */

/**
 * Execute web search via Tavily Search API
 * @param {string} query - Cleaned search query
 * @param {Object} options - { apiKey, depth, maxResults }
 * @returns {Promise<Array<Object>>} Normalized sources
 */
async function searchTavily(query, options = {}) {
  const { apiKey, depth = "standard", maxResults = 5 } = options;

  if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
    const error = new Error("Tavily API key is missing or not configured in Firebase Cloud Functions.");
    error.code = "MISSING_TAVILY_KEY";
    throw error;
  }

  if (!query || typeof query !== "string" || !query.trim()) {
    throw new Error("Search query must be a non-empty string.");
  }

  const endpoint = "https://api.tavily.com/search";
  const searchDepth = depth === "deep" ? "advanced" : "basic";
  const limit = depth === "deep" ? Math.min(maxResults, 8) : Math.min(maxResults, 5);

  const payload = {
    api_key: apiKey.trim(),
    query: query.trim(),
    search_depth: searchDepth,
    include_answer: false,
    include_raw_content: false,
    max_results: limit
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 18000); // 18s timeout

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { message: errorText };
      }

      const err = new Error(`Tavily API error (${response.status}): ${errorData.message || errorData.detail || response.statusText}`);
      err.status = response.status;
      if (response.status === 401 || response.status === 403) {
        err.code = "INVALID_TAVILY_KEY";
      } else if (response.status === 429) {
        err.code = "TAVILY_RATE_LIMITED";
      }
      throw err;
    }

    const data = await response.json();
    const rawResults = Array.isArray(data.results) ? data.results : [];

    // Normalize and validate source results
    const sources = rawResults
      .filter(item => item && item.url && typeof item.url === "string" && item.url.startsWith("http"))
      .map((item, index) => {
        let publisher = "Web Source";
        try {
          const parsedUrl = new URL(item.url);
          publisher = parsedUrl.hostname.replace(/^www\./, "");
        } catch (e) {
          publisher = "Web Source";
        }

        const score = typeof item.score === "number" ? Math.min(Math.max(item.score, 0), 1) : 0.85;

        return {
          id: `src_${index + 1}`,
          title: (item.title && item.title.trim()) || publisher,
          url: item.url.trim(),
          publisher,
          publishDate: item.published_date || null,
          snippet: (item.content && item.content.trim()) || "",
          authorityScore: parseFloat(score.toFixed(2)),
          citationKey: `[${index + 1}]`
        };
      });

    return sources;

  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      const timeoutErr = new Error("Tavily search request timed out after 18 seconds.");
      timeoutErr.code = "TAVILY_TIMEOUT";
      throw timeoutErr;
    }
    throw error;
  }
}

module.exports = {
  searchTavily
};
