// "This computer and My Cloud together" for a person whose home is My Cloud: this computer's own bots live in a workspace of
// its own (This Mac or This PC, the `default` profile, clean-workspace.mjs), which runs only once opened, while the folder
// the app starts on is the copy the move froze. With together on, this starts that workspace's server in the background a
// while after launch, so the one list and the link work without first clicking This Mac; the window stays where it is.
//
// Only when: My Cloud is home; the switch is on for the signed-in account; the window shows My Cloud; the frozen copy runs
// (no other workspace was opened); the workspace exists and holds at least one bot. Never the frozen copy, never a new
// workspace made for it. It runs at most once a launch, and never inside the launch's quiet start.
import nodeFs from "node:fs";
import path from "node:path";

import { DEFAULT_PROFILE, profileDir } from "./clean-workspace.mjs";
import { START_QUIET_MS } from "./places-together.mjs";

/** Whether the workspace in `dir` holds a bot of its own: its bots.json lists one that is not hidden and did not move. A
 * folder or file that is missing or can't be read holds none. */
export function holdsBots(dir, fs = nodeFs) {
  let bots;
  try { bots = JSON.parse(fs.readFileSync(path.join(dir, "bots.json"), "utf8")); } catch { return false; }
  return Array.isArray(bots) && bots.some((bot) => bot && typeof bot === "object" && typeof bot.id === "string" && !bot.hidden && !bot.movedTo);
}

/**
 * @param {{
 *   cloudHome(): boolean,
 *   togetherOn(): boolean,
 *   onMyCloud(): boolean,
 *   ownCopyRuns(): boolean,
 *   dataDir(): string,
 *   open(id: string): Promise<boolean>,
 *   fs?: typeof nodeFs,
 *   quietMs?: number,
 *   later?: typeof setTimeout,
 *   cancel?: typeof clearTimeout,
 *   log?(line: string): void,
 * }} deps `togetherOn()`: the switch is on for the signed-in account (places-together.mjs `switchOn`). `onMyCloud()`: the
 * window shows My Cloud's page. `ownCopyRuns()`: this computer's server runs on the frozen copy, not on any workspace.
 * `open(id)`: starts that workspace's server without moving the window.
 */
export function createTogetherBackground({ cloudHome, togetherOn, onMyCloud, ownCopyRuns, dataDir, open, fs = nodeFs, quietMs = START_QUIET_MS, later = setTimeout, cancel = clearTimeout, log = () => {} }) {
  let timer = null, done = false;
  async function run() {
    timer = null;
    if (done || !cloudHome() || !togetherOn() || !onMyCloud() || !ownCopyRuns()) return false;
    if (!holdsBots(profileDir(dataDir(), DEFAULT_PROFILE), fs)) return false;
    done = true;
    const opened = await open(DEFAULT_PROFILE).catch((error) => { log(`together: this computer's workspace did not start (${error?.message ?? error})`); return false; });
    if (opened) log("together: this computer's workspace started in the background");
    return opened === true;
  }
  return {
    /** The launch is under way: looks once its quiet start is over. */
    start() { if (timer === null && !done) { timer = later(() => void run(), quietMs); timer?.unref?.(); } },
    run,
    close() { if (timer !== null) cancel(timer); timer = null; },
  };
}
