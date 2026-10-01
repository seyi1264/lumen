import assert from "node:assert/strict";
import { test } from "node:test";
import { useStudioStore } from "./store.ts";

test("studio starts without built-in demo data", () => {
  const { voice, posts, deals, experiments, stats } = useStudioStore.getState();
  assert.equal(voice.handle, "@yourstudio");
  assert.deepEqual(posts, []);
  assert.deepEqual(deals, []);
  assert.deepEqual(experiments, []);
  assert.deepEqual(stats, []);
});
