import assert from "node:assert/strict";
import test from "node:test";
import { toRaw, toRawString, verifyNanoPayment, verifyNanoPaymentXno, XNO_TO_RAW } from "../dist/nano.js";

// Shared canned block_info payload the fake node returns for a settled 0.1 XNO send.
const settledBlock = {
  amount: "100000000000000000000000000000",
  confirmed: true,
};

// Build a fetch stub that serves block_info from a canned response.
function fakeNode(response) {
  async function fn() {
    return {
      ok: true,
      async json() {
        return response;
      },
    };
  }
  return fn;
}

test("toRaw decodes 30-decimal Nano amounts", () => {
  assert.equal(toRaw("1"), XNO_TO_RAW);
  assert.equal(toRaw("0.1"), 100000000000000000000000000000n);
  assert.equal(toRaw("0.000000000000000000000000000001"), 1n);
});

test("toRaw rejects more than 30 decimal places", () => {
  assert.throws(() => toRaw("0.0000000000000000000000000000001"));
});

test("toRawString round-trips", () => {
  assert.equal(toRawString(toRaw("0.25")), "250000000000000000000000000000");
});

test("verifyNanoPayment returns true when amount meets requirement", async () => {
  const ok = await verifyNanoPayment({
    blockHash: "abc",
    minAmountRaw: "100000000000000000000000000000",
    fetchImpl: fakeNode(settledBlock),
  });
  assert.equal(ok, true);
});

test("verifyNanoPayment returns false when amount is short", async () => {
  const ok = await verifyNanoPayment({
    blockHash: "abc",
    // require 1 XNO; block only has 0.1
    minAmountRaw: "1000000000000000000000000000000",
    fetchImpl: fakeNode(settledBlock),
  });
  assert.equal(ok, false);
});

test("verifyNanoPayment fails closed on a node error", async () => {
  const ok = await verifyNanoPayment({
    blockHash: "abc",
    fetchImpl: fakeNode({ error: "Block not found" }),
  });
  assert.equal(ok, false);
});

test("verifyNanoPaymentXno accepts decimal XNO amount", async () => {
  const ok = await verifyNanoPaymentXno({
    blockHash: "abc",
    minAmountXno: "0.1",
    fetchImpl: fakeNode(settledBlock),
  });
  assert.equal(ok, true);
});

test("verifyNanoPayment fails closed when fetch rejects", async () => {
  const throwingFetch = async () => {
    throw new Error("network down");
  };
  const ok = await verifyNanoPayment({ blockHash: "abc", fetchImpl: throwingFetch });
  assert.equal(ok, false);
});
