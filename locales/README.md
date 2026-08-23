# Translating Empryo

Every word Empryo shows you lives in this folder. `en.json` is the source, written by
the code. Every other file is a translation of it.

You do not need to know TypeScript to add a language. You need a text editor and a
language you speak well.

## Add a language

1. Copy `en.json` to your language's code. Use the
   [BCP-47 tag](https://en.wikipedia.org/wiki/IETF_language_tag): `ja.json` for Japanese,
   `ar.json` for Arabic, `zh-CN.json` for Simplified Chinese, `pt-BR.json` for Brazilian
   Portuguese.
2. Translate the values. Leave the keys exactly as they are.
3. Run `bun scripts/validate-locales.ts` and fix anything it reports.
4. Open a pull request.

```json
{
  "common.action.cancel": "キャンセル",
  "common.label.files": "ファイル"
}
```

**You do not have to finish.** Translate fifty keys and stop. Anything you leave out
falls back to English, key by key, so a partial translation ships and works. Someone
else — maybe you, later — picks up the rest.

## Rules

**Keep the keys.** The left side of every pair is an address the code looks things up
by. Change it and the text disappears.

**Keep the `{placeholders}`.** `{name}`, `{count}` and friends get replaced with real
values at runtime. Every one in the English string must appear in yours, spelled the
same. You can move them anywhere in the sentence — that is the point of them.

```json
"session.greeting": "Welcome back, {name}"     ← English
"session.greeting": "{name}さん、おかえりなさい"   ← fine, moved to the front
"session.greeting": "おかえりなさい"             ← rejected, {name} is gone
```

**Counting words need `plural`.** English has two forms; your language may have one, or
six. Write the ones your language actually uses, and always include `other`:

```json
"session.steps": "{count, plural, other {# 步}}",
"session.steps": "{count, plural, one {# krok} few {# kroki} many {# kroków} other {# kroku}}",
"session.steps": "{count, plural, zero {لا خطوات} one {خطوة} two {خطوتان} few {# خطوات} other {# خطوة}}"
```

`#` becomes the number, written the way your language writes numbers.

**Do not translate product names.** Empryo, Claude, OpenAI, GitHub, JSON, API. They stay
as they are.

**Do not paste from a terminal.** Copying text out of a terminal can bring invisible
escape codes with it. The checker rejects those, and it is right to — see below.

**Keep it short.** Much of this text sits in a fixed-width panel. If English says
"Compact", a six-word translation will not fit. Aim for roughly the English length.

## What the checker refuses, and why

Run `bun scripts/validate-locales.ts` before you open a pull request. It fails on:

| It rejects | Because |
|---|---|
| Escape and control characters | A terminal does not *print* these, it *obeys* them. One particular sequence writes to your clipboard. Another repaints the screen, which is enough to fake a confirmation prompt. None of it shows up in a diff. |
| Bidi override characters | They let the text a reviewer reads differ from the text a user sees. Arabic and Hebrew do not need them — the direction comes from the letters themselves. |
| Zero-width and invisible characters | Same problem: things nobody can see in review. |
| A missing or invented `{placeholder}` | The message either loses information or crashes when it is formatted. |
| A plural that lost its `plural` wrapper, or its `other` branch | It would print the word "count" instead of a number, in the one language nobody reviewing can read. |
| Values over 400 characters | At that length it is a payload, not a label. |
| Keys that are not in `en.json` | Stale after a rename, or invented. Either way the code will never read them. |

This is strict because these files come from strangers on the internet and end up
painted into a terminal on someone else's machine. Nothing personal.

## Right-to-left languages

Arabic, Hebrew, Persian and Urdu are welcome. Be aware of where they land:

- **The desktop app** handles right-to-left properly. The layout mirrors.
- **The terminal interface** does not, and cannot — terminals do not reorder
  bidirectional text. Your translation will be correct but the layout around it will
  still read left-to-right.

Translate anyway. The desktop app is the better home for it, and a terminal in your
language beats a terminal in mine.

## Chinese, Japanese, Korean

These characters take **two columns** in a terminal where a Latin letter takes one. The
code accounts for it, so you do not have to. Just keep translations near the English
length in *visual* width — four ideographs occupy about as much room as eight letters.

## When English changes

New keys appear in `en.json` when features are added. Your file does not need updating
immediately — the new keys just show in English until someone translates them. Run the
checker any time to see your coverage:

```
ok    ja        68% translated  (848/1247)
```

## Where `en.json` comes from

It is generated, not written by hand. The strings are extracted from the application
source and published here so you have something to translate against. That means:

- **Do not edit `en.json`.** Your changes would be overwritten the next time it is
  published. If a source string itself is wrong or unclear, open an issue instead.
- New keys appear when features are added. Your file does not need to keep up — the
  new keys just show in English until somebody translates them.

## What happens to your pull request

Once merged, it is copied into the build tree, checked again, and committed there. From
that point it ships in the next release. The commit your file came from is recorded, so
the text in any released binary can be traced back to the pull request that wrote it.

You do not need to do anything for that to happen.
