/**
 * e2e coverage for the "SoulForge is now Empryo" announcement popup.
 *
 * Drives the real OpenTUI React reconciler through the headless test renderer:
 * mounts the modal, asserts what's painted, presses keys, and checks the
 * onClose contract (dontShowAgain flag) that App.tsx relies on to persist
 * `empryoAnnouncementDismissed`.
 */

import { expect, test } from "bun:test";
import type { KeyInput } from "@opentui/core/testing";
import { testRender } from "@opentui/react/test-utils";
import { EmpryoAnnouncement } from "../src/components/modals/EmpryoAnnouncement.js";
import { selectIsAnyModalOpen, useUIStore } from "../src/stores/ui.js";

const OPTS = { width: 90, height: 30 } as const;

async function mount() {
  const calls: boolean[] = [];
  const setup = await testRender(
    <EmpryoAnnouncement visible onClose={(d) => calls.push(d)} />,
    OPTS,
  );
  await setup.flush();
  await setup.renderOnce();
  // Press a key and let both the terminal parser and React's commit settle
  // before returning (state updates from the keypress must land).
  const press = async (key: KeyInput) => {
    await setup.mockInput.pressKey(key);
    await setup.flush();
    await new Promise((r) => setTimeout(r, 1));
    await setup.renderOnce();
  };
  return { ...setup, calls, press };
}

test("announcement renders the gratitude, platforms, repo notice, and both buttons", async () => {
  const { captureCharFrame } = await mount();
  const frame = captureCharFrame();
  expect(frame).toContain("SoulForge is now Empryo");
  // Gratitude message.
  expect(frame).toContain("Thank you for trusting SoulForge");
  // Brand + platforms + link.
  expect(frame).toContain("empryo.com");
  expect(frame).toContain("macOS · Linux · Windows");
  // Closing line: SoulForge lives on, Empryo is the future.
  expect(frame).toContain("SoulForge still works");
  // Two actionable buttons are painted.
  expect(frame).toContain("Close");
  expect(frame).toContain("Don't show again");
});

test("Enter on the default focus (Close) does not persist", async () => {
  const { press, calls } = await mount();
  await press("RETURN");
  expect(calls).toEqual([false]);
});

test("'d' shortcut persists (dontShowAgain = true)", async () => {
  const { press, calls } = await mount();
  await press("d");
  expect(calls).toEqual([true]);
});

test("Tab to the second button, then Enter persists (dontShowAgain = true)", async () => {
  const { press, calls } = await mount();
  await press("TAB"); // focus → "Don't show again"
  await press("RETURN");
  expect(calls).toEqual([true]);
});

test("Tab twice returns focus to Close → Enter does not persist", async () => {
  const { press, calls } = await mount();
  await press("TAB"); // → Don't show again
  await press("TAB"); // → back to Close
  await press("RETURN");
  expect(calls).toEqual([false]);
});

test("'q' closes without persisting", async () => {
  const { press, calls } = await mount();
  await press("q");
  expect(calls).toEqual([false]);
});

test("hidden when not visible", async () => {
  const setup = await testRender(
    <EmpryoAnnouncement visible={false} onClose={() => {}} />,
    OPTS,
  );
  await setup.flush();
  await setup.renderOnce();
  expect(setup.captureCharFrame()).not.toContain("SoulForge is now Empryo");
});

// Integration: exercise the exact wiring App.tsx uses — the UI store drives
// `visible`, a keypress calls onClose, and onClose closes the modal via the store.
test("store-driven open → render → keypress → close (App wiring path)", async () => {
  const persisted: boolean[] = [];

  function Harness() {
    const visible = useUIStore((s) => s.modals.empryoAnnouncement);
    return (
      <EmpryoAnnouncement
        visible={visible}
        onClose={(dontShowAgain) => {
          useUIStore.getState().closeModal("empryoAnnouncement");
          persisted.push(dontShowAgain);
        }}
      />
    );
  }

  const setup = await testRender(<Harness />, OPTS);
  await setup.flush();
  await setup.renderOnce();

  // Store closed → nothing painted.
  expect(setup.captureCharFrame()).not.toContain("SoulForge is now Empryo");
  expect(selectIsAnyModalOpen(useUIStore.getState())).toBe(false);

  // App opens it the same way the startup effect does.
  useUIStore.getState().openModal("empryoAnnouncement");
  await setup.flush();
  await setup.renderOnce();
  expect(setup.captureCharFrame()).toContain("SoulForge is now Empryo");

  // "Don't show again" → onClose(true) → store closes the modal.
  await setup.mockInput.pressKey("d");
  await setup.flush();
  await new Promise((r) => setTimeout(r, 1));
  await setup.renderOnce();

  expect(persisted).toEqual([true]);
  expect(useUIStore.getState().modals.empryoAnnouncement).toBe(false);
  expect(setup.captureCharFrame()).not.toContain("SoulForge is now Empryo");
});
