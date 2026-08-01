#!/usr/bin/env node
// barker-mcp — legacy stdio MCP server (self-host only).
//
// For agent integrations, point your agent at Barker's MCP at
// https://mcp.barker.money (the barker_* tools; discover via this repo's
// llms.txt / SKILL.md). This stdio server is retained only for operators
// self-hosting against their own BARKER_API_BASE.
//
// Exposes the stablecoin-yield tool surface (resource-domain endpoints,
// no version/audience markers):
//   - barker_defi_vaults          → /defi/vaults
//   - barker_market_overview      → /market/overview
//   - barker_market_trend         → /market/trend
//   - barker_pool_search          → /agent-tools/pool_search
//   - barker_pool_detail          → /agent-tools/pool_detail
//   - barker_pool_history         → /agent-tools/pool_history
//   - barker_crosschain_routes    → /agent-tools/crosschain_routes
//   - barker_yield_advisor        → /agent-tools/yield_advisor
//   - barker_agent_payment_stats  → /agent-payments/{summary|trend|leaderboard}
//
// All APY/share_pct fields in responses are decimals (0.0523 = 5.23%).
// Base override: set BARKER_API_BASE (default https://api.barker.money/api).
//
// ⚠️ barker.money's hosted API no longer serves anonymous callers: the yield
// endpoints answer 401 unless the caller is a paid agent (x402 via
// mcp.barker.money) or the Barker app. So against the default base only
// barker_agent_payment_stats works. This server is for operators pointing
// BARKER_API_BASE at their own Barker backend, where the whole set works.
// callBarker() turns that 401 into an actionable message instead of a bare
// "Unauthorized" so a misconfigured install says what to do next.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_BASE = (process.env.BARKER_API_BASE || "https://api.barker.money/api").replace(/\/+$/, "");
const VERSION = "0.4.0";
const USER_AGENT = `barker-mcp/${VERSION} (+https://barker.money)`;

const TOOLS = [
  {
    name: "barker_defi_vaults",
    description:
      "Query real-time stablecoin supply yield pools from Barker's index of 500+ DeFi protocols. " +
      "Returns ranked rows with protocol_name, chain_name, asset_symbol, supply_apy_total (decimal — multiply by 100 for %), and supply_tvl (USD). " +
      "Use for questions like 'best stablecoin yield', 'where to earn on USDC', 'compare lending rates', '稳定币利率'.",
    inputSchema: {
      type: "object",
      properties: {
        asset: {
          type: "string",
          description:
            "Stablecoin symbol (lowercase): usdt, usdc, dai, usde, usds, fdusd, gho, crvusd, pyusd, sdai, frxusd, tusd, lusd, dola, mim, frax, etc.",
        },
        chain: {
          type: "string",
          description:
            "Chain name (lowercase): ethereum, bsc, arbitrum, base, polygon, optimism, avalanche, solana, sui, aptos, sei, mantle, scroll, zksync, linea, blast, mode, manta, etc.",
        },
        sort: {
          type: "string",
          enum: ["apy", "tvl"],
          description: "Sort key — default 'apy'",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          description: "Row count — default 50, max 100",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "barker_market_overview",
    description:
      "Barker's stablecoin market snapshot: total market cap, yield-bearing cap, asset distribution, chain distribution. " +
      "Use for 'stablecoin market cap', 'USDT market share', '稳定币市场份额'. " +
      "share_pct fields are decimals (0.425 = 42.5%).",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "barker_market_trend",
    description:
      "Barker's historical APY trend for stablecoins vs. US Treasury benchmark over a lookback window (7–180 days). " +
      "Use for 'DeFi vs treasury', 'is stablecoin APY going up', 'crypto yield trend', '稳定币利率走势'.",
    inputSchema: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          minimum: 7,
          maximum: 180,
          description: "Lookback window in days — default 30",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "barker_pool_search",
    description:
      "Fuzzy search Barker's pool index by keyword (protocol name / pool name / asset). " +
      "Resolves natural-language pool references to a pool_uid for the detail/history tools. " +
      "Read-only. Use for 'find the morpho usdc vault', '搜一下 aave 的池子'.",
    inputSchema: {
      type: "object",
      properties: {
        keyword: {
          type: "string",
          description: "Free-text query — protocol name, pool name or asset symbol",
        },
        limit: { type: "integer", minimum: 1, maximum: 50, description: "Row count — default 10" },
      },
      required: ["keyword"],
      additionalProperties: false,
    },
  },
  {
    name: "barker_pool_detail",
    description:
      "Full single-pool dossier from Barker's index by pool_uid: all APY components (percent unit), TVL, " +
      "terms, execution capability, reward breakdown. Read-only. " +
      "Use after barker_defi_vaults / barker_yield_advisor to inspect one pool.",
    inputSchema: {
      type: "object",
      properties: {
        pool_uid: {
          type: "string",
          description: "Pool uid from barker_defi_vaults / barker_pool_search",
        },
      },
      required: ["pool_uid"],
      additionalProperties: false,
    },
  },
  {
    name: "barker_pool_history",
    description:
      "Per-pool APY/TVL time series from Barker's index (APY percent unit) for trend and volatility " +
      "analysis of one pool_uid. Read-only. Use for 'is this pool's APY stable', '这个池子收益稳不稳'.",
    inputSchema: {
      type: "object",
      properties: {
        pool_uid: { type: "string", description: "Pool uid from the list/search tools" },
        days: {
          type: "integer",
          minimum: 7,
          maximum: 180,
          description: "Lookback window in days — default 30",
        },
      },
      required: ["pool_uid"],
      additionalProperties: false,
    },
  },
  {
    name: "barker_crosschain_routes",
    description:
      "Barker's cross-chain route availability for a stablecoin from a given chain (bridge/venue coverage). " +
      "Read-only — returns route options, never executes or bridges anything. " +
      "Use for 'bridge USDC from arbitrum', '跨链路径'.",
    inputSchema: {
      type: "object",
      properties: {
        from_chain: { type: "string", description: "Origin chain (lowercase), e.g. arbitrum" },
        symbol: { type: "string", description: "Stablecoin symbol (lowercase), e.g. usdc" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "barker_yield_advisor",
    description:
      "FLAGSHIP: 'Where should I park my stablecoins right now?' Returns a ranked top-N recommendation " +
      "across Barker's DeFi yield index (500+ protocols) with data-derived reasons and risk flags per pick " +
      "(APY vs market median, TVL depth, incentive-dependence, lock terms). Advisory and read-only — " +
      "it recommends, it never moves funds. " +
      "Use for 'best place for my USDC', '钱放哪收益最好', 'recommend stablecoin yield with low risk'. " +
      "APY unit here is percent (6.2 = 6.2%).",
    inputSchema: {
      type: "object",
      properties: {
        asset: { type: "string", description: "Stablecoin symbol (lowercase): usdt, usdc, dai, usde, ..." },
        chain: { type: "string", description: "Optional chain filter (lowercase)" },
        risk: {
          type: "string",
          enum: ["conservative", "balanced", "aggressive"],
          description: "Risk band → TVL floor $10M / $1M / $100K — default balanced",
        },
        min_tvl: { type: "number", description: "Optional explicit TVL floor (USD)" },
        limit: { type: "integer", minimum: 1, maximum: 20, description: "Top-N picks — default 5" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "barker_agent_payment_stats",
    description:
      "Agent-economy payment metrics from Barker's cross-protocol index. x402 (Base) is on-chain verifiable; " +
      "Virtuals ACP, Google AP2, Stripe-Tempo MPP, OKX MPP, and Mastercard AP4M are self-reported claims. " +
      "Separates real vs nominal volume by filtering out wash/noise sellers (avg_tx_usd < $0.02 with a very high tx-per-buyer ratio). " +
      "Three views: 'summary' (hero KPIs + cross-protocol comparison table), 'trend' (daily tx / nominal & real volume / buyers), " +
      "'leaderboard' (top x402 sellers/endpoints by revenue). " +
      "Use for 'x402 volume', 'agent payment stats', 'agent economy metrics', 'how big is x402', 'top x402 sellers', 'real vs nominal agent GMV', '智能体支付', 'x402 交易量'. " +
      "All *_share_pct and noise_share_pct fields are percentages (77.0 = 77%); volume fields are USD.",
    inputSchema: {
      type: "object",
      properties: {
        view: {
          type: "string",
          enum: ["summary", "trend", "leaderboard"],
          description:
            "Which view — 'summary' (default): hero KPIs + protocol comparison; 'trend': daily time series; 'leaderboard': top sellers.",
        },
        days: {
          type: "integer",
          minimum: 1,
          maximum: 90,
          description: "Trend window in days (view=trend only) — default 30, max 90",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          description: "Row count (view=leaderboard only) — default 20, max 100",
        },
        sort: {
          type: "string",
          enum: ["volume", "tx"],
          description: "Leaderboard sort key (view=leaderboard only) — 'volume' (default) or 'tx'",
        },
      },
      additionalProperties: false,
    },
  },
];

async function callBarker(path, params) {
  const url = new URL(API_BASE + path);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok) {
    // 401/402 against the hosted API means "you are not a paid agent", not a bug
    // in the caller's arguments — say what to do instead of echoing Unauthorized.
    if ((res.status === 401 || res.status === 402) && API_BASE.includes("api.barker.money")) {
      throw new Error(
        `Barker's hosted API does not serve anonymous callers (HTTP ${res.status}). ` +
          `Either connect your agent to the hosted MCP at https://mcp.barker.money/mcp ` +
          `(pay-per-call via x402, no signup), or set BARKER_API_BASE to your own Barker ` +
          `backend to use this stdio server. barker_agent_payment_stats is the one tool ` +
          `here that works without either.`
      );
    }
    throw new Error(
      `Barker API ${res.status} ${res.statusText} — ${text.slice(0, 200)}`
    );
  }
  return text; // pass JSON string through; the LLM consumer parses it
}

const server = new Server(
  { name: "barker-mcp", version: VERSION },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    let body;
    switch (name) {
      case "barker_defi_vaults":
        body = await callBarker("/defi/vaults", args);
        break;
      case "barker_market_overview":
        body = await callBarker("/market/overview", {});
        break;
      case "barker_market_trend":
        body = await callBarker("/market/trend", args);
        break;
      case "barker_pool_search":
        body = await callBarker("/agent-tools/pool_search", args);
        break;
      case "barker_pool_detail":
        body = await callBarker("/agent-tools/pool_detail", args);
        break;
      case "barker_pool_history":
        body = await callBarker("/agent-tools/pool_history", args);
        break;
      case "barker_crosschain_routes":
        body = await callBarker("/agent-tools/crosschain_routes", args);
        break;
      case "barker_yield_advisor":
        body = await callBarker("/agent-tools/yield_advisor", args);
        break;
      case "barker_agent_payment_stats": {
        const view = args.view || "summary";
        if (view === "trend") {
          body = await callBarker("/agent-payments/trend", { days: args.days });
        } else if (view === "leaderboard") {
          body = await callBarker("/agent-payments/leaderboard", {
            limit: args.limit,
            sort: args.sort,
          });
        } else {
          body = await callBarker("/agent-payments/summary", {});
        }
        break;
      }
      default:
        return {
          content: [{ type: "text", text: `Error: unknown tool '${name}'` }],
          isError: true,
        };
    }
    return { content: [{ type: "text", text: body }] };
  } catch (err) {
    return {
      content: [
        { type: "text", text: `Error calling Barker API: ${err.message}` },
      ],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
// Log to stderr so it does not pollute the stdio MCP transport on stdout.
process.stderr.write(
  `barker-mcp v${VERSION} — connected (api: ${API_BASE})\n` +
    `⚠️  DEPRECATED: this stdio server wraps Barker's legacy anonymous API, which is being retired ` +
    `(calls will 401 once anonymous access is off). Live data is served via the paid x402 MCP at ` +
    `https://mcp.barker.money — point your agent there. Self-host only via BARKER_API_BASE.\n`
);
