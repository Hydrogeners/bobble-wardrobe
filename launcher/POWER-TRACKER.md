# Power Tracker · minimal activity mod

A minimal in-activity rebuild of [organpy/BLPT](https://github.com/organpy/BLPT)'s
manual power-box checklist. No separate desktop overlay, global keyboard hooks,
PyQt dependency, game-memory reads or automatic power detection.

## Use

Install/update **activity mods** in Bobble Addons with Discord Stable fully closed.
Open Bobble League normally. **Powers**, at bottom-left, shows a compact draggable
checklist. Click a player or use their shortcut to mark/unmark an observed power
box. The header contains Clear marks, Settings and Hide. There is no dashboard.

Settings contains names, optional shortcuts, theme and Add/Remove (1–10 players).
Four players are the default. Click a shortcut and press a new combination;
Backspace removes it, Escape cancels capture. Defaults: **1, 2, 3, 4** (no modifiers).
The previous untouched Alt+Shift default scheme upgrades to plain numbers;
custom shortcut schemes are kept.
Shortcuts work only inside the focused activity, while the panel is shown and
settings are closed. They do not act while typing in inputs/editable elements.
Ctrl+1–4 and the cosmetic emergency restore chord remain reserved.

Drag the heading, resize from the lower corner, or Hide to pause tracker
shortcuts. Names/shortcuts/theme/position/size save to the activity's localStorage
under `bobble-addons.power-tracker.v1`. Marks do not persist, and every activity
reload starts with the panel hidden. Storage denial leaves a usable session;
invalid saved preferences are retained in a recovery key on explicit Save.

## Manager / isolation

Wardrobe and Power Tracker share the installed activity loader and signed JS
payload transport. They are separate mods in UI/state, not separate installers:
**Uninstall all three** removes that shared integration, including Recorder. Hide the tracker in-activity
without disabling skins; restore skins without removing the tracker. Tracker
startup precedes native cosmetic setup and does not depend on skins being on.
The installed loader still uses its existing supported-build guard.

Recorder is the third independent addon in the shared install. This release does
**not** contain the owner's private assister or ramp prototype. No GitHub release
or signed feed is changed just by building it.
No running Discord instance is restarted or automatically patched for this task.

## Source / credits

- `hydro/integration/power-tracker-core.js`: pure manual state and validation.
- `hydro/integration/power-tracker.js`: minimal Shadow DOM UI and lifecycle.
- `power-tracker-test.cjs`: state/shortcuts/bundle regressions.
- `tests/power-tracker-fixture.html`: standalone UI test, not a game screenshot.
- `third_party/BLPT-LICENSE.txt`: full MIT notice, also embedded in the payload.

The interaction model is based on BLPT by **organ**, reviewed at commit
`d27522bdba74545fda47aaf9ca5ea21d10f59600`. No upstream binaries, game images or
bundled fonts are redistributed. This is not an official BLPT release.
