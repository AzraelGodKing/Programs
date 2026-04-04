using System.Runtime.InteropServices;

namespace AutoClicker;

internal static class MouseInput
{
    private const uint InputMouse = 0;
    private const uint MouseEventfLeftDown = 0x0002;
    private const uint MouseEventfLeftUp = 0x0004;

    /// <summary>
    /// Sends a left-button click at the current cursor position (non-absolute mode).
    /// </summary>
    internal static void SendLeftClick()
    {
        var inputs = new INPUT[2];
        inputs[0].type = InputMouse;
        inputs[0].Union.mi = new MOUSEINPUT
        {
            dx = 0,
            dy = 0,
            mouseData = 0,
            dwFlags = MouseEventfLeftDown,
            time = 0,
            dwExtraInfo = UIntPtr.Zero,
        };
        inputs[1].type = InputMouse;
        inputs[1].Union.mi = new MOUSEINPUT
        {
            dx = 0,
            dy = 0,
            mouseData = 0,
            dwFlags = MouseEventfLeftUp,
            time = 0,
            dwExtraInfo = UIntPtr.Zero,
        };

        SendInput(2, inputs, Marshal.SizeOf<INPUT>());
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [StructLayout(LayoutKind.Sequential)]
    private struct MOUSEINPUT
    {
        internal int dx;
        internal int dy;
        internal uint mouseData;
        internal uint dwFlags;
        internal uint time;
        internal UIntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct INPUT
    {
        internal uint type;
        internal InputUnion Union;
    }

    [StructLayout(LayoutKind.Explicit)]
    private struct InputUnion
    {
        [FieldOffset(0)] internal MOUSEINPUT mi;
    }
}
