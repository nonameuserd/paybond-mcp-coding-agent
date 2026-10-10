# paybond-mcp-coding-agent

MCP coding agent (read-only + one paid tool). Clone, log in to Paybond sandbox, and run smoke in under a minute.

## Quickstart (60 seconds)

```bash
git clone https://github.com/nonameuserd/paybond-mcp-coding-agent.git
cd paybond-mcp-coding-agent
cp .env.example .env.local
paybond login
npm install
npm run smoke
```

## Run the demo

```bash
npm start
```

## MCP host wiring

```bash
paybond login
paybond mcp install --host claude --tool-policy spend-write
paybond mcp verify-config --host claude
```

Read-only tools pass through; side-effecting tools require Harbor authorization.

## Policy

Local `paybond.policy.yaml` is yours to edit. Bundled preset: **custom**.

## Docs

- [Agent quickstart](https://paybond.ai/docs/kit/quickstart-agent)
- [Agent middleware](https://paybond.ai/docs/kit/agent-middleware)

## Optional: feeless Nano (XNO) settlement for paid tools

`src/nano.ts` is a small, optional, receive-only Nano (XNO) settlement verifier. Where the
USD spend control settles cost in a flat currency, `verifyNanoPayment` lets an agent settle a
paid tool call on-chain in feeless, sub-second XNO instead (or as well):

```ts
import { verifyNanoPaymentXno } from "./nano.js";

const settled = await verifyNanoPaymentXno({
  blockHash,        // the agent's settled Nano send block
  minAmountXno: "0.1", // require at least 0.1 XNO
});
if (!settled) throw new Error("payment not verified");
```

Keyless: it reads the settled block over a public Nano RPC and checks the amount — no private
key is held, no gas, no facilitator. Verification is fail-closed (a node error or a short
amount returns `false`). Tests (Node's built-in `node:test`, no network) run against the
compiled output: `npm run build`, then `npm test`.

