# AutoClicker

Lightweight .NET 8 WinForms autoclicker for Windows.

It supports configurable global hotkeys, mouse button/click modes, jitter and stop limits, optional fixed-position clicks, tray controls, and persisted settings.

## Requirements

- Windows
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)

## Build and run

From this folder:

```powershell
dotnet run
```

Release build:

```powershell
dotnet build -c Release
```

The executable is under `bin\Release\net8.0-windows\AutoClicker.exe`.

### Optional: single-file publish

```powershell
dotnet publish -c Release -r win-x64 --self-contained true /p:PublishSingleFile=true
```

Output is under `bin\Release\net8.0-windows\win-x64\publish\`.

## Usage

1. Set **Click interval** and **unit** (`Milliseconds`, `Seconds`, or `Minutes`).
2. Choose:
   - hotkey key + modifiers (`Ctrl`, `Alt`, `Shift`, `Win`)  
   - mouse button (`Left`, `Right`, `Middle`)  
   - click type (`Single`, `Double`)  
   - clicks per trigger (`1-10`)
3. Optional:
   - fixed-position mode (`X`,`Y`) and **Pick position**  
   - stop after `N` clicks  
   - stop after `X` seconds  
   - jitter `+/- %`  
   - always-on-top  
   - minimize to tray
4. Press **Start** (or configured hotkey) to run, **Stop** (or hotkey) to stop.

The app shows a live counter (`Clicks: N`) while running.

If the hotkey cannot be registered, the app shows a warning and in-window controls still work.

## Settings persistence

Settings are saved automatically to:

`%APPDATA%\AutoClicker\settings.json`

Persisted fields include interval/unit, hotkey + modifiers, button/click mode, clicks per trigger, fixed position, jitter, stop limits, always-on-top, minimize-to-tray, and first-run notice preference.

## Tray controls

When minimize-to-tray is enabled, minimizing hides the window to the system tray. Tray menu actions:

- Show
- Start
- Stop
- Exit

## Disclaimer

Use this tool only where it is **allowed**: respect game terms of service, workplace policies, and applicable law. The authors are not responsible for misuse. Intended for learning and legitimate automation (for example testing or accessibility).

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
