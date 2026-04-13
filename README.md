# AppRanks MCP Server

An MCP (Model Context Protocol) server that provides live App Store rankings data from [AppRanks.app](https://appranks.app).

Browse charts, search apps, view rankings, read reviews — all from your AI assistant.

## Tools

| Tool | Description |
|------|-------------|
| `get_chart` | Browse App Store charts (top free, paid, grossing) by country, platform, category |
| `search_apps` | Search apps by name or developer |
| `get_app` | Get app details with current rankings across all countries |
| `get_rank_history` | View ranking history over time |
| `get_reviews` | Read App Store reviews by country |
| `list_countries` | List all 55 supported countries |
| `list_categories` | List all App Store categories with IDs |

## Coverage

- **55 countries** across Americas, Europe, Middle East, Africa, and Asia Pacific
- **4 platforms**: iPhone, iPad, Mac, Apple TV
- **43 categories** including game subcategories
- **3 chart types**: Top Free, Top Paid, Top Grossing
- Updated every 4 hours

## Setup

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "appranks": {
      "command": "npx",
      "args": ["-y", "@appranks.app/mcp-server"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add appranks -- npx -y @appranks.app/mcp-server
```

### Manual

```bash
npx @appranks.app/mcp-server
```

## Examples

Ask your AI assistant:

- "What are the top 10 free iPhone apps in Japan?"
- "Search for weather apps"
- "Show me Netflix's rankings across all countries"
- "What's the ranking history for Spotify in the US over the last 30 days?"
- "Show me 1-star reviews for TikTok in Germany"

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `APPRANKS_API_URL` | `https://appranks.app/api/v1` | API base URL |

## License

MIT
