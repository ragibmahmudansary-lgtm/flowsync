# UI refresh (presentation only) — 2026-11-07

Branch `impl/m0`, base `47fcf4c`. This is **not a milestone**. No physics, threshold, validity rule, export format or displayed number changed. No finding was closed and G0 stays BLOCKED. Owner decisions D1–D4 are untouched.

Model and effort: the session ran as Sonnet 5.5 (`claude-sonnet-5-5`). The effort level is chosen in the host and cannot be read from inside the session, so this record does not claim `xhigh`.

## Design direction

**"Flight-deck dark": near-black blue-slate surfaces, one cool-blue accent for everything interactive, and state shown by colour plus a glyph plus a text label.**

"A little darkish type" was read as a dark theme with refined, slightly heavier typography: body weight 450, controls 560, headings 650–700, small uppercase labels with 0.06–0.09 em tracking, tabular numerals everywhere. There is no new font and no network request; the stack is the original one (`Inter`, then the system UI fonts).

Departures from the suggested guidance, with reasons:
- **Glyphs on badges and a "Caution" label on warnings.** The brief asked not to rely on colour alone. `.badge.good` gets `✓`, `.badge.warn` gets `▲`, and `.warning` gets a small "Caution" caption, all from CSS `::before`. The text content of every element is unchanged.
- **Primary buttons use dark text on the accent**, not white text on a mid blue. It measures 8.6:1 instead of about 4.6:1.
- **A CSS vignette over the 3D viewer.** The grid-helper colours are set at `src/app.js:455`, which this task may not change (only the background constant at line 446). A light grid on a dark scene would dominate the model, so `.viewer::after` fades the edges. It is `pointer-events: none` and does not touch the canvas.

## Tokens (`:root` in `src/styles.css`)

| Token | Value | Role |
|---|---|---|
| `--s0` | `#080c11` | Page |
| `--s1` | `#0e141b` | Top bar, panels, viewer strip |
| `--s2` | `#141c25` | Cards, metrics, plot canvas, table header |
| `--s3` | `#1b2531` | Buttons, inputs |
| `--s4` | `#243140` | Hover |
| `--ink` / `--ink-2` / `--muted` | `#e8eef4` / `#c3cfdb` / `#9aaabb` | Primary, secondary, muted text |
| `--line` / `--line-strong` | `#2a3644` / `#5d7085` | Dividers / control borders |
| `--accent` / `--accent-ink` | `#6cb2ff` / `#06101c` | Interactive accent and the text on it |
| `--focus` | `#ffd166` | Focus ring (2 px, 2 px offset) |
| `--info-*` | bg `#12263b`, fg `#a9d1ff`, bd `#2c5079` | Neutral badge |
| `--good-*` | bg `#0f2b1f`, fg `#79e0ae`, bd `#2c6a4c` | Success badge |
| `--warn-*` | bg `#33260b`, fg `#f6c46b`, bd `#7a5a1c` | Caution badge and warning blocks |
| `--bad-*` | bg `#3a151b`, fg `#ff9aa3`, bd `#84343f` | Reserved blocked state (defined, not yet used: no element has a class hook for it) |

Canvas colours live in one `PALETTE` object in `src/graphs.js`. The series colours that `src/app.js` passes in (the old light-theme hex values) are mapped to dark equivalents inside `graphs.js`, because `app.js` may not change. Line widths, scales and drawing logic are unchanged.

Scene background: `0xdce5ec` → `0x0b1119` (`src/app.js:446`, the only `app.js` change).

## Contrast (measured, WCAG 2.x relative luminance)

Script: [contrast.mjs](contrast.mjs), full output in [contrast-output.md](contrast-output.md). All 38 pairs pass. Main rows:

| Element | Ratio | Needs |
|---|---|---|
| Body text `--ink` on `--s1` / `--s2` / `--s3` | 15.84 / 14.70 / 13.25 | 4.5 |
| Secondary text `--ink-2` on `--s1` | 11.69 | 4.5 |
| Muted text `--muted` on `--s1` / `--s2` / `--s3` / `--s4` | 7.79 / 7.23 / 6.52 / 5.57 | 4.5 |
| Accent text on `--s1` | 8.33 | 4.5 |
| Primary button text on accent | 8.60 | 4.5 |
| Neutral badge | 9.70 | 4.5 |
| Good badge | 9.44 | 4.5 |
| Warn badge and warning blocks | 9.16 | 4.5 |
| Warning text on card `--s2` | 10.66 | 4.5 |
| Reserved blocked text on its background | 7.98 | 4.5 |
| Control border `--line-strong` on `--s1` / `--s2` / `--s3` | 3.63 / 3.37 / 3.04 | 3.0 |
| Focus ring on `--s1` / `--s3` | 12.84 / 10.74 | 3.0 |
| Plot series on canvas (blue, teal, red, green, amber) | 7.73 / 9.60 / 7.62 / 9.59 / 9.36 | 3.0 |
| Plot zero line on canvas | 4.16 | 3.0 |

The focus ring is drawn with a 2 px offset, so it sits on the surrounding panel and not on the button fill. A pair of focus ring on accent fill does not occur and is not listed. Disabled controls (the mass-table Y and Z inputs) use muted text on `--s2` and are exempt from the minimum.

## Baseline comparison (byte identity)

Both runs used true default inputs: `localStorage` cleared, app reloaded (17 cases, 160 panels, step 1, velocity 72), **Run horseshoe VLM**, then the app's own **Export results** and **Save project** buttons. A `URL.createObjectURL` hook hashed each blob in the page, and the downloaded files matched those hashes. Baseline is HEAD with the four UI files stashed; "after" is the working tree.

| File | Baseline SHA-256 | After SHA-256 | Result |
|---|---|---|---|
| `results.json` | `d802d2bf…ac4a27` | `d802d2bf…ac4a27` | **byte-identical** |
| `project.json` | `a920f046…6479e8` | `dd0d43d9…9883a0` | differs only in `"savedAt"` (line 4): `2026-11-06T20:09:25.714Z` vs `2026-11-06T20:10:20.300Z`. `diff` shows that single line. |

The only difference is the save timestamp, which is wall-clock time. Files: [baseline/](baseline/), [after/](after/).

**A first pass used the wrong state.** The first baseline/after pair was captured with the app's autosave restored from the earlier gap-close session (flow yaw 5°, velocity 40, α 0–4°, 2 cases). It gave the same result (`results.json` identical at `67c3ad67…`; `project.json` differs only in `savedAt`). It is kept under `baseline/autosave-restored/` and `after/autosave-restored/` and is a second, independent identity check. The default-input pair above is the one to cite.

## Browser checks (user's Brave via Claude in Chrome, `localhost:4173`)

- Viewport: the window was set to 1440×900; the page viewport was 1440×763 (browser chrome). Brave will not shrink below about 500 px wide, so **375×812 was tested as an iframe of exactly that size** inside a same-origin page. Media queries, layout and WebGL all ran at 375 px. The iframe's own scrollbar takes 15 px, so `scrollWidth` reads 360.
- **Demo load:** viewer renders on the new background, status "VLM solved 17 cases with 160 panels (R1)". `read_console_messages` with `onlyErrors`: none on a clean load and Run. The only error ever logged was the deliberate `alphaStepInput must be positive.` from the invalid-input test.
- **Default Run:** results, badges, plots legible ([after/desktop-1440x900.jpg](after/desktop-1440x900.jpg), [after/desktop-1440x900-results-setup.jpg](after/desktop-1440x900-results-setup.jpg)).
- **Invalid input** (step 0, Run): status line "VLM failed: alphaStepInput must be positive." in `--ink-2` (11.69:1), solver badge "Solver error" with ▲, results cleared ([after/desktop-1440x900-invalid-input.jpg](after/desktop-1440x900-invalid-input.jpg)).
- **No horizontal scroll:** 1440 wide `scrollWidth` 1440 ≤ 1440. At 375: 360 ≤ 375 (iframe), no element past the right edge outside the scrolling table. Breakpoints: 620 → 605 ≤ 620 and one column; 621 → 606 ≤ 621 and one column; 1180 → 1165 ≤ 1180 and one column; 1181 → 1181 ≤ 1181 and three columns. Side gutter at phone width is 16 px.
- **Keyboard focus:** Tab reached "Load demo" and "Open project" with the ring visible; the Run button and a number input showed it after keyboard focus ([after/focus-ring-button.jpg](after/focus-ring-button.jpg), [after/focus-ring-input.jpg](after/focus-ring-input.jpg)). Across all 50 buttons, inputs and selects, 47 show a computed ring under keyboard focus. The other 3 are the disabled mass-table inputs, which cannot take focus.

### Screenshots

Baseline (`baseline/`): `desktop-1440x900.jpg`, `desktop-1440x900-results.jpg`, `phone-375x812.jpg`. After (`after/`): `desktop-1440x900.jpg`, `desktop-1440x900-results-setup.jpg`, `desktop-1440x900-invalid-input.jpg`, `focus-ring-button.jpg`, `focus-ring-input.jpg`, `phone-375x812.jpg`, `phone-375x812-results-plots.jpg`. The `autosave-restored/` subfolders hold the first-pass baseline files and screenshots.

## Verification counts

| Command | Result | Exit |
|---|---|---|
| `timeout -k 10s 900s npm test` (final tree) | 192 tests, 192 pass, 0 fail, 0 skipped, 99.0 s; [npm-test.log](npm-test.log) | 0 |
| Same command on an intermediate version of the CSS | 192 pass, 0 fail, 101.2 s | 0 |

Test files: the repository has **30** `tests/*.test.mjs` files, not 29 as earlier records say. `git status` shows no test file touched, so the count is the same at `47fcf4c`; it is a wording discrepancy in the earlier handoffs, and the 192 individuals match. No test failed on a colour or CSS string, so no test was reported or edited.

## Limits

- The grid helper (`app.js:455`) keeps its light line colours. The vignette softens it at the edges; it cannot recolour it.
- Series colours are remapped in `graphs.js` rather than at the source in `app.js`. A new series colour not in the table passes through unchanged.
- "Unavailable" and "withheld" values have no class hook in the markup, so they are styled only through the generic `.metric strong` style. The `--bad-*` tokens are defined for a later change that adds a hook.
- The plot legend overlapping the curves and the unlabeled x-axis tick overlap exist in the baseline drawing logic and were left unchanged.
- The status line has no state class, so an error and a normal message share one style.
- Only the Brave desktop window and a 375 px iframe were tested; no real phone and no other browser.
- The browser tab's `localStorage` for `localhost:4173` was cleared during testing. It held the earlier gap-close session's autosave (copy kept in `baseline/autosave-restored/project.json`).
