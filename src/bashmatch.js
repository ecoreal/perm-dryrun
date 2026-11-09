// Bash rule matching, following the documented semantics:
//  - compound splitting on && || ; | |& & and newlines (quote-aware),
//  - wrapper stripping (timeout/time/nice/nohup/stdbuf/command/builtin/noglob,
//    bare xargs) and leading safe env assignments,
//  - rule patterns: exact, trailing ":*" (≡ trailing space-star), "*" wildcards,
//    a trailing space-star also matches the bare command,
//  - precedence deny → ask → allow; a compound command runs only when EVERY
//    subcommand is allowed.
// https://code.claude.com/docs/en/permissions

// Split a command line into subcommands on the documented separators, aware of
// single/double quotes. An unparseable trailing operator is not split (the
// trailing fragment stays attached to the last subcommand, per docs).
export function splitCompound(command) {
  const parts = [];
  let cur = "";
  let quote = null;
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      cur += ch;
      continue;
    }
    // an unparseable trailing operator is not split (docs): if everything
    // from here to the end is separator/whitespace, keep it attached
    if (/^[&|;\s]+$/.test(command.slice(i))) {
      cur += command.slice(i);
      break;
    }
    if (ch === "&" && command[i + 1] === "&") {
      parts.push(cur);
      cur = "";
      i++;
      continue;
    }
    if (ch === "|" && command[i + 1] === "|") {
      parts.push(cur);
      cur = "";
      i++;
      continue;
    }
    if (ch === "|" && command[i + 1] === "&") {
      parts.push(cur);
      cur = "";
      i += 2;
      continue;
    }
    if (ch === "&" || ch === ";" || ch === "|") {
      parts.push(cur);
      cur = "";
      continue;
    }
    if (ch === "\n") {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

const WRAPPERS = new Set([
  "timeout", "time", "nice", "nohup", "stdbuf", "command", "builtin", "noglob", "xargs",
]);
const SAFE_ENV = /^[A-Z_][A-Z0-9_]*=[^ ]*$/;

// Strip wrappers and leading safe env assignments from one subcommand.
// Repeatedly: while the first token is a known wrapper, drop it (with its
// argument when the wrapper takes one: timeout/time/nice/stdbuf).
export function stripWrappers(subcommand) {
  let tokens = subcommand.trim().split(/\s+/);
  let guard = 0;
  while (tokens.length && guard++ < 10) {
    const head = tokens[0];
    if (SAFE_ENV.test(head) && head.includes("=")) {
      tokens = tokens.slice(1);
      continue;
    }
    if (head === "timeout") {
      // timeout [duration] cmd — drop the head and a non-flag duration
      tokens = tokens.slice(1);
      if (tokens.length && !tokens[0].startsWith("-")) tokens = tokens.slice(1);
      continue;
    }
    if (head === "stdbuf") {
      // stdbuf [opts] cmd — drop the head and its flags
      tokens = tokens.slice(1);
      while (tokens.length && tokens[0].startsWith("-")) tokens = tokens.slice(1);
      continue;
    }
    if (head === "nice") {
      tokens = tokens.slice(1);
      while (tokens.length && tokens[0].startsWith("-")) tokens = tokens.slice(1);
      if (tokens.length && /^\d+$/.test(tokens[0])) tokens = tokens.slice(1);
      continue;
    }
    if (WRAPPERS.has(head)) {
      tokens = tokens.slice(1);
      continue;
    }
    break;
  }
  return tokens.join(" ");
}

// Does one (unwrapped) subcommand match one Bash rule pattern?
export function bashMatches(subcommand, pattern) {
  const cmd = subcommand.trim();
  const pat = pattern.trim();
  if (pat === "*" || pat === "*:*") return true;
  // exact
  if (cmd === pat) return true;
  // ":*" suffix ≡ trailing space-star
  if (pat.endsWith(":*")) return matchStar(pat.slice(0, -2).trim() + " *", cmd);
  return matchStar(pat, cmd);
}

function matchStar(pat, cmd) {
  // trailing " *" also matches the bare command
  if (pat.endsWith(" *")) {
    const head = pat.slice(0, -2);
    if (cmd === head) return true;
    if (cmd.startsWith(head + " ")) return true;
    return false;
  }
  if (!pat.includes("*")) return false;
  // "*" mid-pattern: regex where * matches any text incl. spaces
  const re = new RegExp(
    "^" + pat.split("*").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s\\S]*") + "$",
  );
  return re.test(cmd);
}

export { WRAPPERS };
