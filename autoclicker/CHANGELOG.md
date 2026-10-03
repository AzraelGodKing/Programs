# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Changed

- **Start** and **Stop** are separate global hotkeys (default **F6** / **F7**) with optional **Ctrl**, **Alt**, and **Shift**. The old single toggle hotkey is gone.
- **Use saved points** cycles through a list of captured positions. A single captured point still behaves like the old fixed position.
- Click timing runs on a background clock so short intervals stay closer to the requested delay.
- **Fixed position capture** uses a **3-second countdown** so you can move the mouse off the **Capture** button to the real target before coordinates are sampled; **Cancel capture** and clearer prompts were added.

### Added

- **Time limit** in seconds (0 keeps going until Stop or the click limit).
- **Leave pointer** clicks the window under each saved point without moving the cursor.
- **Start delay** before the first click, so another window can be focused.
- **Stop if mouse moves**, an emergency stop when the pointer leaves the click position.
- Live **click count** and **elapsed time** while running.
- **Click limit** (0 keeps going until Stop).
- **Press (ms)** so each click can hold the button down briefly.
- **Clicks / tick** for bursts and double-clicks.
- **Position jitter** in pixels around each saved point.
- **Named presets** stored in the same settings file.
- Tray menu **Start** / **Stop**, and **Always on top**.
- **Mouse button** choice: left, right, or middle (`SendInput`).
- **Jitter**: optional random 0…N ms added to each click interval.
- **Modes**: **Click** (repeated clicks) and **Hold** (button down until Stop).
- **Saved points**: capture screen coordinates and cycle through them.
- **Minimize to tray** with tray menu and double-click to restore.
- **Settings persistence** to `%LocalAppData%\AutoClicker\settings.json` (JSON).
- First-run compliance notice, with a "don't show again" choice saved in settings.
- App icon, assembly metadata, and the GitHub Actions build workflow from the main line stay in the project.

## [0.1.0]

### Added

- Initial WinForms MVP: configurable click interval (ms), left click at current cursor via `SendInput`.
- **Start** / **Stop** controls and **F6** global hotkey toggle (`RegisterHotKey` / `WM_HOTKEY`).
- Warning when the hotkey cannot be registered; in-window controls still work.
- `.gitignore` for `bin/`, `obj/`, and common Visual Studio junk files.
