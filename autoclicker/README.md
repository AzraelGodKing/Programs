# AutoClicker

Small Windows desktop app: repeats the **left mouse button** at the **current cursor position** on a fixed interval. Use **Start** / **Stop** in the window or press **F6** anywhere to toggle (when registration succeeds).

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

1. Set **Interval (ms)** (1–3,600,000).
2. Focus the target and position the cursor where clicks should go.
3. Press **Start** or **F6** to begin; **Stop** or **F6** to end.

If **F6** cannot be registered (already used by another program), you will see a warning and can still use **Start** / **Stop**.

## Disclaimer

Use this tool only where it is **allowed**: respect game terms of service, workplace policies, and applicable law. The authors are not responsible for misuse. Intended for learning and legitimate automation (for example testing or accessibility).

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
