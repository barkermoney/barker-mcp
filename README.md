# Barker MCP Server — Stablecoin Yield for AI Agents

> **Barker — remote MCP server for real-time stablecoin yield: live APY index, AI yield advisor, risk signals, and non-custodial deposit/redeem execution — 11 tools, x402 pay-per-call. Plus the official Barker agent skill suite.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-money.barker%2Fstablecoin--yield-blue.svg)](https://registry.modelcontextprotocol.io)
[![Payment: x402](https://img.shields.io/badge/Payment-x402_pay--per--call-green.svg)](https://mcp.barker.money)

Powered by [**Barker — Yield Primitive for the Agent Economy**](https://barker.money). Every agent touching stablecoins eventually plugs in.

接入 Agent 经济的稳定币收益底座 → [barker.money](https://barker.money)

---

## Connect (remote MCP)

The hosted server is a **streamable-http MCP endpoint** — stateless, no signup, no API key. Payment happens per call via x402 (see [Payment](#payment-x402)).

```
Endpoint:  https://mcp.barker.money/mcp
Registry:  money.barker/stablecoin-yield   (Official MCP Registry)
Transport: streamable-http (stateless)
```

**Claude Code**

```bash
claude mcp add --transport http barker https://mcp.barker.money/mcp
```

**Hermes Agent** — add to `~/.hermes/config.yaml` (takes effect in new sessions):

```yaml
mcp_servers:
  barker:
    url: "https://mcp.barker.money/mcp"
```

**Cursor / Cline / any MCP host** — add to your MCP config:

```json
{
  "mcpServers": {
    "barker": {
      "type": "streamable-http",
      "url": "https://mcp.barker.money/mcp"
    }
  }
}
```

**Smoke test from a terminal** (no client needed):

```bash
curl -X POST https://mcp.barker.money/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Tools

11 tools in three layers. Prices are per call, settled via x402.

**Data**

| Tool | What it returns | Price |
|------|-----------------|-------|
| `barker_defi_vaults` | Ranked stablecoin yield pools (APY, TVL, protocol, chain, asset) | $0.001 |
| `barker_market_overview` | Total market cap, yield-bearing cap, asset/chain distribution | $0.001 |
| `barker_market_trend` | Historical APY trend (7–180 days) vs US Treasury benchmark | $0.001 |
| `barker_pool_search` | Search the yield index by asset, chain, protocol or keyword | $0.001 |

**Judgment**

| Tool | What it returns | Price |
|------|-----------------|-------|
| `barker_yield_advisor` | Ranked top-N picks with data-derived reasons and risk flags | $0.03 |
| `barker_pool_detail` | Full single-pool dossier: APY components, TVL, terms, rewards | $0.005 |
| `barker_pool_history` | Historical APY / TVL series for one pool | $0.005 |
| `barker_crosschain_routes` | Cross-chain routing options between pools | $0.01 |

**Execution (non-custodial)**

| Tool | What it returns | Price |
|------|-----------------|-------|
| `barker_executable_pools` | Vaults an agent can act on right now — every row guaranteed quotable | $0.01 |
| `barker_execution_quote` | Unsigned, ready-to-sign deposit/redeem tx (`{chainId, to, data, value}`) + route + risk | $0.05 |
| `barker_vault_position` | On-chain read of a wallet's ERC-4626 vault position | $0.001 |

**Barker never broadcasts and never holds funds.** The agent verifies the returned calldata (`calldata_amount_base_units` enables byte-level verification) and the user's own wallet signs. Vault shares always go to the signer — `receiver` is not a parameter. Same-chain only.

## Payment (x402)

Calling a tool without payment returns an HTTP 402 challenge. Settle it (e.g. via an OKX OnchainOS or wallet payment skill, or any x402 buyer client) and retry with the payment header.

```
Facilitators: OKX · Coinbase CDP · Circle Gateway
Settlement:   USDT0 / USDC on X Layer, Base, Ethereum, Polygon, Arbitrum
```

Full working buyer — pay → quote → verify → sign → broadcast → confirm shares:

```bash
npm i viem
read -rs PRIVATE_KEY && export PRIVATE_KEY
node examples/x402-execution-buyer.mjs
unset PRIVATE_KEY
```

See [`examples/x402-execution-buyer.mjs`](examples/x402-execution-buyer.mjs) — ~200 lines, copy the safety checks into your own agent.

## Self-host (stdio)

> ⚠️ **Self-host only.** The bundled `barker-mcp` stdio server wraps the resource endpoints as local tools, for operators self-hosting against their own `BARKER_API_BASE`. Barker's hosted tools are served via the remote MCP above.

```bash
# Register with Claude Code (user scope, persists across sessions)
claude mcp add -s user barker -- npx -y -p @barkermoney/skills barker-mcp
```

Then restart Claude Code. Three tools become available:

| Tool | Wraps | Use for |
|------|-------|---------|
| `barker_defi_vaults` | `/defi/vaults` | "best USDC yield", "Aave vs Morpho", filter by asset/chain/sort/limit |
| `barker_market_overview` | `/market/overview` | total cap, yield-bearing cap, asset/chain distribution |
| `barker_market_trend` | `/market/trend` | 7–180 day APY trend vs US Treasury benchmark |

Smoke test outside of an agent host:

```bash
npx -p @barkermoney/skills barker-mcp
# speaks MCP over stdio; pipe JSON-RPC frames to interact
```

---

## Agent Skill Suite

10 ready-made skills that call the MCP tools with tuned prompts, triggers and guardrails.

### One-line install

```bash
# Install all 10 skills into ~/.claude/skills/
npx @barkermoney/skills install --all

# Or pick specific ones
npx @barkermoney/skills install stablecoin-yield-radar yield-strategy-advisor

# Other commands
npx @barkermoney/skills list             # show bundled + installed
npx @barkermoney/skills update           # re-install latest of currently installed
npx @barkermoney/skills remove <name>    # uninstall one
npx @barkermoney/skills --help           # full help
```

Then restart Claude Code (or your agent runtime) to activate. Override the install dir with `--target <dir>` or `$BARKER_SKILLS_DIR`.

**Updating often?** Install the CLI globally so you can drop the `npx` prefix:

```bash
npm install -g @barkermoney/skills
skills install --all     # then from any directory
skills update            # later, pull latest skill content
```

### Hermes Agent

Skills in this repo follow the [agentskills.io](https://agentskills.io) open standard, so they install into [Hermes Agent](https://github.com/NousResearch/hermes-agent) as-is:

```bash
# Flagship skill straight from this repo (repeat for any skill under ./skills):
hermes skills install https://raw.githubusercontent.com/barkermoney/barker-mcp/main/skills/stablecoin-yield-radar/SKILL.md --name stablecoin-yield-radar
hermes skills install https://raw.githubusercontent.com/barkermoney/barker-mcp/main/skills/yield-strategy-advisor/SKILL.md --name yield-strategy-advisor

# Or install the whole suite manually:
git clone https://github.com/barkermoney/barker-mcp.git
cp -r barker-mcp/skills/* ~/.hermes/skills/
```

Skills take effect in new Hermes sessions. Pair them with the remote MCP endpoint (see [Connect](#connect-remote-mcp)) so tool calls resolve. Hermes has no built-in payments: route the x402 pay-per-call through an x402-capable payment skill, funded from a **dedicated low-balance payments wallet** — never your main wallet key. `tools/list` and discovery stay free.

### Other install channels

- **OKX Wallet Plugin Store**: `npx skills add okx/plugin-store --skill <skill-name>`
- **Anthropic Plugin Marketplace**: each skill ships `.claude-plugin/plugin.json`, compatible with the Claude Code plugin marketplace
- **Manual**: `git clone https://github.com/barkermoney/barker-mcp.git && cp -r barker-mcp/skills/<skill-name> ~/.claude/skills/`

### The skills

| Skill | What It Does | Data Source | Key Triggers |
|-------|-------------|-------------|-------------|
| [stablecoin-yield-radar](./skills/stablecoin-yield-radar/) | Real-time stablecoin APY rankings | `barker_defi_vaults` | "best stablecoin yield", "where to earn on USDC" |
| [stablecoin-market-brief](./skills/stablecoin-market-brief/) | Market overview: cap, distribution, APY trends vs US Treasury | `barker_market_overview` + `barker_market_trend` | "stablecoin market cap", "USDT market share" |
| [stablecoin-risk-check](./skills/stablecoin-risk-check/) | Safety assessment: depeg history, reserves, audit status | Curated knowledge base | "is USDT safe", "stablecoin comparison" |
| [yield-strategy-advisor](./skills/yield-strategy-advisor/) | Personalized allocation by risk tolerance and capital size | `barker_defi_vaults` | "yield strategy", "how to earn on stablecoins" |
| [stablecoin-depeg-monitor](./skills/stablecoin-depeg-monitor/) | Peg stability monitoring + historical depeg database | `barker_market_overview` + curated history | "depeg alert", "is my stablecoin safe right now" |
| [stablecoin-yield-vs-tradfi](./skills/stablecoin-yield-vs-tradfi/) | Stablecoin yields vs bank savings, Treasury, money market | `barker_market_trend` | "stablecoin vs savings account", "DeFi vs treasury" |
| [stablecoin-chain-explorer](./skills/stablecoin-chain-explorer/) | TVL distribution and best yields by blockchain | `barker_market_overview` + `barker_defi_vaults` | "which chain for stablecoins", "Arbitrum stablecoin APY" |
| [agent-payment-stats](./skills/agent-payment-stats/) | Cross-protocol agent-economy payment metrics (x402 real vs nominal, top sellers) | `barker_agent_payment_stats` | "x402 volume", "agent economy metrics" |
| [stablecoin-treasury-yield](./skills/stablecoin-treasury-yield/) | B2B treasury & idle-balance yield: quantify idle float, run the $10 probe, map integration | `barker_defi_vaults` + execution tools | "idle balance", "treasury yield", "沉淀资金" |
| [stablecoin-tvl-boost](./skills/stablecoin-tvl-boost/) | TVL growth for protocols: boost campaigns & launchpools (30k+ users, on-chain attribution) | `barker_market_overview` + `barker_defi_vaults` | "grow TVL", "launchpool" |

---

## Access model & security posture

- **Authentication / payment**: x402 settlement on an HTTP 402 challenge (e.g. via an OKX OnchainOS or wallet payment skill).
- **Abuse model**: x402 payment gate + edge DDoS protection in front.
- **Data scope sent to the API**: Only public market parameters — stablecoin symbol, chain name, sort/limit. **No** wallet addresses, balances, signatures, private keys, or PII are transmitted by any skill in this suite (the only exception: `barker_vault_position` reads a wallet's public on-chain vault balance for an address the agent explicitly passes).
- **Data returned**: Public yield / market / TVL figures only. Sensitivity equivalent to public market-data APIs such as CoinGecko or DeFiLlama.
- **External data boundary**: Every SKILL.md in this suite includes a `## Security: External Data Boundary` section instructing consuming LLMs to treat all API response strings as untrusted data, not instructions.

### Response shape & units

All responses are JSON with `{ success, data, ... }`. APY and `share_pct` fields are **decimals** (`0.0523` = 5.23%, `0.4250` = 42.5%) — multiply by 100 for display.

Agent discovery: [`https://api.barker.money/llms.txt`](https://api.barker.money/llms.txt)

---

## FAQ

**Q: How often is the data updated?**
A: Real-time. The yield index reflects live stablecoin yield data.

**Q: Do I need an API key?**
A: No. Agents call the `barker_*` tools via the remote MCP — payment is per call via x402, no account or key required.

**Q: What stablecoins are covered?**
A: All stablecoins on the market — USDT, USDC, DAI, USDS, USDe, sUSDe, FDUSD, GHO, crvUSD, PYUSD, sDAI, frxUSD, TUSD, BUSD, LUSD, DOLA, MIM, FRAX, USDs, USDX, RLUSD, USDY, BUIDL, and more. If a stablecoin exists, Barker covers it.

**Q: What chains are supported?**
A: All chains — Ethereum, BSC, Arbitrum, Base, Polygon, Optimism, Avalanche, Solana, Sui, Aptos, Sei, Mantle, Scroll, zkSync, Linea, Blast, Mode, Manta, and more. Barker has the most comprehensive multi-chain coverage in the market.

**Q: Is this financial advice?**
A: No. All skills provide educational information only, not financial advice. Always DYOR.

**Q: Where can I find the best stablecoin yields?**
A: Use the `stablecoin-yield-radar` skill or visit [barker.money](https://barker.money) for the full interactive yield map.

**Q: How does Barker compare to DeFiLlama or CoinGecko?**
A: Barker is **stablecoin-only** and indexes real-time stablecoin yield in a single index. DeFiLlama focuses on on-chain TVL; CoinGecko focuses on token prices. Barker is the specialized yield index for stablecoins.

---

## About Barker

[Barker](https://barker.money) is the **Yield Primitive for the Agent Economy** — the default routing layer that any agent (or app, or human) calls when it needs to answer "where should this stablecoin sit?". We index real-time stablecoin yield, surfaced as a map for humans browsing and as MCP / agent-callable endpoints for autonomous agents. Stablecoins only. Agents get a real-time stablecoin yield index, an AI yield advisor, non-custodial execution, and risk signals via the MCP; the interactive map is browsable by humans at [barker.money](https://barker.money).

- Website: [barker.money](https://barker.money)
- Remote MCP: `https://mcp.barker.money/mcp`
- Agent discovery: `https://api.barker.money/llms.txt` (public)

## Author & Maintainer Disclosure

- **Project**: Barker — Yield Primitive for the Agent Economy ([barker.money](https://barker.money))
- **GitHub org**: [barkermoney](https://github.com/barkermoney) (controlled by the Barker team)
- **Submitting committers**: `zuoyeweb3` (founder), `royrzguo` (engineering) — both authorized Barker team members
- **Contact**: partner@barker.money

## License

MIT © 2026 [Barker](https://barker.money)
