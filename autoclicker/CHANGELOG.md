# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- Initial WinForms MVP: configurable click interval (ms), left click at current cursor via `SendInput`.
- **Start** / **Stop** controls and **F6** global hotkey toggle (`RegisterHotKey` / `WM_HOTKEY`).
- Warning when the hotkey cannot be registered; in-window controls still work.
- `.gitignore` for `bin/`, `obj/`, and common Visual Studio junk files.
