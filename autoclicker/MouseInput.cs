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
                NativeMethods.MouseeventfMove | NativeMethods.MouseeventfAbsolute,
                NormalizeAbsoluteX(absoluteX),
                NormalizeAbsoluteY(absoluteY));
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

    private static int NormalizeAbsoluteX(int x)
    {
        var width = Math.Max(1, Screen.PrimaryScreen?.Bounds.Width ?? 1);
        return (int)Math.Round(x * 65535d / (width - 1));
    }

    private static int NormalizeAbsoluteY(int y)
    {
        var height = Math.Max(1, Screen.PrimaryScreen?.Bounds.Height ?? 1);
        return (int)Math.Round(y * 65535d / (height - 1));
    }
}
