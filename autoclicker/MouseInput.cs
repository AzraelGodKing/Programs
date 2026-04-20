using System.Runtime.InteropServices;

namespace AutoClicker;

internal static class MouseInput
{
    /// <summary>
    /// Sends click input with selected button and positioning mode.
    /// </summary>
    internal static unsafe bool SendClick(
        MouseButtonType button,
        bool useAbsolutePosition,
        int absoluteX,
        int absoluteY,
        out int lastError)
    {
        var (downFlag, upFlag) = button switch
        {
            MouseButtonType.Left => (NativeMethods.MouseeventfLeftDown, NativeMethods.MouseeventfLeftUp),
            MouseButtonType.Right => (NativeMethods.MouseeventfRightDown, NativeMethods.MouseeventfRightUp),
            MouseButtonType.Middle => (NativeMethods.MouseeventfMiddleDown, NativeMethods.MouseeventfMiddleUp),
            _ => (NativeMethods.MouseeventfLeftDown, NativeMethods.MouseeventfLeftUp),
        };

        var count = useAbsolutePosition ? 3 : 2;
        Span<NativeMethods.INPUT> inputs = stackalloc NativeMethods.INPUT[count];

        var index = 0;
        if (useAbsolutePosition)
        {
            inputs[index++] = BuildMouseInput(
                NativeMethods.MouseeventfMove | NativeMethods.MouseeventfAbsolute | NativeMethods.MouseeventfVirtualDesk,
                NormalizeVirtualX(absoluteX),
                NormalizeVirtualY(absoluteY));
        }

        inputs[index++] = BuildMouseInput(downFlag, 0, 0);
        inputs[index] = BuildMouseInput(upFlag, 0, 0);

        fixed (NativeMethods.INPUT* ptr = inputs)
        {
            var sent = NativeMethods.SendInput((uint)count, ptr, sizeof(NativeMethods.INPUT));
            if (sent == count)
            {
                lastError = 0;
                return true;
            }
        }

        lastError = Marshal.GetLastWin32Error();
        return false;
    }

    private static NativeMethods.INPUT BuildMouseInput(uint flags, int dx, int dy)
    {
        return new NativeMethods.INPUT
        {
            type = NativeMethods.InputMouse,
            Union = new NativeMethods.InputUnion
            {
                mi = new NativeMethods.MOUSEINPUT
                {
                    dx = dx,
                    dy = dy,
                    mouseData = 0,
                    dwFlags = flags,
                    time = 0,
                    dwExtraInfo = UIntPtr.Zero
                }
            }
        };
    }

    private static int NormalizeVirtualX(int x)
    {
        var vscreen = SystemInformation.VirtualScreen;
        return (int)Math.Round((x - vscreen.Left) * 65535d / Math.Max(1, vscreen.Width - 1));
    }

    private static int NormalizeVirtualY(int y)
    {
        var vscreen = SystemInformation.VirtualScreen;
        return (int)Math.Round((y - vscreen.Top) * 65535d / Math.Max(1, vscreen.Height - 1));
    }
}
