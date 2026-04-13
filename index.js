#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = process.env.APPRANKS_API_URL || "https://appranks.app/api/v1";

async function fetchAPI(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

const server = new McpServer({
  name: "appranks",
  version: "1.0.0",
});

// Browse App Store charts
server.tool(
  "get_chart",
  "Get App Store chart rankings (top free, top paid, or top grossing) for a specific country, platform, and category",
  {
    country: z.string().default("us").describe("Country code (e.g. us, gb, de, jp, fr)"),
    platform: z.enum(["iphone", "ipad", "mac", "tv"]).default("iphone").describe("Platform"),
    chart: z.enum(["topFree", "topPaid", "topGrossing"]).default("topFree").describe("Chart type"),
    category: z.number().optional().describe("Category ID (36=All, 6014=Games, 6016=Entertainment, etc.)"),
    limit: z.number().min(1).max(200).default(20).describe("Number of results"),
  },
  async ({ country, platform, chart, category, limit }) => {
    const data = await fetchAPI("/charts", { country, platform, chart, category, limit });
    const lines = data.items.map(
      (e, i) => `${e.position}. ${e.name} — ${e.developerName || "Unknown"} (${e.price ? `$${e.price.toFixed(2)}` : "Free"})${e.averageRating ? ` ${e.averageRating.toFixed(1)}★` : ""}`
    );
    const header = `${chart} ${platform} apps in ${country.toUpperCase()}${data.capturedAt ? ` (updated ${new Date(data.capturedAt).toISOString()})` : ""}`;
    return { content: [{ type: "text", text: `${header}\n\n${lines.join("\n")}` }] };
  }
);

// Search apps
server.tool(
  "search_apps",
  "Search for apps by name or developer in the App Store rankings database",
  {
    query: z.string().describe("Search query (app name or developer name)"),
    limit: z.number().min(1).max(50).default(10).describe("Number of results"),
  },
  async ({ query, limit }) => {
    const data = await fetchAPI("/apps/search", { q: query, limit });
    if (!data.items.length) return { content: [{ type: "text", text: `No apps found for "${query}"` }] };
    const lines = data.items.map(
      (a) => `${a.name} (ID: ${a.id}) — ${a.developerName || "Unknown"} — ${a.primaryGenre || ""} — ${a.averageRating ? `${a.averageRating.toFixed(1)}★ (${a.ratingCount?.toLocaleString()} ratings)` : "No ratings"} — ${a.price ? `$${a.price.toFixed(2)}` : "Free"}`
    );
    return { content: [{ type: "text", text: `Found ${data.count} apps for "${query}":\n\n${lines.join("\n")}` }] };
  }
);

// Get app detail with rankings
server.tool(
  "get_app",
  "Get detailed information about an app including its current rankings across all countries and platforms",
  {
    id: z.number().describe("App ID (numeric Apple ID)"),
  },
  async ({ id }) => {
    const app = await fetchAPI(`/apps/${id}`);
    let text = `**${app.name}**\n`;
    text += `Developer: ${app.developerName || "Unknown"}\n`;
    text += `Genre: ${app.primaryGenre || "Unknown"}\n`;
    text += `Price: ${app.formattedPrice || (app.price ? `$${app.price.toFixed(2)}` : "Free")}${app.hasIAP ? " (has In-App Purchases)" : ""}\n`;
    text += `Rating: ${app.averageRating ? `${app.averageRating.toFixed(1)}★ (${app.ratingCount?.toLocaleString()} ratings)` : "No ratings"}\n`;
    text += `Version: ${app.currentVersion || "Unknown"}`;
    if (app.currentVersionReleaseDate) text += ` (released ${new Date(app.currentVersionReleaseDate).toLocaleDateString()})`;
    text += "\n";
    if (app.fileSizeBytes) text += `Size: ${(app.fileSizeBytes / 1024 / 1024).toFixed(1)} MB\n`;
    if (app.contentRating) text += `Content Rating: ${app.contentRating}\n`;
    text += `Bundle ID: ${app.bundleId || "Unknown"}\n`;
    if (app.sellerUrl) text += `Website: ${app.sellerUrl}\n`;
    text += `App Store: https://apps.apple.com/app/id${id}\n`;

    if (app.currentRankings?.length) {
      text += `\nCurrent Rankings (${app.currentRankings.length} entries):\n`;
      for (const r of app.currentRankings.slice(0, 20)) {
        const ranks = [];
        if (r.rankFree) ranks.push(`#${r.rankFree} Free`);
        if (r.rankPaid) ranks.push(`#${r.rankPaid} Paid`);
        if (r.rankGrossing) ranks.push(`#${r.rankGrossing} Grossing`);
        text += `  ${r.countryCode.toUpperCase()} / ${r.platform} / ${r.categoryName}: ${ranks.join(", ")}\n`;
      }
      if (app.currentRankings.length > 20) text += `  ... and ${app.currentRankings.length - 20} more\n`;
    }

    if (app.description) {
      text += `\nDescription:\n${app.description.slice(0, 500)}${app.description.length > 500 ? "..." : ""}\n`;
    }

    return { content: [{ type: "text", text }] };
  }
);

// Get ranking history
server.tool(
  "get_rank_history",
  "Get ranking history for an app over time in a specific country, platform, chart, and category",
  {
    id: z.number().describe("App ID"),
    country: z.string().default("us").describe("Country code"),
    platform: z.enum(["iphone", "ipad", "mac", "tv"]).default("iphone").describe("Platform"),
    chart: z.enum(["topFree", "topPaid", "topGrossing"]).default("topFree").describe("Chart type"),
    category: z.number().optional().describe("Category ID (default: 36 = All)"),
    days: z.number().min(1).max(365).default(30).describe("Number of days of history"),
  },
  async ({ id, country, platform, chart, category, days }) => {
    const data = await fetchAPI(`/apps/${id}/history`, { country, platform, chart, category, days });
    if (!data.items.length) return { content: [{ type: "text", text: "No ranking history found for these parameters." }] };
    const lines = data.items.map(
      (e) => `${new Date(e.capturedAt).toLocaleDateString()} ${new Date(e.capturedAt).toLocaleTimeString()}: #${e.position}`
    );
    return { content: [{ type: "text", text: `Ranking history (${data.count} data points, last ${days} days):\n\n${lines.join("\n")}` }] };
  }
);

// Get app reviews
server.tool(
  "get_reviews",
  "Get recent App Store reviews for an app in a specific country",
  {
    id: z.number().describe("App ID"),
    country: z.string().default("us").describe("Country code for reviews"),
  },
  async ({ id, country }) => {
    const data = await fetchAPI(`/apps/${id}/reviews`, { country });
    if (!data.items.length) return { content: [{ type: "text", text: "No reviews found." }] };
    const lines = data.items.slice(0, 20).map(
      (r) => `${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)} "${r.title}" by ${r.author}${r.version ? ` (v${r.version})` : ""}\n  ${r.content.slice(0, 200)}${r.content.length > 200 ? "..." : ""}`
    );
    return { content: [{ type: "text", text: `Reviews for ${country.toUpperCase()} (${data.count} total):\n\n${lines.join("\n\n")}` }] };
  }
);

// List available countries
server.tool(
  "list_countries",
  "List all available countries for App Store rankings",
  {},
  async () => {
    const data = await fetchAPI("/meta/countries");
    const lines = data.items.map((c) => `${c.code} — ${c.name}`);
    return { content: [{ type: "text", text: `Available countries (${data.count}):\n\n${lines.join("\n")}` }] };
  }
);

// List categories
server.tool(
  "list_categories",
  "List all available App Store categories with their IDs",
  {},
  async () => {
    const data = await fetchAPI("/meta/categories");
    const lines = data.items.map((c) => `${c.id} — ${c.name}`);
    return { content: [{ type: "text", text: `Available categories:\n\n${lines.join("\n")}` }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
