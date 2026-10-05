using System.Runtime.InteropServices;

namespace AutoClicker;

internal enum ClickMouseButton
{
    Left,
    Right,
    Middle,
}

internal static class MouseInput
{
    private const uint InputMouse = 0;
    private const uint MouseEventfLeftDown = 0x0002;
    private const uint MouseEventfLeftUp = 0x0004;
    private const uint MouseEventfRightDown = 0x0008;
    private const uint MouseEventfRightUp = 0x0010;
    private const uint MouseEventfMiddleDown = 0x0020;
    private const uint MouseEventfMiddleUp = 0x0040;

    internal static void SendClick(ClickMouseButton button)
    {
        SendButtonDown(button);
        SendButtonUp(button);
    }

    internal static void SendButtonDown(ClickMouseButton button)
    {
        SendInput(1, new[] { MakeMouseInput(FlagsForDown(button)) }, Marshal.SizeOf<INPUT>());
    }

    internal static void SendButtonUp(ClickMouseButton button)
    {
        SendInput(1, new[] { MakeMouseInput(FlagsForUp(button)) }, Marshal.SizeOf<INPUT>());
    }

    internal static void MoveCursorTo(int x, int y) => _ = SetCursorPos(x, y);

    internal static bool TryPostDown(int screenX, int screenY, ClickMouseButton button, bool asDoubleClick, out PostedClick click)
    {
        click = default;
        var screen = new POINT { X = screenX, Y = screenY };
        var hwnd = WindowFromPoint(screen);
        if (hwnd == IntPtr.Zero)
            return false;

        var client = screen;
        if (!ScreenToClient(hwnd, ref client))
            return false;

        click = new PostedClick(hwnd, client.X, client.Y, button);
        var packed = PackPoint(client.X, client.Y);
        PostMessage(hwnd, WmMouseMove, IntPtr.Zero, packed);
        var down = asDoubleClick ? DoubleClickMessage(button) : DownMessage(button);
        PostMessage(hwnd, down, (IntPtr)MarkFlag(button), packed);
        return true;
    }

    internal static void PostUp(PostedClick click)
    {
        if (click.Hwnd == IntPtr.Zero)
            return;
        PostMessage(click.Hwnd, UpMessage(click.Button), IntPtr.Zero, PackPoint(click.ClientX, click.ClientY));
    }

    private static IntPtr PackPoint(int x, int y) => (IntPtr)(((y & 0xFFFF) << 16) | (x & 0xFFFF));

    private static uint DownMessage(ClickMouseButton button) => button switch
    {
        ClickMouseButton.Right => WmRButtonDown,
        ClickMouseButton.Middle => WmMButtonDown,
        _ => WmLButtonDown,
    };

    private static uint UpMessage(ClickMouseButton button) => button switch
    {
        ClickMouseButton.Right => WmRButtonUp,
        ClickMouseButton.Middle => WmMButtonUp,
        _ => WmLButtonUp,
    };

    private static uint DoubleClickMessage(ClickMouseButton button) => button switch
    {
        ClickMouseButton.Right => WmRButtonDblClk,
        ClickMouseButton.Middle => WmMButtonDblClk,
        _ => WmLButtonDblClk,
    };

    private static int MarkFlag(ClickMouseButton button) => button switch
    {
        ClickMouseButton.Right => MkRButton,
        ClickMouseButton.Middle => MkMButton,
        _ => MkLButton,
    };

    private static uint FlagsForDown(ClickMouseButton button) => button switch
    {
        ClickMouseButton.Left => MouseEventfLeftDown,
        ClickMouseButton.Right => MouseEventfRightDown,
        ClickMouseButton.Middle => MouseEventfMiddleDown,
        _ => MouseEventfLeftDown,
    };

    private static uint FlagsForUp(ClickMouseButton button) => button switch
    {
        ClickMouseButton.Left => MouseEventfLeftUp,
        ClickMouseButton.Right => MouseEventfRightUp,
        ClickMouseButton.Middle => MouseEventfMiddleUp,
        _ => MouseEventfLeftUp,
    };

    private static INPUT MakeMouseInput(uint dwFlags)
    {
        return new INPUT
        {
            type = InputMouse,
            Union = new InputUnion
            {
                mi = new MOUSEINPUT
                {
                    dx = 0,
                    dy = 0,
                    mouseData = 0,
                    dwFlags = dwFlags,
                    time = 0,
                    dwExtraInfo = UIntPtr.Zero,
                },
            },
        };
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [DllImport("user32.dll")]
    private static extern bool SetCursorPos(int x, int y);

    [DllImport("user32.dll")]
    private static extern IntPtr WindowFromPoint(POINT point);

    [DllImport("user32.dll")]
    private static extern bool ScreenToClient(IntPtr hWnd, ref POINT point);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

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

    [StructLayout(LayoutKind.Sequential)]
    private struct POINT
    {
        internal int X;
        internal int Y;
    }

    private const uint WmMouseMove = 0x0200;
    private const uint WmLButtonDown = 0x0201;
    private const uint WmLButtonUp = 0x0202;
    private const uint WmLButtonDblClk = 0x0203;
    private const uint WmRButtonDown = 0x0204;
    private const uint WmRButtonUp = 0x0205;
    private const uint WmRButtonDblClk = 0x0206;
    private const uint WmMButtonDown = 0x0207;
    private const uint WmMButtonUp = 0x0208;
    private const uint WmMButtonDblClk = 0x0209;
    private const int MkLButton = 0x0001;
    private const int MkRButton = 0x0002;
    private const int MkMButton = 0x0010;
}

internal readonly record struct PostedClick(IntPtr Hwnd, int ClientX, int ClientY, ClickMouseButton Button);
