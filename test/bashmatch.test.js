import { test } from "node:test";
import assert from "node:assert/strict";
import { splitCompound, stripWrappers, bashMatches } from "../src/bashmatch.js";

test("splitCompound: all documented separators, quote-aware", () => {
  assert.deepEqual(splitCompound("a && b"), ["a", "b"]);
  assert.deepEqual(splitCompound("a; b || c | d |& e & f"), ["a", "b", "c", "d", "e", "f"]);
  assert.deepEqual(splitCompound("echo 'a && b'; ls"), ["echo 'a && b'", "ls"]);
  assert.deepEqual(splitCompound('echo "x | y" | wc'), ['echo "x | y"', "wc"]);
  assert.deepEqual(splitCompound("one\ntwo"), ["one", "two"]);
  assert.deepEqual(splitCompound("  a  "), ["a"]);
});

test("splitCompound: trailing operator stays attached (per docs, not split)", () => {
  assert.deepEqual(splitCompound("npm test &&"), ["npm test &&"]);
});

test("stripWrappers: documented wrapper list", () => {
  assert.equal(stripWrappers("timeout 30 npm test"), "npm test");
  assert.equal(stripWrappers("nohup git push"), "git push");
  assert.equal(stripWrappers("command -v git"), "-v git"); // command stripped bare
  assert.equal(stripWrappers("builtin cd x"), "cd x");
  assert.equal(stripWrappers("noglob ls *"), "ls *");
  assert.equal(stripWrappers("stdbuf -o0 tail f"), "tail f");
  assert.equal(stripWrappers("xargs echo"), "echo"); // bare xargs only
});

test("stripWrappers: leading safe env assignments", () => {
  assert.equal(stripWrappers("NODE_ENV=test npm test"), "npm test");
  assert.equal(stripWrappers("FOO=1 BAR=2 npm run build"), "npm run build");
});

test("stripWrappers: dev runners are NOT stripped (documented)", () => {
  assert.equal(stripWrappers("npx something"), "npx something");
  assert.equal(stripWrappers("docker exec x y"), "docker exec x y");
  assert.equal(stripWrappers("mise exec -- task"), "mise exec -- task");
});

test("bashMatches: exact, prefix, and the bare-command rule", () => {
  assert.equal(bashMatches("npm test", "npm test"), true);
  assert.equal(bashMatches("npm test", "npm run test"), false);
  // trailing " *" also matches the bare command
  assert.equal(bashMatches("ls", "ls *"), true);
  assert.equal(bashMatches("ls -la", "ls *"), true);
  // no space = no bare match: ls* also hits lsof
  assert.equal(bashMatches("lsof", "ls*"), true);
  assert.equal(bashMatches("git log --oneline", "git log *"), true);
  assert.equal(bashMatches("git push --force", "git log *"), false);
  // ":*" suffix is the documented alias
  assert.equal(bashMatches("npm run build", "npm run:*"), true);
  assert.equal(bashMatches("anything at all", "*"), true);
});

test("bashMatches: mid-pattern wildcards match across spaces", () => {
  assert.equal(bashMatches("git commit -m 'a b'", "git commit *"), true);
  // the raw matcher sees one string; compound splitting happens upstream
  assert.equal(bashMatches("git add a && git commit", "git *"), true);
});
