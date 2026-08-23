#!/usr/bin/env bun
/**
 * Locale gate — the only thing standing between a stranger's pull request and
 * the text this product paints into a terminal.
 *
 * Translations arrive from the public tracker. That makes every value in every
 * `locales/*.json` attacker-controlled input, and the surface it reaches is not
 * a sandbox: it is a TTY that interprets what it is handed. Each rule below
 * exists because of something a string can DO, not because of style.
 *
 *   bun scripts/validate-locales.ts            check every locale
 *   bun scripts/validate-locales.ts zh-CN      check one
 *
 * Exit 0 = safe to merge. Non-zero = do not merge.
 *
 * Every pattern below is written with `\u`/`\x` escapes rather than the literal
 * characters. A file that contains a raw ESC in order to test for raw ESC is a
 * file no reviewer can read and no diff can show honestly.
 */
import { Glob } from "bun";

/**
 * Directory holding the catalogs. Overridable so tests can point the gate at a
 * fixture tree instead of the shipped one — a security check nobody can run
 * against hostile input is a security check nobody trusts.
 */
const DIR = process.env.LOCALES_DIR ?? "locales";
const SOURCE = `${DIR}/en.json`;
/** Longest a single value may be, in characters. Beyond this a "translation" is a payload. */
const MAX_LEN = 400;
/**
 * Largest a locale file may be, in bytes. `en.json` is ~90 KB at 1,850 keys; a
 * full translation in a verbose script might reach twice that. Anything past a
 * few megabytes is not a translation, and `JSON.parse` on a file that size
 * exhausts the CI runner before a single rule has run — a "check" that can be
 * knocked over by the thing it checks is not a check.
 */
const MAX_FILE_BYTES = 4 * 1024 * 1024;

type Catalog = Record<string, string>;

interface Problem {
  locale: string;
  key: string;
  rule: string;
  detail: string;
}

const problems: Problem[] = [];
const note = (locale: string, key: string, rule: string, detail: string) =>
  problems.push({ locale, key, rule, detail });

/**
 * Control characters and escape introducers.
 *
 * This is the rule that matters. A terminal does not print `ESC`, it OBEYS it.
 * A locale value carrying `OSC 52` writes the user's system clipboard; `OSC 0`
 * rewrites the window title; cursor-movement sequences repaint parts of the
 * screen the app believes it owns, which is enough to forge a confirmation
 * prompt. None of it is visible in a diff. All of it is refused.
 *
 * Covers C0 (\x00-\x1f), DEL (\x7f) and C1 (\x80-\x9f). Tab and newline are
 * refused too: a catalog value is a phrase, and neither belongs in one.
 */
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;

/**
 * Bidirectional overrides — the Trojan Source class.
 *
 * These reorder glyphs at render time, so what a reviewer reads and what a user
 * sees can be made to differ arbitrarily. Legitimate right-to-left text (Arabic,
 * Hebrew) needs NONE of them: the bidi algorithm derives direction from the
 * letters themselves. A translation that contains an explicit override is either
 * broken or hostile, and both answers are "reject".
 */
const BIDI = /[\u202a-\u202e\u2066-\u2069]/;

/**
 * Invisible formatting — characters that occupy no space and show in no diff.
 *
 * The bar here is not "does it look harmful", it is "can a reviewer see it".
 * Anything that renders as nothing can carry a payload through review: a
 * tracking beacon, an exfiltration marker, or text addressed to a model rather
 * than to a person. The Unicode Tag block (U+E0000-E007F) is the sharp one —
 * it encodes arbitrary ASCII as invisible code points and is the standard
 * vehicle for smuggling instructions into text an LLM will later read.
 *
 * `width.ts` already treats every one of these as zero-width. A character the
 * renderer knows is invisible and the gate does not is exactly the seam to
 * close.
 */
const INVISIBLE =
  /[\u00ad\u061c\u180e\u200b-\u200f\u2028\u2029\u2060-\u2064\ufe00-\ufe0f\ufeff\ufff9-\ufffb]|[\u{e0000}-\u{e007f}]|[\u{e0100}-\u{e01ef}]/u;

/** `{name}`, `{count, plural, …}` — the argument NAMES a message depends on. */
function placeholders(pattern: string): Set<string> {
  const names = new Set<string>();
  walk(pattern, 0, pattern.length, names);
  return names;
}

/**
 * The argument names in `[from, to)`, counting only real arguments.
 *
 * A regex cannot do this. `{count, plural, one {image} other {# images}}` has
 * ONE argument — `count` — but `{image}` is a branch BODY, and it is spelled
 * exactly like a simple placeholder. A scanner that cannot tell them apart
 * demands an `{image}` the English never had, and rejects a correct
 * translation: the branch bodies are the words a translator is supposed to
 * replace. So parse: read an argument's name, and if it opens branches, walk
 * each body recursively — placeholders nested INSIDE a body are real and are
 * collected on the way through.
 */
function walk(src: string, from: number, to: number, out: Set<string>): void {
  let i = from;
  while (i < to) {
    if (src[i] !== "{") {
      i++;
      continue;
    }
    const close = matching(src, i, to);
    if (close < 0) return; // unbalanced: `balanced()` reports it on its own
    const inner = src.slice(i + 1, close);
    const name = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(,|$)/.exec(inner);
    if (!name) {
      i = close + 1;
      continue;
    }
    out.add(name[1]!);
    if (name[2] === ",") {
      // `{n, plural, one {…} other {…}}`. What follows the type is a list of
      // `keyword {body}` pairs. Each BODY is a nested message — recurse INSIDE
      // its braces, never over them: the braces belong to the branch, and
      // treating them as an argument is what made `one {image}` demand an
      // `{image}` placeholder the English never had.
      let j = i + 1 + inner.indexOf(",");
      while (j < close) {
        if (src[j] !== "{") {
          j++;
          continue;
        }
        const bodyEnd = matching(src, j, close);
        if (bodyEnd < 0) break;
        walk(src, j + 1, bodyEnd, out);
        j = bodyEnd + 1;
      }
    }
    i = close + 1;
  }
}

/** Index of the `}` closing the `{` at `open`, or -1. */
function matching(src: string, open: number, to: number): number {
  let depth = 0;
  for (let i = open; i < to; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return i;
  }
  return -1;
}

/** Arguments used with a plural form, per pattern. */
function pluralArgs(pattern: string): Set<string> {
  const out = new Set<string>();
  for (const m of pattern.matchAll(/\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*plural\b/g)) out.add(m[1]!);
  return out;
}

function balanced(s: string): boolean {
  let depth = 0;
  for (const ch of s) {
    if (ch === "{") depth++;
    else if (ch === "}" && --depth < 0) return false;
  }
  return depth === 0;
}

const src = (await Bun.file(SOURCE).json()) as Catalog;
const srcKeys = new Set(Object.keys(src));

/**
 * `--allow-stale`: a key the source catalog no longer has is reported but does
 * not fail the run. Upstream (the PR gate) never passes this — a translation
 * must match the published en.json. The private tree passes it when embedding:
 * there en.json moves first and translations lag behind by design, and the
 * embed step drops unknown keys itself.
 */
const allowStale = process.argv.includes("--allow-stale");
const only = process.argv.slice(2).find((a) => !a.startsWith("--"));
const targets: string[] = [];
for await (const f of new Glob("*.json").scan(DIR)) {
  const tag = f.replace(/\.json$/, "");
  if (tag === "en" || (only && tag !== only)) continue;
  targets.push(tag);
}
targets.sort();

if (targets.length === 0) {
  console.log(`No translations yet. Source ${SOURCE} has ${srcKeys.size} keys.`);
  process.exit(0);
}

for (const tag of targets) {
  const file = Bun.file(`${DIR}/${tag}.json`);
  if (file.size > MAX_FILE_BYTES) {
    note(tag, "-", "size", `${file.size} bytes, limit is ${MAX_FILE_BYTES}`);
    continue;
  }
  let cat: Catalog;
  try {
    cat = (await file.json()) as Catalog;
  } catch (err) {
    note(tag, "-", "parse", `not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
    continue;
  }

  if (Array.isArray(cat) || typeof cat !== "object" || cat === null) {
    note(tag, "-", "shape", "top level must be a flat object of key to string");
    continue;
  }

  // A tag we cannot construct a formatter for cannot pluralise or format numbers.
  try {
    new Intl.PluralRules(tag);
  } catch {
    note(tag, "-", "tag", `"${tag}" is not a usable BCP-47 language tag`);
  }

  for (const [key, value] of Object.entries(cat)) {
    if (typeof value !== "string") {
      note(tag, key, "type", `value is ${typeof value}, must be a string`);
      continue;
    }
    if (!srcKeys.has(key)) {
      note(tag, key, "unknown-key", "not present in en.json — stale or invented");
      continue;
    }

    if (CONTROL.test(value)) {
      note(tag, key, "control-char", "contains an escape or control character");
    }
    if (BIDI.test(value)) {
      note(tag, key, "bidi-override", "contains an explicit bidi override");
    }
    if (INVISIBLE.test(value)) {
      note(tag, key, "invisible", "contains zero-width or invisible formatting");
    }
    // A command NAME becomes something a user types after `/`: one token, no
    // slash, no whitespace, nothing a shell or the command parser would split.
    if (/^command\..*\.name$/.test(key) && !/^[\p{L}\p{M}\p{N}_-]{1,32}$/u.test(value)) {
      note(tag, key, "command-name", "must be one word (letters, digits, - _), no slash");
    }
    if (value.length > MAX_LEN) {
      note(tag, key, "length", `${value.length} chars, limit is ${MAX_LEN}`);
    }
    if (!balanced(value)) {
      note(tag, key, "braces", "unbalanced { }");
    }

    const want = placeholders(src[key]!);
    const got = placeholders(value);
    for (const p of want) if (!got.has(p)) note(tag, key, "placeholder", `missing {${p}}`);
    for (const p of got) if (!want.has(p)) note(tag, key, "placeholder", `unexpected {${p}}`);

    // A plural argument in English must stay a plural argument: dropping the
    // wrapper turns `{count, plural, …}` into the literal word "count".
    for (const p of pluralArgs(src[key]!)) {
      if (!pluralArgs(value).has(p)) note(tag, key, "plural", `{${p}} lost its plural form`);
    }
    // Every plural needs an `other` branch — it is the only category that is
    // mandatory in every language, and the runtime falls back to it.
    if (pluralArgs(value).size > 0 && !/\bother\s*\{/.test(value)) {
      note(tag, key, "plural", "plural is missing its `other` branch");
    }
  }

  const have = Object.keys(cat).filter((k) => srcKeys.has(k)).length;
  // Round DOWN, and never round a non-empty translation to 0: "0% translated"
  // next to five real translated strings reads as a failure rather than a start.
  const exact = (have / srcKeys.size) * 100;
  const pct = have > 0 ? Math.max(1, Math.floor(exact)) : 0;
  const mine = problems.filter((p) => p.locale === tag);
  const bad = (allowStale ? mine.filter((p) => p.rule !== "unknown-key") : mine).length;
  const stale = mine.length - bad;
  const status = bad === 0 ? "ok  " : "FAIL";
  const count =
    (bad ? `  ${bad} problem${bad === 1 ? "" : "s"}` : "") +
    (stale ? `  ${stale} stale` : "");
  console.log(
    `${status}  ${tag.padEnd(8)} ${String(pct).padStart(3)}% translated  (${have}/${srcKeys.size})${count}`,
  );
}

const fatal = allowStale ? problems.filter((p) => p.rule !== "unknown-key") : problems;
if (fatal.length > 0) {
  console.log("");
  for (const p of fatal) {
    console.log(`  ${p.locale}  ${p.rule.padEnd(14)} ${p.key}\n      ${p.detail}`);
  }
}
if (fatal.length > 0) {
  console.log(`\n${fatal.length} problem${fatal.length === 1 ? "" : "s"}. Not safe to merge.`);
  process.exit(1);
}
if (problems.length > fatal.length) {
  console.log(`\n${problems.length - fatal.length} stale key(s) ignored (--allow-stale).`);
}
