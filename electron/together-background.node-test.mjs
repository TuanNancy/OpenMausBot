import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { profileDir } from "./clean-workspace.mjs";
import { START_QUIET_MS } from "./places-together.mjs";
import { createTogetherBackground, holdsBots } from "./together-background.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

function setup(t, { bots = [{ id: "ledger", name: "Ledger" }], over = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), "together-background-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const data = join(root, "omb");
  if (bots) { mkdirSync(profileDir(data, "default"), { recursive: true }); writeFileSync(join(profileDir(data, "default"), "bots.json"), JSON.stringify(bots)); }
  const f = { cloudHome: true, on: true, onMyCloud: true, ownCopy: true, opened: [], timers: [] };
  f.background = createTogetherBackground({
    cloudHome: () => f.cloudHome, togetherOn: () => f.on, onMyCloud: () => f.onMyCloud, ownCopyRuns: () => f.ownCopy, dataDir: () => data,
    open: async (id) => { f.opened.push(id); return true; },
    later: (run, ms) => { const timer = { run, ms }; f.timers.push(timer); return timer; }, cancel: () => {}, ...over,
  });
  return f;
}

test("My Cloud home, together on: this computer's own workspace starts in the background once the launch's quiet start is over, and only once", async (t) => {
  const f = setup(t);
  f.background.start();
  f.background.start();
  assert.deepEqual([f.timers.length, f.timers[0].ms, f.opened], [1, START_QUIET_MS, []], "nothing during the launch's quiet start");
  assert.equal(await f.background.run(), true);
  assert.deepEqual(f.opened, ["default"]);
  assert.equal(await f.background.run(), false, "once a launch");
});

test("it never starts: together off, home this computer, the window not on My Cloud, another workspace running, or a workspace with no bot or none at all", async (t) => {
  for (const [why, change] of [["together off", (f) => { f.on = false; }], ["home is this computer", (f) => { f.cloudHome = false; }],
    ["the window shows another place", (f) => { f.onMyCloud = false; }], ["a workspace runs already", (f) => { f.ownCopy = false; }]]) {
    const f = setup(t);
    change(f);
    assert.equal(await f.background.run(), false, why);
    assert.deepEqual(f.opened, [], why);
  }
  for (const [why, bots] of [["no workspace", null], ["no bot", []], ["only bots that moved or are hidden", [{ id: "a", movedTo: "x" }, { id: "b", hidden: true }]]]) {
    const f = setup(t, { bots });
    assert.equal(await f.background.run(), false, why);
    assert.deepEqual(f.opened, [], why);
  }
});

test("a workspace counts as holding bots only from a readable bots.json", (t) => {
  const root = mkdtempSync(join(tmpdir(), "together-bots-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  assert.equal(holdsBots(join(root, "missing")), false);
  writeFileSync(join(root, "bots.json"), "{not json");
  assert.equal(holdsBots(root), false);
  writeFileSync(join(root, "bots.json"), JSON.stringify([{ id: "scout" }]));
  assert.equal(holdsBots(root), true);
});

test("main starts it after the start place opened, opens the workspace without moving the window, and a background open never makes a workspace", () => {
  const main = readFileSync(join(HERE, "main.mjs"), "utf8");
  assert.match(main, /await showStartPlace\(\); void cloudAccountRestored\(\)\.then\(\(\) => teamLinks\.ready\(\)\); togetherBackground\.start\(\);/);
  assert.match(main, /open: id => cleanWorkspace\.open\(id, \{ background: true \}\)/);
  assert.match(main, /onMyCloud: \(\) => placeShown\(\) === "cloud", ownCopyRuns: \(\) => cleanWorkspace\.ownCopy\(\)/);
  assert.match(main, /windowFollows = \(\) => !background && \(placeSwitch\.turn\(\) === asked \|\|/, "a background start never moves the window or the remembered place");
  assert.match(main, /swap: \(dir, how\) => switchLocalEnvironmentTo\(dir, LOCAL_ID, true, how\?\.background === true\)/);
  const clean = readFileSync(join(HERE, "clean-workspace.mjs"), "utf8");
  assert.match(clean, /if \(background && !fs\.existsSync\(dir\)\) return false;/);
});
