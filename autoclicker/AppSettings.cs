using System.Text.Json;

namespace AutoClicker;

internal static class HotkeyMods
{
    public const int Alt = 1;
    public const int Control = 2;
    public const int Shift = 4;
}

internal sealed class ClickPoint
{
    public int X { get; set; }
    public int Y { get; set; }
}

internal sealed class ClickPreset
{
    public string Name { get; set; } = "";
    public decimal IntervalMs { get; set; } = 500;
    public int JitterMaxMs { get; set; }
    public int PressMs { get; set; }
    public int ClicksPerTick { get; set; } = 1;
    public int ClickLimit { get; set; }
    public int TimeLimitSeconds { get; set; }
    public int MouseButton { get; set; }
    public bool HoldMode { get; set; }
    public int StartDelaySeconds { get; set; }
    public bool LeavePointer { get; set; }
    public int PositionJitterPx { get; set; }
    public bool StopOnMouseMove { get; set; }
    public bool UsePoints { get; set; }
    public List<ClickPoint> Points { get; set; } = new();
}

internal sealed class AppSettings
{
    public decimal IntervalMs { get; set; } = 500;
    public int JitterMaxMs { get; set; }
    public int PressMs { get; set; }
    public int ClicksPerTick { get; set; } = 1;
    public int ClickLimit { get; set; }
    public int TimeLimitSeconds { get; set; }
    public int MouseButton { get; set; }
    public bool HoldMode { get; set; }
    public bool LeavePointer { get; set; }
    public bool FixedPosition { get; set; }
    public int? FixedX { get; set; }
    public int? FixedY { get; set; }
    public List<ClickPoint> Points { get; set; } = new();
    public int StartDelaySeconds { get; set; }
    public int PositionJitterPx { get; set; }
    public bool StopOnMouseMove { get; set; }

    // Start hotkey: 0 = F1 … 11 = F12. Name kept so existing settings.json files still load.
    public int HotkeyFKeyIndex { get; set; } = 5;
    public int StopHotkeyFKeyIndex { get; set; } = 6;
    public int StartHotkeyModifiers { get; set; }
    public int StopHotkeyModifiers { get; set; }
    public bool MinimizeToTray { get; set; }
    public bool AlwaysOnTop { get; set; }
    public bool ShowFirstRunNotice { get; set; } = true;
    public List<ClickPreset> Presets { get; set; } = new();
}

internal static class AppSettingsStore
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    internal static string SettingsFilePath { get; } = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "AutoClicker",
        "settings.json");

    internal static AppSettings Load()
    {
        try
        {
            if (!File.Exists(SettingsFilePath))
                return new AppSettings();
            var json = File.ReadAllText(SettingsFilePath);
            return Normalize(JsonSerializer.Deserialize<AppSettings>(json) ?? new AppSettings());
        }
        catch
        {
            return new AppSettings();
        }
    }

    internal static void Save(AppSettings settings)
    {
        try
        {
            var dir = Path.GetDirectoryName(SettingsFilePath);
            if (!string.IsNullOrEmpty(dir))
                Directory.CreateDirectory(dir);
            File.WriteAllText(SettingsFilePath, JsonSerializer.Serialize(settings, JsonOptions));
        }
        catch
        {
            // ignore persistence failures
        }
    }

    private static AppSettings Normalize(AppSettings settings)
    {
        settings.Points ??= new List<ClickPoint>();
        settings.Presets ??= new List<ClickPreset>();
        if (settings.Points.Count == 0 && settings.FixedX is int x && settings.FixedY is int y)
            settings.Points.Add(new ClickPoint { X = x, Y = y });
        if (settings.ClicksPerTick < 1)
            settings.ClicksPerTick = 1;
        if (settings.TimeLimitSeconds < 0)
            settings.TimeLimitSeconds = 0;
        if (settings.StopHotkeyFKeyIndex is < 0 or > 11)
            settings.StopHotkeyFKeyIndex = 6;

        foreach (var preset in settings.Presets)
        {
            preset.Points ??= new List<ClickPoint>();
            if (preset.ClicksPerTick < 1)
                preset.ClicksPerTick = 1;
            if (string.IsNullOrWhiteSpace(preset.Name))
                preset.Name = "Preset";
        }

        return settings;
    }
}
