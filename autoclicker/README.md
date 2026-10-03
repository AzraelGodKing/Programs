# AutoClicker

Windows desktop app that automates mouse buttons at the cursor or at **saved screen points**, on a timer with optional **random jitter**, or in **hold** mode. Use **Start** / **Stop** or separate global hotkeys (default **F6** to start, **F7** to stop). Settings and named presets are saved under `%LocalAppData%\AutoClicker\settings.json`.

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

## Features

| Option | Description |
|--------|-------------|
| **Interval (ms)** | Time from the start of one click to the start of the next in **Click** mode (1–3,600,000). |
| **Jitter (+ms)** | Each interval adds random **0…jitter** milliseconds (0 = fixed interval). |
| **Press (ms)** | How long the button stays down on each click (0 = a quick click). |
| **Clicks / tick** | Clicks sent each interval. **2** is a double-click; extra clicks are 40 ms apart. |
| **Limit (0 = none)** | Stop after this many clicks. **0** runs until **Stop**. |
| **Time limit (s)** | Stop after this many seconds of clicking or holding. **0** runs until **Stop**. The start delay is not counted. |
| **Mouse button** | Left, right, or middle. |
| **Mode: Click** | Repeated clicks at the interval (with jitter). |
| **Mode: Hold** | Presses the button down on Start and releases on Stop (no timer). |
| **Start delay (s)** | Wait before the first action so you can focus another window. |
| **Pos. jitter (px)** | Random pixel offset around each saved point. |
| **Stop if mouse moves** | Stops when the pointer leaves the click position by a few pixels. |
| **Leave pointer** | With saved points, each click is sent to the window under that point and the pointer stays where it is. Turn off **Stop if mouse moves** if you want to keep using the mouse. Some programs only respond when the real cursor clicks. |
| **Use saved points** | When enabled, each click goes to the next saved point, then wraps. **Capture in 3s…** starts a countdown — move the mouse to the target before it hits zero. **Remove**, **Clear**, or **Delete** edit the list. While counting down, the start hotkey is ignored. |
| **Start / Stop hotkeys** | Each is **F1–F12** plus optional **Ctrl**, **Alt**, and **Shift**. Defaults are **F6** and **F7**. |
| **Minimize to tray** | Minimizing hides the window. The tray menu can **Start**, **Stop**, **Show**, or **Exit**. |
| **Always on top** | Keeps the window above other windows. |
| **Preset** | Type a name and **Save** to store the current click settings. Pick a name to load them. |

## Usage

1. Choose interval, jitter, press length, clicks per tick, limit, button, and mode.
2. To click saved spots, check **Use saved points**, click **Capture in 3s…**, and move the pointer before the countdown ends. Repeat to build a sequence.
3. Optionally set a start delay, time limit, position jitter, **Leave pointer**, or **Stop if mouse moves**.
4. Press **Start** or the start hotkey. Press **Stop** or the stop hotkey to end. A start delay counts down before the first click.
5. To keep a setup, type a preset name and click **Save**.

If a hotkey cannot be registered, you will see a warning at startup and can still use **Start** / **Stop**. The status line shows the click count and elapsed time while a run is going.

## Disclaimer

Use this tool only where it is **allowed**: respect game terms of service, workplace policies, and applicable law. The authors are not responsible for misuse. Intended for learning and legitimate automation (for example testing or accessibility).

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
