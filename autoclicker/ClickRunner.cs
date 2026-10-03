using System.Diagnostics;
using System.Runtime.InteropServices;

namespace AutoClicker;

internal sealed class ClickRunRequest
{
    public int IntervalMs { get; init; }
    public int JitterMaxMs { get; init; }
    public int PressMs { get; init; }
    public int ClicksPerTick { get; init; }
    public int ClickLimit { get; init; }
    public int TimeLimitMs { get; init; }
    public bool LeavePointer { get; init; }
    public int PositionJitterPx { get; init; }
    public bool UsePoints { get; init; }
    public ClickMouseButton Button { get; init; }
    public Point[] Points { get; init; } = Array.Empty<Point>();
    public Rectangle ScreenBounds { get; init; }
    public Action<Point>? OnBeforeMove { get; init; }
    public Action<Point>? OnAfterMove { get; init; }
    public Action? OnLimitReached { get; init; }
}

internal sealed class ClickRunner
{
    private const int BurstGapMs = 40;

    private readonly object _gate = new();
    private CancellationTokenSource? _cts;
    private Thread? _thread;
    private int _generation;
    private int _clicks;
    private volatile bool _running;

    public bool IsRunning => _running;

    public int ClicksSent => Volatile.Read(ref _clicks);

    public void ResetCount() => Interlocked.Exchange(ref _clicks, 0);

    public void Start(ClickRunRequest request)
    {
        Stop();
        CancellationToken token;
        int generation;
        lock (_gate)
        {
            _clicks = 0;
            generation = ++_generation;
            _cts = new CancellationTokenSource();
            token = _cts.Token;
            _running = true;
            _thread = new Thread(() => Run(token, request, generation))
            {
                IsBackground = true,
                Name = "AutoClicker",
            };
            _thread.Start();
        }
    }

    public void Stop()
    {
        CancellationTokenSource? cts;
        Thread? thread;
        lock (_gate)
        {
            _generation++;
            cts = _cts;
            thread = _thread;
            _running = false;
        }

        try
        {
            cts?.Cancel();
        }
        catch (ObjectDisposedException)
        {
            // already disposed
        }

        if (thread != null && thread.IsAlive && Thread.CurrentThread != thread)
            thread.Join(1500);

        if (thread == null || !thread.IsAlive)
        {
            cts?.Dispose();
            lock (_gate)
            {
                if (ReferenceEquals(_cts, cts))
                    _cts = null;
            }
        }
    }

    public static Point WithJitter(Point origin, int jitterPx, Rectangle screen)
    {
        if (jitterPx <= 0)
            return origin;

        var x = origin.X + Random.Shared.Next(-jitterPx, jitterPx + 1);
        var y = origin.Y + Random.Shared.Next(-jitterPx, jitterPx + 1);
        if (screen.Width <= 0 || screen.Height <= 0)
            return new Point(x, y);

        var maxX = Math.Max(screen.Left, screen.Right - 1);
        var maxY = Math.Max(screen.Top, screen.Bottom - 1);
        return new Point(Math.Clamp(x, screen.Left, maxX), Math.Clamp(y, screen.Top, maxY));
    }

    private void Run(CancellationToken token, ClickRunRequest request, int generation)
    {
        var periodSet = TimeBeginPeriod(1) == 0;
        var limitReached = false;
        try
        {
            limitReached = Loop(token, request);
        }
        finally
        {
            if (periodSet)
                TimeEndPeriod(1);

            lock (_gate)
            {
                if (generation == _generation)
                    _running = false;
            }
        }

        if (!limitReached || token.IsCancellationRequested)
            return;

        lock (_gate)
        {
            if (generation != _generation)
                return;
        }

        request.OnLimitReached?.Invoke();
    }

    private bool Loop(CancellationToken token, ClickRunRequest request)
    {
        var points = request.Points;
        var index = 0;
        var session = Stopwatch.StartNew();
        while (!token.IsCancellationRequested)
        {
            if (TimeLimitReached(request, session))
                return true;

            var tick = Stopwatch.StartNew();
            Point? postedTarget = null;
            if (request.UsePoints && points.Length > 0)
            {
                var dest = WithJitter(points[index], request.PositionJitterPx, request.ScreenBounds);
                if (request.LeavePointer)
                    postedTarget = dest;
                else
                {
                    request.OnBeforeMove?.Invoke(dest);
                    MouseInput.MoveCursorTo(dest.X, dest.Y);
                    request.OnAfterMove?.Invoke(dest);
                }

                index = (index + 1) % points.Length;
            }

            var perTick = Math.Max(1, request.ClicksPerTick);
            for (var i = 0; i < perTick; i++)
            {
                if (token.IsCancellationRequested)
                    return false;
                if (TimeLimitReached(request, session))
                    return true;
                if (i > 0 && Delay(BurstGapMs, token))
                    return false;
                if (!ClickOnce(request, token, postedTarget, asDoubleClick: i == 1))
                    return false;
                if (request.ClickLimit > 0 && ClicksSent >= request.ClickLimit)
                    return true;
                if (TimeLimitReached(request, session))
                    return true;
            }

            var jitter = request.JitterMaxMs > 0
                ? Random.Shared.Next(0, request.JitterMaxMs + 1)
                : 0;
            var interval = Math.Max(1, request.IntervalMs) + jitter;
            var remain = interval - (int)tick.ElapsedMilliseconds;
            if (request.TimeLimitMs > 0)
            {
                var untilLimit = (int)(request.TimeLimitMs - session.ElapsedMilliseconds);
                if (untilLimit < remain)
                    remain = Math.Max(0, untilLimit);
            }

            if (remain > 0 && Delay(remain, token))
                return false;
        }

        return false;
    }

    private static bool TimeLimitReached(ClickRunRequest request, Stopwatch session) =>
        request.TimeLimitMs > 0 && session.ElapsedMilliseconds >= request.TimeLimitMs;

    private bool ClickOnce(ClickRunRequest request, CancellationToken token, Point? postedTarget, bool asDoubleClick)
    {
        if (request.LeavePointer && postedTarget is Point screen)
            return PostClickOnce(request, token, screen, asDoubleClick);

        var held = false;
        try
        {
            MouseInput.SendButtonDown(request.Button);
            held = true;
            if (request.PressMs > 0 && Delay(request.PressMs, token))
                return false;
            MouseInput.SendButtonUp(request.Button);
            held = false;
            Interlocked.Increment(ref _clicks);
            return true;
        }
        finally
        {
            if (held)
                MouseInput.SendButtonUp(request.Button);
        }
    }

    private bool PostClickOnce(ClickRunRequest request, CancellationToken token, Point screen, bool asDoubleClick)
    {
        if (!MouseInput.TryPostDown(screen.X, screen.Y, request.Button, asDoubleClick, out var posted))
            return true;

        var held = true;
        try
        {
            if (request.PressMs > 0 && Delay(request.PressMs, token))
                return false;
            MouseInput.PostUp(posted);
            held = false;
            Interlocked.Increment(ref _clicks);
            return true;
        }
        finally
        {
            if (held)
                MouseInput.PostUp(posted);
        }
    }

    private static bool Delay(int milliseconds, CancellationToken token)
    {
        if (milliseconds <= 0)
            return token.IsCancellationRequested;

        var watch = Stopwatch.StartNew();
        while (watch.ElapsedMilliseconds < milliseconds)
        {
            if (token.IsCancellationRequested)
                return true;

            var remain = milliseconds - (int)watch.ElapsedMilliseconds;
            if (remain <= 0)
                break;
            if (remain > 16)
            {
                if (token.WaitHandle.WaitOne(remain - 10))
                    return true;
            }
            else if (remain > 2)
            {
                if (token.WaitHandle.WaitOne(1))
                    return true;
            }
            else
            {
                Thread.SpinWait(30);
            }
        }

        return token.IsCancellationRequested;
    }

    [DllImport("winmm.dll", EntryPoint = "timeBeginPeriod")]
    private static extern uint TimeBeginPeriod(uint uPeriod);

    [DllImport("winmm.dll", EntryPoint = "timeEndPeriod")]
    private static extern uint TimeEndPeriod(uint uPeriod);
}
