using System.Runtime.InteropServices;

namespace AutoClicker;

/// <summary>
/// Captures the next mouse-down screen position using a low-level mouse hook.
/// </summary>
internal sealed class PositionPicker : IDisposable
{
    private NativeMethods.HookProc? _hookProc;
    private IntPtr _hookHandle;
    private TaskCompletionSource<Point>? _pendingPick;

    /// <summary>
    /// Starts a one-shot capture of the next mouse click position.
    /// </summary>
    internal Task<Point> PickNextPositionAsync()
    {
        if (_pendingPick != null)
            return _pendingPick.Task;

        var pendingPick = new TaskCompletionSource<Point>(TaskCreationOptions.RunContinuationsAsynchronously);
        _pendingPick = pendingPick;
        _hookProc = HookCallback;
        _hookHandle = NativeMethods.SetWindowsHookEx(
            NativeMethods.WhMouseLl,
            _hookProc,
            NativeMethods.GetModuleHandle(null),
            0);

        if (_hookHandle == IntPtr.Zero)
        {
            pendingPick.TrySetException(new InvalidOperationException("Failed to install mouse hook."));
            _pendingPick = null;
        }

        return pendingPick.Task;
    }

    private IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0 &&
            _pendingPick != null &&
            (wParam == (IntPtr)NativeMethods.WmLButtonDown ||
             wParam == (IntPtr)NativeMethods.WmRButtonDown ||
             wParam == (IntPtr)NativeMethods.WmMButtonDown))
        {
            var hookData = Marshal.PtrToStructure<NativeMethods.MSLLHOOKSTRUCT>(lParam);
            _pendingPick.TrySetResult(new Point(hookData.pt.X, hookData.pt.Y));
            CleanupHook();
            return (IntPtr)1;
        }

        return NativeMethods.CallNextHookEx(_hookHandle, nCode, wParam, lParam);
    }

    private void CleanupHook()
    {
        if (_hookHandle != IntPtr.Zero)
        {
            NativeMethods.UnhookWindowsHookEx(_hookHandle);
            _hookHandle = IntPtr.Zero;
        }

        _hookProc = null;
        _pendingPick = null;
    }

    /// <inheritdoc />
    public void Dispose()
    {
        CleanupHook();
    }
}
