using System.Diagnostics;
using System.Runtime.InteropServices;

namespace AutoClicker;

public partial class MainForm : Form
{
    private const int StartHotKeyId = 1;
    private const int StopHotKeyId = 2;
    private const int WM_HOTKEY = 0x0312;
    private const uint ModNorepeat = 0x4000;
    private const uint VkF1 = 0x70;
    private const int CaptureCountdownSeconds = 3;
    private const int MouseMoveTolerancePx = 3;

    private readonly ClickRunner _runner = new();
    private readonly object _anchorLock = new();
    private readonly Stopwatch _runWatch = new();
    private readonly List<ClickPoint> _points = new();
    private readonly List<ClickPreset> _presets = new();
    private readonly ToolStripMenuItem _trayStartItem;
    private readonly ToolStripMenuItem _trayStopItem;

    private bool _startHotkeyRegistered;
    private bool _stopHotkeyRegistered;
    private bool _stopHotkeyConflict;
    private bool _holdRunning;
    private bool _sessionActive;
    private bool _captureCountdownActive;
    private bool _startCountdownActive;
    private bool _watchMouse;
    private bool _loadingUi;
    private bool _showFirstRunNotice = true;
    private int _captureSecondsRemaining;
    private int _startSecondsRemaining;
    private int _frozenClicks;
    private int _timeLimitMs;
    private bool _physicalHold;
    private PostedClick? _postedHold;
    private int _cursorMoveDepth;
    private Point _anchor;
    private TimeSpan _lastElapsed;

    public MainForm()
    {
        InitializeComponent();
        trayIcon.Icon = (Icon)SystemIcons.Application.Clone();
        trayIcon.DoubleClick += (_, _) => RestoreFromTray();
        var trayMenu = new ContextMenuStrip(components);
        _trayStartItem = new ToolStripMenuItem("Start", null, (_, _) => Start());
        _trayStopItem = new ToolStripMenuItem("Stop", null, (_, _) => Stop());
        trayMenu.Items.Add(_trayStartItem);
        trayMenu.Items.Add(_trayStopItem);
        trayMenu.Items.Add("Show", null, (_, _) => RestoreFromTray());
        trayMenu.Items.Add("Exit", null, (_, _) => Application.Exit());
        trayIcon.ContextMenuStrip = trayMenu;

        captureCountdownTimer.Tick += CaptureCountdownTimer_Tick;
        startDelayTimer.Tick += StartDelayTimer_Tick;
        uiTimer.Tick += UiTimer_Tick;
        modeClickRadio.CheckedChanged += (_, _) => UpdateUiState();
        modeHoldRadio.CheckedChanged += (_, _) => UpdateUiState();
        startHotkeyCombo.SelectedIndexChanged += (_, _) => ReregisterHotKey();
        stopHotkeyCombo.SelectedIndexChanged += (_, _) => ReregisterHotKey();
        startCtrlCheck.CheckedChanged += (_, _) => ReregisterHotKey();
        startAltCheck.CheckedChanged += (_, _) => ReregisterHotKey();
        startShiftCheck.CheckedChanged += (_, _) => ReregisterHotKey();
        stopCtrlCheck.CheckedChanged += (_, _) => ReregisterHotKey();
        stopAltCheck.CheckedChanged += (_, _) => ReregisterHotKey();
        stopShiftCheck.CheckedChanged += (_, _) => ReregisterHotKey();
        alwaysOnTopCheckBox.CheckedChanged += (_, _) => TopMost = alwaysOnTopCheckBox.Checked;
        fixedPositionCheckBox.CheckedChanged += (_, _) =>
        {
            if (!fixedPositionCheckBox.Checked)
                CancelCaptureCountdown();
            UpdateUiState();
        };
        pointsListBox.SelectedIndexChanged += (_, _) => UpdateUiState();
        pointsListBox.KeyDown += PointsListBox_KeyDown;
        removePointButton.Click += (_, _) => RemoveSelectedPoint();
        clearPointsButton.Click += (_, _) => ClearPoints();
        savePresetButton.Click += (_, _) => SavePreset();
        deletePresetButton.Click += (_, _) => DeletePreset();
        presetCombo.SelectedIndexChanged += (_, _) => LoadSelectedPreset();
        presetCombo.TextChanged += (_, _) =>
        {
            if (!_loadingUi)
                UpdateUiState();
        };

        ApplySettings(AppSettingsStore.Load());
        RefreshStats();
    }

    private void ApplySettings(AppSettings s)
    {
        _loadingUi = true;
        try
        {
            _presets.Clear();
            _presets.AddRange(s.Presets.Select(ClonePreset));
            _points.Clear();
            _points.AddRange(s.Points.Select(p => new ClickPoint { X = p.X, Y = p.Y }));

            SetNumeric(intervalNumericUpDown, s.IntervalMs);
            SetNumeric(jitterNumericUpDown, s.JitterMaxMs);
            SetNumeric(pressNumericUpDown, s.PressMs);
            SetNumeric(clicksPerTickNumericUpDown, s.ClicksPerTick);
            SetNumeric(clickLimitNumericUpDown, s.ClickLimit);
            SetNumeric(timeLimitNumericUpDown, s.TimeLimitSeconds);
            SetNumeric(startDelayNumericUpDown, s.StartDelaySeconds);
            leavePointerCheckBox.Checked = s.LeavePointer;
            SetNumeric(positionJitterNumericUpDown, s.PositionJitterPx);
            mouseButtonCombo.SelectedIndex = Math.Clamp(s.MouseButton, 0, mouseButtonCombo.Items.Count - 1);
            if (s.HoldMode)
                modeHoldRadio.Checked = true;
            else
                modeClickRadio.Checked = true;
            fixedPositionCheckBox.Checked = s.FixedPosition;
            stopOnMoveCheckBox.Checked = s.StopOnMouseMove;
            startHotkeyCombo.SelectedIndex = Math.Clamp(s.HotkeyFKeyIndex, 0, startHotkeyCombo.Items.Count - 1);
            stopHotkeyCombo.SelectedIndex = Math.Clamp(s.StopHotkeyFKeyIndex, 0, stopHotkeyCombo.Items.Count - 1);
            ApplyModifierChecks(startCtrlCheck, startAltCheck, startShiftCheck, s.StartHotkeyModifiers);
            ApplyModifierChecks(stopCtrlCheck, stopAltCheck, stopShiftCheck, s.StopHotkeyModifiers);
            minimizeToTrayCheckBox.Checked = s.MinimizeToTray;
            alwaysOnTopCheckBox.Checked = s.AlwaysOnTop;
            _showFirstRunNotice = s.ShowFirstRunNotice;
            TopMost = s.AlwaysOnTop;
            RefreshPresetCombo(null);
            RefreshPointsList();
        }
        finally
        {
            _loadingUi = false;
        }
    }

    private void SaveSettings()
    {
        var first = _points.Count > 0 ? _points[0] : null;
        AppSettingsStore.Save(new AppSettings
        {
            IntervalMs = intervalNumericUpDown.Value,
            JitterMaxMs = (int)jitterNumericUpDown.Value,
            PressMs = (int)pressNumericUpDown.Value,
            ClicksPerTick = (int)clicksPerTickNumericUpDown.Value,
            ClickLimit = (int)clickLimitNumericUpDown.Value,
            TimeLimitSeconds = (int)timeLimitNumericUpDown.Value,
            MouseButton = mouseButtonCombo.SelectedIndex,
            LeavePointer = leavePointerCheckBox.Checked,
            HoldMode = modeHoldRadio.Checked,
            FixedPosition = fixedPositionCheckBox.Checked,
            FixedX = first?.X,
            FixedY = first?.Y,
            Points = _points.Select(p => new ClickPoint { X = p.X, Y = p.Y }).ToList(),
            StartDelaySeconds = (int)startDelayNumericUpDown.Value,
            PositionJitterPx = (int)positionJitterNumericUpDown.Value,
            StopOnMouseMove = stopOnMoveCheckBox.Checked,
            HotkeyFKeyIndex = HotkeyIndex(startHotkeyCombo),
            StopHotkeyFKeyIndex = HotkeyIndex(stopHotkeyCombo),
            StartHotkeyModifiers = PackMods(startCtrlCheck.Checked, startAltCheck.Checked, startShiftCheck.Checked),
            StopHotkeyModifiers = PackMods(stopCtrlCheck.Checked, stopAltCheck.Checked, stopShiftCheck.Checked),
            MinimizeToTray = minimizeToTrayCheckBox.Checked,
            AlwaysOnTop = alwaysOnTopCheckBox.Checked,
            ShowFirstRunNotice = _showFirstRunNotice,
            Presets = _presets.Select(ClonePreset).ToList(),
        });
    }

    protected override void OnLoad(EventArgs e)
    {
        base.OnLoad(e);
        if (_showFirstRunNotice)
        {
            using var notice = new FirstRunNoticeForm();
            if (notice.ShowDialog(this) == DialogResult.OK)
                _showFirstRunNotice = !notice.DontShowAgain;
        }

        TryRegisterHotKey(showWarningOnFailure: true);
        UpdateUiState();
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        CancelCaptureCountdown();
        Stop();
        SaveSettings();
        UnregisterAllHotKeys();
        base.OnFormClosing(e);
    }

    protected override void OnResize(EventArgs e)
    {
        base.OnResize(e);
        if (minimizeToTrayCheckBox.Checked && WindowState == FormWindowState.Minimized)
        {
            Hide();
            trayIcon.Visible = true;
        }
    }

    private void RestoreFromTray()
    {
        Show();
        WindowState = FormWindowState.Normal;
        trayIcon.Visible = false;
        Activate();
    }

    private void TryRegisterHotKey(bool showWarningOnFailure)
    {
        if (!IsHandleCreated || _loadingUi)
            return;

        UnregisterAllHotKeys();

        var startVk = VkFromFKeyIndex(HotkeyIndex(startHotkeyCombo));
        var stopVk = VkFromFKeyIndex(HotkeyIndex(stopHotkeyCombo));
        var startMods = ModifierFlags(startCtrlCheck.Checked, startAltCheck.Checked, startShiftCheck.Checked);
        var stopMods = ModifierFlags(stopCtrlCheck.Checked, stopAltCheck.Checked, stopShiftCheck.Checked);
        _stopHotkeyConflict = startVk == stopVk && startMods == stopMods;

        _startHotkeyRegistered = TryRegisterHotKey(StartHotKeyId, startMods, startVk);
        _stopHotkeyRegistered = !_stopHotkeyConflict && TryRegisterHotKey(StopHotKeyId, stopMods, stopVk);
        UpdateHotkeyStatusLabel();

        if (!showWarningOnFailure)
            return;

        var problems = new List<string>();
        if (!_startHotkeyRegistered)
            problems.Add($"Start hotkey {CurrentStartHotkeyName()} is already in use.");
        if (_stopHotkeyConflict)
            problems.Add("Start and stop use the same key, so stop was not registered.");
        else if (!_stopHotkeyRegistered)
            problems.Add($"Stop hotkey {CurrentStopHotkeyName()} is already in use.");
        if (problems.Count == 0)
            return;

        ShowMessage(
            string.Join(" ", problems) + " You can still use the Start and Stop buttons.",
            "Hotkey unavailable",
            MessageBoxIcon.Warning);
    }

    private void ReregisterHotKey()
    {
        if (!IsHandleCreated || _loadingUi)
            return;
        TryRegisterHotKey(showWarningOnFailure: false);
    }

    private void UnregisterAllHotKeys()
    {
        if (!IsHandleCreated)
            return;
        if (_startHotkeyRegistered)
            UnregisterHotKey(Handle, StartHotKeyId);
        if (_stopHotkeyRegistered)
            UnregisterHotKey(Handle, StopHotKeyId);
        _startHotkeyRegistered = false;
        _stopHotkeyRegistered = false;
    }

    private bool TryRegisterHotKey(int id, uint mods, uint vk)
    {
        if (RegisterHotKey(Handle, id, mods, vk))
            return true;
        var withoutNoRepeat = mods & ~ModNorepeat;
        return withoutNoRepeat != mods && RegisterHotKey(Handle, id, withoutNoRepeat, vk);
    }

    private static uint VkFromFKeyIndex(int index) => VkF1 + (uint)Math.Clamp(index, 0, 11);

    private static uint ModifierFlags(bool ctrl, bool alt, bool shift)
    {
        var mods = ModNorepeat;
        if (alt)
            mods |= HotkeyMods.Alt;
        if (ctrl)
            mods |= HotkeyMods.Control;
        if (shift)
            mods |= HotkeyMods.Shift;
        return mods;
    }

    private static int PackMods(bool ctrl, bool alt, bool shift)
    {
        var mods = 0;
        if (alt)
            mods |= HotkeyMods.Alt;
        if (ctrl)
            mods |= HotkeyMods.Control;
        if (shift)
            mods |= HotkeyMods.Shift;
        return mods;
    }

    private static void ApplyModifierChecks(CheckBox ctrl, CheckBox alt, CheckBox shift, int mods)
    {
        ctrl.Checked = (mods & HotkeyMods.Control) != 0;
        alt.Checked = (mods & HotkeyMods.Alt) != 0;
        shift.Checked = (mods & HotkeyMods.Shift) != 0;
    }

    private static int HotkeyIndex(ComboBox combo) => Math.Clamp(combo.SelectedIndex, 0, 11);

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == WM_HOTKEY)
        {
            var id = m.WParam.ToInt32();
            if (id == StartHotKeyId)
            {
                if (!_captureCountdownActive)
                    Start();
                return;
            }

            if (id == StopHotKeyId)
            {
                if (_captureCountdownActive)
                    CancelCaptureCountdown();
                Stop();
                return;
            }
        }

        base.WndProc(ref m);
    }

    private void startButton_Click(object sender, EventArgs e) => Start();

    private void stopButton_Click(object sender, EventArgs e) => Stop();

    private void setPositionButton_Click(object sender, EventArgs e)
    {
        if (_captureCountdownActive)
        {
            CancelCaptureCountdown();
            return;
        }

        _captureCountdownActive = true;
        _captureSecondsRemaining = CaptureCountdownSeconds;
        positionLabel.Text = $"Move the mouse to the target… {_captureSecondsRemaining}";
        setPositionButton.Text = "Cancel capture";
        captureCountdownTimer.Start();
        UpdateUiState();
    }

    private void CaptureCountdownTimer_Tick(object? sender, EventArgs e)
    {
        _captureSecondsRemaining--;
        if (_captureSecondsRemaining > 0)
        {
            positionLabel.Text = $"Move the mouse to the target… {_captureSecondsRemaining}";
            return;
        }

        captureCountdownTimer.Stop();
        _captureCountdownActive = false;
        var cursor = Cursor.Position;
        _points.Add(new ClickPoint { X = cursor.X, Y = cursor.Y });
        ResetCaptureButtonText();
        RefreshPointsList();
        pointsListBox.SelectedIndex = _points.Count - 1;
        UpdateUiState();
    }

    private void CancelCaptureCountdown()
    {
        if (!_captureCountdownActive)
            return;
        captureCountdownTimer.Stop();
        _captureCountdownActive = false;
        ResetCaptureButtonText();
        RefreshPositionLabel();
        UpdateUiState();
    }

    private void ResetCaptureButtonText() => setPositionButton.Text = "Capture in 3s…";

    private void StartDelayTimer_Tick(object? sender, EventArgs e)
    {
        _startSecondsRemaining--;
        if (_startSecondsRemaining > 0)
        {
            statusLabel.Text = $"Status: Starting in {_startSecondsRemaining}…";
            return;
        }

        startDelayTimer.Stop();
        _startCountdownActive = false;
        BeginRun();
    }

    private void UiTimer_Tick(object? sender, EventArgs e)
    {
        if (_watchMouse && MouseMoved())
        {
            Stop();
            return;
        }

        if (_timeLimitMs > 0 && _runWatch.IsRunning && _runWatch.ElapsedMilliseconds >= _timeLimitMs)
        {
            Stop();
            return;
        }

        RefreshStats();
    }

    private void PointsListBox_KeyDown(object? sender, KeyEventArgs e)
    {
        if (e.KeyCode == Keys.Delete && removePointButton.Enabled)
        {
            RemoveSelectedPoint();
            e.Handled = true;
        }
    }

    private void RemoveSelectedPoint()
    {
        var index = pointsListBox.SelectedIndex;
        if (index < 0 || index >= _points.Count)
            return;
        _points.RemoveAt(index);
        RefreshPointsList();
        if (_points.Count > 0)
            pointsListBox.SelectedIndex = Math.Min(index, _points.Count - 1);
        UpdateUiState();
    }

    private void ClearPoints()
    {
        _points.Clear();
        RefreshPointsList();
        UpdateUiState();
    }

    private void Start()
    {
        if (_captureCountdownActive || _startCountdownActive || _sessionActive)
            return;

        if (fixedPositionCheckBox.Checked && _points.Count == 0)
        {
            ShowMessage(
                "Turn off saved points, or use \"Capture in 3s…\" and move the mouse to the spot before the countdown ends.",
                "Saved points",
                MessageBoxIcon.Information);
            return;
        }

        var delay = (int)startDelayNumericUpDown.Value;
        if (delay > 0)
        {
            _startCountdownActive = true;
            _startSecondsRemaining = delay;
            statusLabel.Text = $"Status: Starting in {_startSecondsRemaining}…";
            startDelayTimer.Start();
            UpdateUiState();
            return;
        }

        BeginRun();
    }

    private void BeginRun()
    {
        _frozenClicks = 0;
        _lastElapsed = TimeSpan.Zero;
        _timeLimitMs = Math.Max(0, (int)timeLimitNumericUpDown.Value) * 1000;
        _runWatch.Restart();
        _sessionActive = true;

        if (modeHoldRadio.Checked)
        {
            BeginHold();
            return;
        }

        ArmMouseWatch(Cursor.Position);
        _runner.Start(BuildRequest());
        uiTimer.Start();
        UpdateUiState();
        RefreshStats();
    }

    private void BeginHold()
    {
        _postedHold = null;
        _physicalHold = false;
        var button = CurrentMouseButton();
        if (LeavePointerActive() && _points.Count > 0)
        {
            var origin = new Point(_points[0].X, _points[0].Y);
            var dest = ClickRunner.WithJitter(origin, (int)positionJitterNumericUpDown.Value, SystemInformation.VirtualScreen);
            if (MouseInput.TryPostDown(dest.X, dest.Y, button, asDoubleClick: false, out var posted))
                _postedHold = posted;
        }
        else
        {
            if (fixedPositionCheckBox.Checked && _points.Count > 0)
            {
                var origin = new Point(_points[0].X, _points[0].Y);
                var dest = ClickRunner.WithJitter(origin, (int)positionJitterNumericUpDown.Value, SystemInformation.VirtualScreen);
                MouseInput.MoveCursorTo(dest.X, dest.Y);
            }

            MouseInput.SendButtonDown(button);
            _physicalHold = true;
        }

        _holdRunning = true;
        ArmMouseWatch(Cursor.Position);
        uiTimer.Start();
        UpdateUiState();
        RefreshStats();
    }

    private ClickRunRequest BuildRequest()
    {
        Action<Point>? beforeMove = null;
        Action<Point>? afterMove = null;
        if (stopOnMoveCheckBox.Checked)
        {
            beforeMove = BeginCursorMove;
            afterMove = EndCursorMove;
        }

        return new ClickRunRequest
        {
            IntervalMs = Math.Max(1, (int)intervalNumericUpDown.Value),
            JitterMaxMs = Math.Max(0, (int)jitterNumericUpDown.Value),
            PressMs = Math.Max(0, (int)pressNumericUpDown.Value),
            ClicksPerTick = Math.Max(1, (int)clicksPerTickNumericUpDown.Value),
            ClickLimit = Math.Max(0, (int)clickLimitNumericUpDown.Value),
            TimeLimitMs = _timeLimitMs,
            PositionJitterPx = Math.Max(0, (int)positionJitterNumericUpDown.Value),
            UsePoints = fixedPositionCheckBox.Checked,
            LeavePointer = LeavePointerActive(),
            Button = CurrentMouseButton(),
            Points = _points.Select(p => new Point(p.X, p.Y)).ToArray(),
            ScreenBounds = SystemInformation.VirtualScreen,
            OnBeforeMove = beforeMove,
            OnAfterMove = afterMove,
            OnLimitReached = () =>
            {
                if (IsDisposed || !IsHandleCreated)
                    return;
                try
                {
                    BeginInvoke(OnRunFinished);
                }
                catch (ObjectDisposedException)
                {
                    // window already closed
                }
                catch (InvalidOperationException)
                {
                    // handle is going away
                }
            },
        };
    }

    private void OnRunFinished()
    {
        if (IsDisposed || !_sessionActive)
            return;
        Stop();
    }

    private void Stop()
    {
        var wasCountdown = _startCountdownActive;
        var wasSession = _sessionActive;
        var wasHold = _holdRunning;

        _startCountdownActive = false;
        startDelayTimer.Stop();
        _watchMouse = false;
        uiTimer.Stop();
        _holdRunning = false;
        _sessionActive = false;

        _runner.Stop();
        if (wasSession && !wasHold)
            _frozenClicks = _runner.ClicksSent;

        if (wasHold)
            ReleaseHold();

        if (_runWatch.IsRunning)
        {
            _lastElapsed = _runWatch.Elapsed;
            _runWatch.Stop();
        }

        if (!wasSession && !wasCountdown)
            return;

        UpdateUiState();
        RefreshStats();
    }

    private bool LeavePointerActive() =>
        leavePointerCheckBox.Checked && fixedPositionCheckBox.Checked;

    private void ReleaseHold()
    {
        if (_postedHold is { } posted)
            MouseInput.PostUp(posted);
        else if (_physicalHold)
            MouseInput.SendButtonUp(CurrentMouseButton());

        _postedHold = null;
        _physicalHold = false;
    }

    private void ArmMouseWatch(Point anchor)
    {
        if (!stopOnMoveCheckBox.Checked)
        {
            _watchMouse = false;
            return;
        }

        lock (_anchorLock)
            _anchor = anchor;
        _watchMouse = true;
    }

    private void BeginCursorMove(Point destination)
    {
        Interlocked.Increment(ref _cursorMoveDepth);
        lock (_anchorLock)
            _anchor = destination;
    }

    private void EndCursorMove(Point destination)
    {
        lock (_anchorLock)
            _anchor = destination;
        Interlocked.Decrement(ref _cursorMoveDepth);
    }

    private bool MouseMoved()
    {
        if (Volatile.Read(ref _cursorMoveDepth) > 0)
            return false;

        var cursor = Cursor.Position;
        if (Volatile.Read(ref _cursorMoveDepth) > 0)
            return false;

        lock (_anchorLock)
        {
            return Math.Abs(cursor.X - _anchor.X) > MouseMoveTolerancePx
                || Math.Abs(cursor.Y - _anchor.Y) > MouseMoveTolerancePx;
        }
    }

    private ClickMouseButton CurrentMouseButton() =>
        (ClickMouseButton)Math.Clamp(mouseButtonCombo.SelectedIndex, 0, 2);

    private void RefreshPointsList()
    {
        var selected = pointsListBox.SelectedIndex;
        pointsListBox.BeginUpdate();
        pointsListBox.Items.Clear();
        for (var i = 0; i < _points.Count; i++)
            pointsListBox.Items.Add($"{i + 1}. {_points[i].X}, {_points[i].Y}");
        pointsListBox.EndUpdate();
        if (selected >= 0 && selected < pointsListBox.Items.Count)
            pointsListBox.SelectedIndex = selected;
        RefreshPositionLabel();
    }

    private void RefreshPositionLabel()
    {
        if (_captureCountdownActive)
            return;
        positionLabel.Text = _points.Count switch
        {
            0 => "No points yet",
            1 => "1 point",
            _ => $"{_points.Count} points",
        };
    }

    private void RefreshStats()
    {
        var elapsed = _runWatch.IsRunning ? _runWatch.Elapsed : _lastElapsed;
        var clicks = _sessionActive && !_holdRunning ? _runner.ClicksSent : _frozenClicks;
        var stats = _holdRunning
            ? $"Holding — {elapsed:mm\\:ss}"
            : $"Clicks: {clicks} — {elapsed:mm\\:ss}";
        if (statsLabel.Text != stats)
            statsLabel.Text = stats;

        if (!_startCountdownActive)
            return;
        var status = $"Status: Starting in {_startSecondsRemaining}…";
        if (statusLabel.Text != status)
            statusLabel.Text = status;
    }

    private void UpdateHotkeyStatusLabel()
    {
        var start = _startHotkeyRegistered
            ? $"Start: {CurrentStartHotkeyName()}"
            : $"Start: {CurrentStartHotkeyName()} (unavailable)";
        var stop = _stopHotkeyConflict
            ? $"Stop: {CurrentStopHotkeyName()} (same as start)"
            : _stopHotkeyRegistered
                ? $"Stop: {CurrentStopHotkeyName()}"
                : $"Stop: {CurrentStopHotkeyName()} (unavailable)";
        hotkeyStatusLabel.Text = start + Environment.NewLine + stop;
    }

    private string CurrentStartHotkeyName() =>
        FormatHotkey(HotkeyIndex(startHotkeyCombo), startCtrlCheck.Checked, startAltCheck.Checked, startShiftCheck.Checked);

    private string CurrentStopHotkeyName() =>
        FormatHotkey(HotkeyIndex(stopHotkeyCombo), stopCtrlCheck.Checked, stopAltCheck.Checked, stopShiftCheck.Checked);

    private static string FormatHotkey(int index, bool ctrl, bool alt, bool shift)
    {
        var parts = new List<string>();
        if (ctrl)
            parts.Add("Ctrl");
        if (alt)
            parts.Add("Alt");
        if (shift)
            parts.Add("Shift");
        parts.Add("F" + (index + 1));
        return string.Join("+", parts);
    }

    private void UpdateUiState()
    {
        var running = _sessionActive || _startCountdownActive;
        var clickMode = modeClickRadio.Checked;
        var capturing = _captureCountdownActive;
        var locked = running || capturing;
        var pointsOn = fixedPositionCheckBox.Checked;

        startButton.Enabled = !running && !capturing;
        stopButton.Enabled = running;
        _trayStartItem.Enabled = startButton.Enabled;
        _trayStopItem.Enabled = stopButton.Enabled;
        trayIcon.Text = running ? "AutoClicker (running)" : "AutoClicker";

        if (_startCountdownActive)
            statusLabel.Text = $"Status: Starting in {_startSecondsRemaining}…";
        else
            statusLabel.Text = _sessionActive ? "Status: Running" : "Status: Stopped";

        SetEnabled(intervalLabel, intervalNumericUpDown, clickMode && !locked);
        SetEnabled(jitterLabel, jitterNumericUpDown, clickMode && !locked);
        SetEnabled(pressLabel, pressNumericUpDown, clickMode && !locked);
        SetEnabled(clicksPerTickLabel, clicksPerTickNumericUpDown, clickMode && !locked);
        SetEnabled(clickLimitLabel, clickLimitNumericUpDown, clickMode && !locked);
        SetEnabled(timeLimitLabel, timeLimitNumericUpDown, !locked);
        SetEnabled(startDelayLabel, startDelayNumericUpDown, !locked);
        leavePointerCheckBox.Enabled = pointsOn && !locked;
        SetEnabled(positionJitterLabel, positionJitterNumericUpDown, pointsOn && !locked);
        SetEnabled(mouseButtonLabel, mouseButtonCombo, !locked);

        modeLabel.Enabled = !locked;
        modeClickRadio.Enabled = !locked;
        modeHoldRadio.Enabled = !locked;
        stopOnMoveCheckBox.Enabled = !locked;
        fixedPositionCheckBox.Enabled = !locked;
        setPositionButton.Enabled = pointsOn && !_sessionActive && !_startCountdownActive;
        removePointButton.Enabled = pointsOn && !locked && pointsListBox.SelectedIndex >= 0;
        clearPointsButton.Enabled = pointsOn && !locked && _points.Count > 0;
        pointsListBox.Enabled = pointsOn;
        positionLabel.Enabled = true;

        SetEnabled(startHotkeyLabel, startHotkeyCombo, !locked);
        startCtrlCheck.Enabled = !locked;
        startAltCheck.Enabled = !locked;
        startShiftCheck.Enabled = !locked;
        SetEnabled(stopHotkeyLabel, stopHotkeyCombo, !locked);
        stopCtrlCheck.Enabled = !locked;
        stopAltCheck.Enabled = !locked;
        stopShiftCheck.Enabled = !locked;
        minimizeToTrayCheckBox.Enabled = !locked;

        presetLabel.Enabled = !locked;
        presetCombo.Enabled = !locked;
        savePresetButton.Enabled = !locked;
        var presetName = presetCombo.Text.Trim();
        deletePresetButton.Enabled = !locked && _presets.Exists(p =>
            string.Equals(p.Name, presetName, StringComparison.OrdinalIgnoreCase));
    }

    private static void SetEnabled(Control label, Control input, bool enabled)
    {
        label.Enabled = enabled;
        input.Enabled = enabled;
    }

    private void LoadSelectedPreset()
    {
        if (_loadingUi || presetCombo.SelectedIndex < 0)
            return;
        var name = presetCombo.SelectedItem as string ?? presetCombo.Text;
        var preset = _presets.FirstOrDefault(p => string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase));
        if (preset != null)
            ApplyPreset(preset);
    }

    private void ApplyPreset(ClickPreset preset)
    {
        _loadingUi = true;
        try
        {
            SetNumeric(intervalNumericUpDown, preset.IntervalMs);
            SetNumeric(jitterNumericUpDown, preset.JitterMaxMs);
            SetNumeric(pressNumericUpDown, preset.PressMs);
            SetNumeric(clicksPerTickNumericUpDown, preset.ClicksPerTick);
            SetNumeric(clickLimitNumericUpDown, preset.ClickLimit);
            SetNumeric(timeLimitNumericUpDown, preset.TimeLimitSeconds);
            SetNumeric(startDelayNumericUpDown, preset.StartDelaySeconds);
            leavePointerCheckBox.Checked = preset.LeavePointer;
            SetNumeric(positionJitterNumericUpDown, preset.PositionJitterPx);
            mouseButtonCombo.SelectedIndex = Math.Clamp(preset.MouseButton, 0, mouseButtonCombo.Items.Count - 1);
            if (preset.HoldMode)
                modeHoldRadio.Checked = true;
            else
                modeClickRadio.Checked = true;
            stopOnMoveCheckBox.Checked = preset.StopOnMouseMove;
            _points.Clear();
            _points.AddRange(preset.Points.Select(p => new ClickPoint { X = p.X, Y = p.Y }));
            fixedPositionCheckBox.Checked = preset.UsePoints;
            RefreshPointsList();
        }
        finally
        {
            _loadingUi = false;
        }

        UpdateUiState();
    }

    private void SavePreset()
    {
        var name = presetCombo.Text.Trim();
        if (name.Length == 0)
        {
            ShowMessage("Type a preset name, then click Save.", "Preset", MessageBoxIcon.Information);
            return;
        }

        if (name.Length > presetCombo.MaxLength)
            name = name[..presetCombo.MaxLength];

        var preset = CapturePreset(name);
        var index = _presets.FindIndex(p => string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase));
        if (index >= 0)
            _presets[index] = preset;
        else
            _presets.Add(preset);
        RefreshPresetCombo(name);
        UpdateUiState();
    }

    private void DeletePreset()
    {
        var name = presetCombo.Text.Trim();
        if (name.Length == 0)
            return;
        if (_presets.RemoveAll(p => string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase)) == 0)
            return;
        RefreshPresetCombo(null);
        UpdateUiState();
    }

    private ClickPreset CapturePreset(string name) => new()
    {
        Name = name,
        IntervalMs = intervalNumericUpDown.Value,
        JitterMaxMs = (int)jitterNumericUpDown.Value,
        PressMs = (int)pressNumericUpDown.Value,
        ClicksPerTick = (int)clicksPerTickNumericUpDown.Value,
        ClickLimit = (int)clickLimitNumericUpDown.Value,
        TimeLimitSeconds = (int)timeLimitNumericUpDown.Value,
        MouseButton = mouseButtonCombo.SelectedIndex,
        HoldMode = modeHoldRadio.Checked,
        LeavePointer = leavePointerCheckBox.Checked,
        StartDelaySeconds = (int)startDelayNumericUpDown.Value,
        PositionJitterPx = (int)positionJitterNumericUpDown.Value,
        StopOnMouseMove = stopOnMoveCheckBox.Checked,
        UsePoints = fixedPositionCheckBox.Checked,
        Points = _points.Select(p => new ClickPoint { X = p.X, Y = p.Y }).ToList(),
    };

    private void RefreshPresetCombo(string? selectedName)
    {
        var previous = _loadingUi;
        _loadingUi = true;
        try
        {
            presetCombo.BeginUpdate();
            presetCombo.Items.Clear();
            foreach (var name in _presets.Select(p => p.Name).OrderBy(n => n, StringComparer.OrdinalIgnoreCase))
                presetCombo.Items.Add(name);
            presetCombo.EndUpdate();

            if (string.IsNullOrEmpty(selectedName))
            {
                presetCombo.SelectedIndex = -1;
                presetCombo.Text = "";
                return;
            }

            var index = presetCombo.FindStringExact(selectedName);
            presetCombo.SelectedIndex = index;
            if (index < 0)
                presetCombo.Text = selectedName;
        }
        finally
        {
            _loadingUi = previous;
        }
    }

    private static ClickPreset ClonePreset(ClickPreset preset) => new()
    {
        Name = preset.Name,
        IntervalMs = preset.IntervalMs,
        JitterMaxMs = preset.JitterMaxMs,
        PressMs = preset.PressMs,
        ClicksPerTick = preset.ClicksPerTick,
        ClickLimit = preset.ClickLimit,
        TimeLimitSeconds = preset.TimeLimitSeconds,
        MouseButton = preset.MouseButton,
        HoldMode = preset.HoldMode,
        LeavePointer = preset.LeavePointer,
        StartDelaySeconds = preset.StartDelaySeconds,
        PositionJitterPx = preset.PositionJitterPx,
        StopOnMouseMove = preset.StopOnMouseMove,
        UsePoints = preset.UsePoints,
        Points = preset.Points.Select(p => new ClickPoint { X = p.X, Y = p.Y }).ToList(),
    };

    private static void SetNumeric(NumericUpDown box, decimal value) =>
        box.Value = Math.Clamp(value, box.Minimum, box.Maximum);

    private void ShowMessage(string text, string caption, MessageBoxIcon icon)
    {
        if (Visible)
            MessageBox.Show(this, text, caption, MessageBoxButtons.OK, icon);
        else
            MessageBox.Show(text, caption, MessageBoxButtons.OK, icon);
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool UnregisterHotKey(IntPtr hWnd, int id);
}
