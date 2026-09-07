# Morphs

A morph is one JSON file that morphs the Empryo desktop app: a live panel, a status chip, a slash command, a key chord, and an agent layer (rules the agent follows, lookups it may call, guards on its tools). Browse them at https://empryo.com/morphs.

## Install one

In Empryo: **Cells & Morphs → Start from… → Directory**, or paste a reference under **Install from GitHub…**

```
proxysoul/Empryo/morphs/github-queue.json
```

or ask the agent: *"install proxysoul/Empryo/morphs/focus-guard.json"*.

| Morph | What it does | Needs |
|---|---|---|
| `github-queue.json` | Open PRs of a repo as a live board, with a lookup the agent can call | desktop |
| `release-watch.json` | Latest releases in the sidebar, a chord to summarise the newest | desktop |
| `standup.json` | `notes/standup/*.md` as a board, one card per day; the agent drafts today's from git | desktop |
| `focus-guard.json` | No panel: rules and guards for a careful session | any |
| `powershell-guard.json` | A second look before destructive PowerShell | Windows |

A morph's agent layer — its cell — is held until you approve it in Cells & Morphs (desktop), `/cells` (TUI) or `empryo cells approve <id>`. These starters are signed by Empryo; the showcase says so, and says so differently the moment a byte changes.

## What a morph needs

Every morph says what it needs from the Empryo that loads it, once, in the file:

```json
"requires": { "empryo": ">=3.7.2", "platforms": ["macos", "linux", "windows"], "hosts": ["desktop"] }
```

- `empryo` is a version range (`>=3.7.2`, `^3.8`, `>=3.7 <4`), not a list, so a morph written for 3.7 stays valid on 3.9.
- `platforms` and `hosts` are optional; leave them out when the morph works everywhere.
- A morph whose needs are not met loads **off** with the reason on its card. Nothing is dropped silently.

`index.json` mirrors `requires` so the directory and empryo.com/morphs can show it before you install.

## Share yours

Keep the morph in your own repository. Open a pull request that adds one entry to `index.json`:

```json
{
  "ref": "you/your-repo/morphs/thing.json",
  "name": "Thing",
  "description": "One sentence.",
  "kinds": ["surface", "pulse"],
  "reach": ["api.example.com"],
  "requires": { "empryo": ">=3.7.2" },
  "author": "you"
}
```

`ref` is `owner/repo/path.json`, optionally `@branch`. `reach` lists every host the morph talks to. Sign it with `bun scripts/sign-cell.ts` if you want the showcase to show your key id. Format reference: https://empryo.com/docs/tools/morphs
