/**
 * Receive-only Nano (XNO) settlement verifier for the paid tool.
 *
 * Optionally settles `deploy.preview` (and any other paid tool) by verifying a settled
 * Nano send on-chain, so an agent can pay feeless in XNO instead of (or beside) the USD
 * spend control. Keyless: reads the settled block over a public Nano RPC and checks the
 * amount — no private key is held, no gas, no facilitator.
 *
 * Decoding matches Nano's 30-decimal raw floor: 1 XNO = 10^30 raw.
 */
const XNO_TO_RAW = 10n ** 30n;

export interface NanoPayment {
  /** Nano address of the payer (nano_... or xrb_...). */
  account: string;
  /** Exact nano raw amount to require (decimal string). */
  amountRaw: string;
}

export interface NanoVerifyOpts {
  /** Board hash of the settled Nano send block. */
  blockHash: string;
  /** axios/fetch-compatible function; injectable for tests. Default is globalThis.fetch. */
  fetchImpl?: typeof fetch;
  /** Nano RPC endpoint. Defaults to the public rpc.nano.to endpoint. */
  rpcUrl?: string;
  /** Optional raw amount the block must equal/exceed; if omitted, any settled block passes. */
  minAmountRaw?: string;
}

function toRaw(xno: string): bigint {
  const s = xno.trim();
  const [whole = "0", frac = ""] = s.split(".");
  if (frac.length > 30) {
    throw new Error(`more than 30 decimal places: ${xno}`);
  }
  const fracPadded = (frac + "0".repeat(30)).slice(0, 30);
  return BigInt(whole || "0") * XNO_TO_RAW + BigInt(fracPadded || "0");
}

function toRawString(xnoRaw: bigint): string {
  return xnoRaw.toString();
}

/**
 * Verify a settled Nano block by hash. Returns true only if a live node confirms the
 * block exists and its amount meets (or exceeds) the requirement. Fails closed: any
 * node error, missing block, or short amount returns false.
 */
export async function verifyNanoPayment(opts: NanoVerifyOpts): Promise<boolean> {
  const fetchFn = opts.fetchImpl ?? globalThis.fetch;
  if (!fetchFn) {
    throw new Error("no fetch implementation available");
  }
  const rpcUrl = opts.rpcUrl ?? "https://rpc.nano.to";
  const body = JSON.stringify({
    action: "block_info",
    json_block: "true",
    hash: opts.blockHash,
  });

  let res: Response;
  try {
    res = await fetchFn(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch {
    return false;
  }
  if (!res || !res.ok) {
    return false;
  }
  let data: Record<string, unknown>;
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    return false;
  }
  // A block_info call errors when the block is unknown.
  if (data.error !== undefined) {
    return false;
  }
  // amount and confirmed live at the top level of block_info on the nodes we target;
  // some nodes report `confirmed` as the string "true".
  const confirmed = data.confirmed;
  const confirmedOk = confirmed === true || confirmed === "true";
  if (data.amount === undefined || !confirmedOk) {
    return false;
  }
  const amountRaw = BigInt(String(data.amount));
  if (opts.minAmountRaw !== undefined) {
    return amountRaw >= BigInt(opts.minAmountRaw);
  }
  return amountRaw > 0n;
}

/** Convenience: require a minimum amount in XNO (decimal string). */
export async function verifyNanoPaymentXno(
  opts: Omit<NanoVerifyOpts, "minAmountRaw"> & { minAmountXno?: string },
): Promise<boolean> {
  const { minAmountXno, ...rest } = opts;
  const minRaw = minAmountXno !== undefined ? toRawString(toRaw(minAmountXno)) : undefined;
  return verifyNanoPayment({ ...rest, minAmountRaw: minRaw });
}

export { XNO_TO_RAW, toRaw, toRawString };
