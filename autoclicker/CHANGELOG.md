# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- Configurable global hotkey with optional `Ctrl` / `Alt` / `Shift` / `Win` modifiers (default remains `F6`).
- Mouse button selection (`Left`, `Right`, `Middle`).
- Click mode selection (`Single`, `Double`) and clicks-per-trigger count (`1-10`).
- Fixed-position click mode (`X`,`Y`) with next-click position capture via low-level mouse hook.
- Optional stop limits:
  - stop after `N` clicks
  - stop after `X` seconds
- Optional interval jitter (`+/-` percentage).
- Interval unit selector (`ms`, `s`, `min`) with internal conversion to milliseconds.
- Settings persistence to `%APPDATA%\AutoClicker\settings.json`.
- Live click counter (`Clicks: N`).
- System tray integration with Show / Start / Stop / Exit and optional minimize-to-tray behavior.
- Always-on-top option.
- Tooltips for all user inputs.
- First-run compliance notice dialog with "don't show again" persistence.
- App icon (`Assets/App.ico`) and assembly metadata (Version, Company, Product, Description).
- GitHub Actions workflow for build validation and release artifact publishing.

### Changed

- Replaced `System.Windows.Forms.Timer` with `System.Threading.Timer` scheduling for improved small-interval behavior.
- Extracted global hotkey ownership into `GlobalHotkey : IDisposable`.
- Migrated Win32 interop from `DllImport` to .NET 8 `LibraryImport` source-generated bindings.
- Consolidated native magic numbers into named constants in `NativeMethods`.
- Updated event handler signatures to `object? sender` for nullable delegate compatibility.
- Added Per-Monitor v2 DPI awareness in project configuration.
- Removed redundant interval clamp in start path (UI minimum already enforces lower bound).
