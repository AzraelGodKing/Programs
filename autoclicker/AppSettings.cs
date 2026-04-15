namespace AutoClicker;

/// <summary>
/// Supported mouse buttons.
/// </summary>
public enum MouseButtonType
{
    Left,
    Right,
    Middle
}

/// <summary>
/// Click mode per trigger.
/// </summary>
public enum ClickType
{
    Single,
    Double
}

/// <summary>
/// Interval unit selected in the UI.
/// </summary>
public enum IntervalUnit
{
    Milliseconds,
    Seconds,
    Minutes
}

/// <summary>
/// Persisted user settings.
/// </summary>
public sealed class AppSettings
{
    /// <summary>Interval numeric value in selected unit.</summary>
    public decimal IntervalValue { get; set; } = 500m;

    /// <summary>Interval unit displayed in UI.</summary>
    public IntervalUnit IntervalUnit { get; set; } = IntervalUnit.Milliseconds;

    /// <summary>Main key for global toggle hotkey.</summary>
    public Keys Hotkey { get; set; } = Keys.F6;

    /// <summary>True when Ctrl is part of hotkey.</summary>
    public bool HotkeyCtrl { get; set; }

    /// <summary>True when Alt is part of hotkey.</summary>
    public bool HotkeyAlt { get; set; }

    /// <summary>True when Shift is part of hotkey.</summary>
    public bool HotkeyShift { get; set; }

    /// <summary>True when Win is part of hotkey.</summary>
    public bool HotkeyWin { get; set; }

    /// <summary>Configured click button.</summary>
    public MouseButtonType MouseButton { get; set; } = MouseButtonType.Left;

    /// <summary>Configured click type.</summary>
    public ClickType ClickType { get; set; } = ClickType.Single;

    /// <summary>How many click actions to send each trigger (1-10).</summary>
    public int ClicksPerTrigger { get; set; } = 1;

    /// <summary>Enables fixed-position click mode.</summary>
    public bool UseFixedPosition { get; set; }

    /// <summary>Fixed X position for click mode.</summary>
    public int FixedX { get; set; }

    /// <summary>Fixed Y position for click mode.</summary>
    public int FixedY { get; set; }

    /// <summary>Enable random jitter around interval.</summary>
    public bool EnableJitter { get; set; }

    /// <summary>Jitter percentage (0-100).</summary>
    public int JitterPercent { get; set; }

    /// <summary>Enable stop after N click actions.</summary>
    public bool EnableClickLimit { get; set; }

    /// <summary>Maximum click actions before auto-stop.</summary>
    public int MaxClicks { get; set; } = 100;

    /// <summary>Enable stop after duration.</summary>
    public bool EnableDurationLimit { get; set; }

    /// <summary>Duration in seconds before auto-stop.</summary>
    public int MaxSeconds { get; set; } = 60;

    /// <summary>Enables tray behavior on minimize.</summary>
    public bool MinimizeToTray { get; set; }

    /// <summary>Window top-most preference.</summary>
    public bool AlwaysOnTop { get; set; }

    /// <summary>False until user acknowledges ToS/policy notice.</summary>
    public bool ShowFirstRunNotice { get; set; } = true;
}
