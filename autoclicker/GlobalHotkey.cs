namespace AutoClicker;

/// <summary>
/// Manages registration and lifetime of one global hotkey.
/// </summary>
internal sealed class GlobalHotkey : IDisposable
{
    private readonly IntPtr _windowHandle;
    private readonly int _hotkeyId;
    private bool _registered;

    /// <summary>
    /// Raised when the configured hotkey is pressed.
    /// </summary>
    internal event EventHandler? Pressed;

    /// <summary>
    /// Creates a hotkey owner for the provided window handle.
    /// </summary>
    internal GlobalHotkey(IntPtr windowHandle, int hotkeyId)
    {
        _windowHandle = windowHandle;
        _hotkeyId = hotkeyId;
    }

    /// <summary>
    /// Registers or re-registers the hotkey using current settings.
    /// </summary>
    internal bool Register(Keys key, bool ctrl, bool alt, bool shift, bool win)
    {
        Unregister();
        var modifiers = NativeMethods.ModNoRepeat;
        if (ctrl) modifiers |= NativeMethods.ModControl;
        if (alt) modifiers |= NativeMethods.ModAlt;
        if (shift) modifiers |= NativeMethods.ModShift;
        if (win) modifiers |= NativeMethods.ModWin;

        _registered = NativeMethods.RegisterHotKey(_windowHandle, _hotkeyId, modifiers, (uint)key)
            || NativeMethods.RegisterHotKey(_windowHandle, _hotkeyId, modifiers & ~NativeMethods.ModNoRepeat, (uint)key);
        return _registered;
    }

    /// <summary>
    /// Handles incoming messages and raises <see cref="Pressed"/> when appropriate.
    /// </summary>
    internal bool ProcessMessage(ref Message message)
    {
        if (message.Msg != NativeMethods.WmHotkey || message.WParam.ToInt32() != _hotkeyId)
            return false;

        Pressed?.Invoke(this, EventArgs.Empty);
        return true;
    }

    /// <summary>
    /// Unregisters the current hotkey if registered.
    /// </summary>
    internal void Unregister()
    {
        if (!_registered)
            return;

        NativeMethods.UnregisterHotKey(_windowHandle, _hotkeyId);
        _registered = false;
    }

    /// <inheritdoc />
    public void Dispose()
    {
        Unregister();
    }
}
