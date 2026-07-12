/**
 * EmpryoAnnouncement — one-time "SoulForge is now Empryo" notice.
 *
 * Reuses the update-popup chrome (PremiumPopup) with two focusable buttons:
 *   • Close             — dismiss for this launch only.
 *   • Don't show again  — persist so it never reappears.
 *
 * The Empryo wordmark (half-block bake, copied from the Empryo TUI's
 * `@empryo/base/utils/splash`) is rendered in Empryo green as the hero.
 *
 * Wired in App.tsx: opens once on startup when
 * `config.empryoAnnouncementDismissed` is not set, and "Don't show again"
 * persists that flag to the global config.
 */

import { TextAttributes } from "@opentui/core";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { useEffect, useState } from "react";
import { icon } from "../../core/icons.js";
import { useTheme } from "../../core/theme/index.js";
import { openPath } from "../../core/utils/open-path.js";
import { Button, PremiumPopup, Section, VSpacer } from "../ui/index.js";

const BOLD = TextAttributes.BOLD;

const EMPRYO_URL = "https://empryo.com";
/** Empryo brand green — the seedling/growth mark. */
const EMPRYO_GREEN = "#4ade80";
const EMPRYO_GREEN_DIM = "#2f9e57";

/** "empryo" half-block wordmark, copied from the Empryo TUI splash. */
const WORDMARK = [
  "▄▀▀▄ ▄ ▄  █▀▀▄ █▀▀▄ █  █ ▄▀▀▄",
  "█▄▄▀ █▄█▄ █▄▄▀ █▀▀  ▀▄▄█ █  █",
  "▀▄▄▄ █ █  █    ▀    ▄▄▄▀ ▀▄▄▀",
];

interface Props {
  visible: boolean;
  /** Called on close. `dontShowAgain` = user chose to never see it again. */
  onClose: (dontShowAgain: boolean) => void;
}

/** Focus index → the two action buttons. */
const CLOSE = 0;
const DISMISS = 1;

export function EmpryoAnnouncement({ visible, onClose }: Props) {
  const t = useTheme();
  const { width: termCols, height: termRows } = useTerminalDimensions();
  const [focus, setFocus] = useState<number>(CLOSE);

  useEffect(() => {
    if (visible) setFocus(CLOSE);
  }, [visible]);

  const pw = Math.min(76, Math.max(58, Math.floor(termCols * 0.78)));
  const popupH = Math.min(30, Math.max(22, termRows - 4));
  const bg = t.bgPopup;

  useKeyboard((evt) => {
    if (!visible) return;
    if (evt.name === "escape" || evt.name === "q") {
      onClose(false);
      evt.preventDefault();
      return;
    }
    // Direct shortcuts mirror the update popup: single-key actions.
    if (evt.name === "d") {
      onClose(true);
      evt.preventDefault();
      return;
    }
    if (evt.name === "g") {
      openPath(EMPRYO_URL);
      evt.preventDefault();
      return;
    }
    if (evt.name === "left" || evt.name === "h") {
      setFocus(CLOSE);
      evt.preventDefault();
      return;
    }
    if (evt.name === "right" || evt.name === "l") {
      setFocus(DISMISS);
      evt.preventDefault();
      return;
    }
    if (evt.name === "tab") {
      setFocus((f) => (f === CLOSE ? DISMISS : CLOSE));
      evt.preventDefault();
      return;
    }
    if (evt.name === "return" || evt.name === "space") {
      onClose(focus === DISMISS);
      evt.preventDefault();
      return;
    }
    evt.preventDefault();
  });

  if (!visible) return null;

  return (
    <PremiumPopup
      visible={visible}
      width={pw}
      height={popupH}
      borderColor={EMPRYO_GREEN}
      title="SoulForge is now Empryo"
      titleIcon="sparkle"
      status="online"
      footerHints={[
        { key: "←→", label: "select" },
        { key: "↵", label: "confirm" },
        { key: "Esc", label: "close" },
      ]}
    >
      <Section>
        {WORDMARK.map((line, i) => (
          <text
            // biome-ignore lint/suspicious/noArrayIndexKey: static 3-line wordmark
            key={`wm-${i}`}
            bg={bg}
            fg={i === WORDMARK.length - 1 ? EMPRYO_GREEN_DIM : EMPRYO_GREEN}
            attributes={BOLD}
          >
            {line}
          </text>
        ))}

        <VSpacer rows={1} bg={bg} />

        <text bg={bg} fg={t.textSecondary}>
          Thank you for trusting SoulForge.
        </text>
        <text bg={bg}>
          <span fg={t.textPrimary}>What began as a simple idea is now </span>
          <span fg={EMPRYO_GREEN} attributes={BOLD}>
            Empryo
          </span>
          <span fg={t.textPrimary}> —</span>
        </text>
        <text bg={bg} fg={t.textPrimary}>
          symbol-aware, multi-agent, and much faster.
        </text>

        <VSpacer rows={1} bg={bg} />

        <text bg={bg}>
          <span fg={t.textMuted}>{icon("globe")} </span>
          <span fg={EMPRYO_GREEN} attributes={BOLD}>
            empryo.com
          </span>
          <span fg={t.textFaint}>{"   ·   macOS · Linux · Windows"}</span>
        </text>
        <text bg={bg} fg={t.textFaint}>
          SoulForge still works — Empryo is where it grows.
        </text>

        <box flexDirection="row" backgroundColor={bg}>
          <Button label="Close" focused={focus === CLOSE} bg={bg} />
          <text bg={bg}> </text>
          <Button label="Don't show again" variant="ghost" focused={focus === DISMISS} bg={bg} />
        </box>
      </Section>
    </PremiumPopup>
  );
}
