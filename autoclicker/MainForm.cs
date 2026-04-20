using System.Diagnostics;
using System.Linq;
using System.Threading;

namespace AutoClicker;

public partial class MainForm : Form
{
    private const int HotKeyId = 1;
    private static readonly Keys[] SupportedHotkeys =
    {
        Keys.F1, Keys.F2, Keys.F3, Keys.F4, Keys.F5, Keys.F6, Keys.F7, Keys.F8, Keys.F9, Keys.F10, Keys.F11, Keys.F12
    };

    private AppSettings _settings;
    private readonly GlobalHotkey _globalHotkey;
    private readonly PositionPicker _positionPicker = new();
    private readonly NotifyIcon _trayIcon;
    private readonly Random _random = new();
    private System.Threading.Timer? _clickTimer;
    private CancellationTokenSource? _runCancellationTokenSource;
    private volatile bool _running;
    private bool _warnedSendInputFailure;
    private long _clickCount;
    private DateTime _startedAtUtc;
    private Dictionary<string, AppSettings> _profiles = new(StringComparer.OrdinalIgnoreCase);

    public MainForm()
    {
        InitializeComponent();
        _settings = SettingsStore.Load();
        _globalHotkey = new GlobalHotkey(Handle, HotKeyId);
        _globalHotkey.Pressed += GlobalHotkey_Pressed;

        var trayMenu = new ContextMenuStrip();
        trayMenu.Items.Add("Show", null, (_, _) => ShowFromTray());
        trayMenu.Items.Add("Start", null, (_, _) => Start());
        trayMenu.Items.Add("Stop", null, (_, _) => Stop());
        trayMenu.Items.Add("-");
        trayMenu.Items.Add("Exit", null, (_, _) => Close());
        _trayIcon = new NotifyIcon
        {
            Text = "AutoClicker",
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath),
            Visible = false,
            ContextMenuStrip = trayMenu
        };
        _trayIcon.DoubleClick += (_, _) => ShowFromTray();

        InitializeComboBoxes();
        InitializeTooltips();
        ApplySettingsToUi();
        ApplyHotkeyRegistration();
        InitializeProfiles();
        AcceptButton = startButton;
    }

    protected override void OnLoad(EventArgs e)
    {
        base.OnLoad(e);
        if (_settings.ShowFirstRunNotice)
        {
            using var notice = new FirstRunNoticeForm();
            if (notice.ShowDialog(this) == DialogResult.OK)
            {
                _settings.ShowFirstRunNotice = !notice.DontShowAgain;
                SettingsStore.Save(_settings);
            }
        }
        UpdateUiState();
    }

    protected override void OnFormClosed(FormClosedEventArgs e)
    {
        Stop();
        _positionPicker.Dispose();
        _globalHotkey.Dispose();
        _trayIcon.Visible = false;
        _trayIcon.Dispose();
        SettingsStore.Save(CollectSettingsFromUi());
        base.OnFormClosed(e);
    }

    protected override void WndProc(ref Message m)
    {
        if (_globalHotkey.ProcessMessage(ref m))
            return;
        base.WndProc(ref m);
    }

    private void startButton_Click(object? sender, EventArgs e) => Start();

    private void stopButton_Click(object? sender, EventArgs e) => Stop();

    private void intervalNumericUpDown_ValueChanged(object? sender, EventArgs e)
    {
        SaveFromUi();
        if (_running)
            RestartTimer();
    }

    private void intervalUnitComboBox_SelectedIndexChanged(object? sender, EventArgs e)
    {
        SaveFromUi();
        if (_running)
            RestartTimer();
    }

    private void hotkeyControl_Changed(object? sender, EventArgs e)
    {
        SaveFromUi();
        ApplyHotkeyRegistration();
    }

    private void mouseButtonComboBox_SelectedIndexChanged(object? sender, EventArgs e) => SaveFromUi();

    private void clickTypeComboBox_SelectedIndexChanged(object? sender, EventArgs e) => SaveFromUi();

    private void clicksPerTriggerNumericUpDown_ValueChanged(object? sender, EventArgs e) => SaveFromUi();

    private void fixedPositionCheckBox_CheckedChanged(object? sender, EventArgs e)
    {
        fixedXNumericUpDown.Enabled = fixedPositionCheckBox.Checked;
        fixedYNumericUpDown.Enabled = fixedPositionCheckBox.Checked;
        pickPositionButton.Enabled = fixedPositionCheckBox.Checked;
        SaveFromUi();
    }

    private void fixedPositionValueChanged(object? sender, EventArgs e) => SaveFromUi();

    private void clickLimitCheckBox_CheckedChanged(object? sender, EventArgs e)
    {
        clickLimitNumericUpDown.Enabled = clickLimitCheckBox.Checked;
        SaveFromUi();
    }

    private void clickLimitNumericUpDown_ValueChanged(object? sender, EventArgs e) => SaveFromUi();

    private void durationLimitCheckBox_CheckedChanged(object? sender, EventArgs e)
    {
        durationLimitNumericUpDown.Enabled = durationLimitCheckBox.Checked;
        SaveFromUi();
    }

    private void durationLimitNumericUpDown_ValueChanged(object? sender, EventArgs e) => SaveFromUi();

    private void jitterCheckBox_CheckedChanged(object? sender, EventArgs e)
    {
        jitterNumericUpDown.Enabled = jitterCheckBox.Checked;
        SaveFromUi();
        if (_running)
            RestartTimer();
    }

    private void jitterNumericUpDown_ValueChanged(object? sender, EventArgs e)
    {
        SaveFromUi();
        if (_running)
            RestartTimer();
    }

    private void alwaysOnTopCheckBox_CheckedChanged(object? sender, EventArgs e)
    {
        TopMost = alwaysOnTopCheckBox.Checked;
        SaveFromUi();
    }

    private void minimizeToTrayCheckBox_CheckedChanged(object? sender, EventArgs e) => SaveFromUi();

    private async void pickPositionButton_Click(object? sender, EventArgs e)
    {
        if (!fixedPositionCheckBox.Checked)
            return;

        statusLabel.Text = "Status: Click anywhere to capture position...";
        var position = await _positionPicker.PickNextPositionAsync().ConfigureAwait(true);
        fixedXNumericUpDown.Value = Math.Clamp(position.X, fixedXNumericUpDown.Minimum, fixedXNumericUpDown.Maximum);
        fixedYNumericUpDown.Value = Math.Clamp(position.Y, fixedYNumericUpDown.Minimum, fixedYNumericUpDown.Maximum);
        statusLabel.Text = _running ? "Status: Running" : "Status: Stopped";
        SaveFromUi();
    }

    private void MainForm_Shown(object? sender, EventArgs e)
    {
        intervalNumericUpDown.Select();
    }

    private void MainForm_Resize(object? sender, EventArgs e)
    {
        if (!minimizeToTrayCheckBox.Checked || WindowState != FormWindowState.Minimized)
            return;

        HideToTray();
    }

    private void MainForm_FormClosing(object? sender, FormClosingEventArgs e)
    {
        if (e.CloseReason == CloseReason.UserClosing && minimizeToTrayCheckBox.Checked)
        {
            e.Cancel = true;
            HideToTray();
        }
    }

    private void UpdateUiState()
    {
        var running = _running;
        startButton.Enabled = !running;
        stopButton.Enabled = running;
        statusLabel.Text = running ? "Status: Running" : "Status: Stopped";
        intervalNumericUpDown.Enabled = !running;
        intervalUnitComboBox.Enabled = !running;
        hotkeyComboBox.Enabled = !running;
        hotkeyCtrlCheckBox.Enabled = !running;
        hotkeyAltCheckBox.Enabled = !running;
        hotkeyShiftCheckBox.Enabled = !running;
        hotkeyWinCheckBox.Enabled = !running;
    }

    private void Start()
    {
        if (_running)
            return;

        _running = true;
        _warnedSendInputFailure = false;
        Interlocked.Exchange(ref _clickCount, 0);
        _startedAtUtc = DateTime.UtcNow;
        _runCancellationTokenSource = new CancellationTokenSource();
        StartTimer(_runCancellationTokenSource.Token);
        uiUpdateTimer.Start();
        UpdateClickCounter();
        UpdateUiState();
    }

    private void Stop()
    {
        if (!_running)
            return;

        _running = false;
        _runCancellationTokenSource?.Cancel();
        _runCancellationTokenSource?.Dispose();
        _runCancellationTokenSource = null;
        _clickTimer?.Dispose();
        _clickTimer = null;
        uiUpdateTimer.Stop();
        UpdateStatsLabels();
        UpdateUiState();
    }

    private void ToggleRunning()
    {
        if (_running)
            Stop();
        else
            Start();
    }

    private void RestartTimer()
    {
        if (!_running || _runCancellationTokenSource == null)
            return;
        _clickTimer?.Dispose();
        StartTimer(_runCancellationTokenSource.Token);
    }

    private void StartTimer(CancellationToken token)
    {
        var due = GetNextIntervalMilliseconds();
        _clickTimer = new System.Threading.Timer(_ =>
        {
            if (token.IsCancellationRequested || !_running)
                return;

            RunClickTrigger();
            if (_clickTimer != null && !token.IsCancellationRequested && _running)
                _clickTimer.Change(GetNextIntervalMilliseconds(), Timeout.Infinite);
        }, null, due, Timeout.Infinite);
    }

    private void RunClickTrigger()
    {
        var clickType = clickTypeComboBox.SelectedItem is ClickType ct ? ct : ClickType.Single;
        var button = mouseButtonComboBox.SelectedItem is MouseButtonType mb ? mb : MouseButtonType.Left;
        var clicksPerTrigger = (int)clicksPerTriggerNumericUpDown.Value;
        var clickLoops = clickType == ClickType.Double ? clicksPerTrigger * 2 : clicksPerTrigger;
        var fixedPosition = fixedPositionCheckBox.Checked;
        var x = (int)fixedXNumericUpDown.Value;
        var y = (int)fixedYNumericUpDown.Value;

        for (var i = 0; i < clickLoops; i++)
        {
            if (!MouseInput.SendClick(button, fixedPosition, x, y, out var lastError))
            {
                if (!_warnedSendInputFailure)
                {
                    _warnedSendInputFailure = true;
                    BeginInvoke((MethodInvoker)(() =>
                    {
                        MessageBox.Show(
                            this,
                            $"SendInput failed (error {lastError}). This may be blocked by UIPI/elevation differences.",
                            "Input warning",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Warning);
                    }));
                }
                break;
            }
            Interlocked.Increment(ref _clickCount);
        }

        BeginInvoke((MethodInvoker)(() =>
        {
            UpdateClickCounter();
            if (ShouldStopByLimits())
                Stop();
        }));
    }

    private bool ShouldStopByLimits()
    {
        if (clickLimitCheckBox.Checked && _clickCount >= (long)clickLimitNumericUpDown.Value)
            return true;

        if (durationLimitCheckBox.Checked)
        {
            var elapsed = DateTime.UtcNow - _startedAtUtc;
            if (elapsed.TotalSeconds >= (double)durationLimitNumericUpDown.Value)
                return true;
        }

        return false;
    }

    private void UpdateClickCounter()
    {
        clickCounterLabel.Text = $"Clicks: {Interlocked.Read(ref _clickCount)}";
    }

    private int GetNextIntervalMilliseconds()
    {
        var baseInterval = ConvertIntervalToMilliseconds(intervalNumericUpDown.Value, GetSelectedIntervalUnit());
        if (!jitterCheckBox.Checked || jitterNumericUpDown.Value <= 0)
            return baseInterval;

        var percent = (double)jitterNumericUpDown.Value / 100d;
        var min = Math.Max(1, (int)Math.Round(baseInterval * (1d - percent)));
        var max = Math.Max(min, (int)Math.Round(baseInterval * (1d + percent)));
        return _random.Next(min, max + 1);
    }

    private static int ConvertIntervalToMilliseconds(decimal value, IntervalUnit unit)
    {
        return unit switch
        {
            IntervalUnit.Seconds => Math.Max(1, (int)Math.Round(value * 1000m)),
            IntervalUnit.Minutes => Math.Max(1, (int)Math.Round(value * 60000m)),
            _ => Math.Max(1, (int)Math.Round(value)),
        };
    }

    private IntervalUnit GetSelectedIntervalUnit()
    {
        return intervalUnitComboBox.SelectedItem is IntervalUnit iu ? iu : IntervalUnit.Milliseconds;
    }

    private void ApplyHotkeyRegistration()
    {
        var key = hotkeyComboBox.SelectedItem is Keys selected ? selected : Keys.F6;
        var success = _globalHotkey.Register(key, hotkeyCtrlCheckBox.Checked, hotkeyAltCheckBox.Checked, hotkeyShiftCheckBox.Checked, hotkeyWinCheckBox.Checked);
        hotkeyLabel.Text = success ? $"Hotkey: {FormatHotkeyLabel()}" : $"Hotkey: unavailable ({FormatHotkeyLabel()})";
        if (!success)
        {
            MessageBox.Show(
                this,
                $"Could not register global hotkey {FormatHotkeyLabel()}. Another app may already use it.",
                "Hotkey unavailable",
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning);
        }
    }

    private string FormatHotkeyLabel()
    {
        var parts = new List<string>();
        if (hotkeyCtrlCheckBox.Checked) parts.Add("Ctrl");
        if (hotkeyAltCheckBox.Checked) parts.Add("Alt");
        if (hotkeyShiftCheckBox.Checked) parts.Add("Shift");
        if (hotkeyWinCheckBox.Checked) parts.Add("Win");
        parts.Add((hotkeyComboBox.SelectedItem as Keys? ?? Keys.F6).ToString());
        return string.Join("+", parts);
    }

    private void GlobalHotkey_Pressed(object? sender, EventArgs e)
    {
        if (InvokeRequired)
        {
            BeginInvoke((MethodInvoker)ToggleRunning);
            return;
        }

        ToggleRunning();
    }

    private void InitializeComboBoxes()
    {
        intervalUnitComboBox.Items.AddRange(new object[] { IntervalUnit.Milliseconds, IntervalUnit.Seconds, IntervalUnit.Minutes });
        hotkeyComboBox.Items.AddRange(SupportedHotkeys.Cast<object>().ToArray());
        mouseButtonComboBox.Items.AddRange(new object[] { MouseButtonType.Left, MouseButtonType.Right, MouseButtonType.Middle });
        clickTypeComboBox.Items.AddRange(new object[] { ClickType.Single, ClickType.Double });
    }

    private void InitializeTooltips()
    {
        formToolTip.SetToolTip(intervalNumericUpDown, "Interval numeric value. Minimum 1.");
        formToolTip.SetToolTip(intervalUnitComboBox, "Unit for the interval value (ms/s/min).");
        formToolTip.SetToolTip(hotkeyComboBox, "Choose the main key for global toggle hotkey.");
        formToolTip.SetToolTip(hotkeyCtrlCheckBox, "Include Ctrl modifier in global hotkey.");
        formToolTip.SetToolTip(hotkeyAltCheckBox, "Include Alt modifier in global hotkey.");
        formToolTip.SetToolTip(hotkeyShiftCheckBox, "Include Shift modifier in global hotkey.");
        formToolTip.SetToolTip(hotkeyWinCheckBox, "Include Win modifier in global hotkey.");
        formToolTip.SetToolTip(mouseButtonComboBox, "Select which mouse button to click.");
        formToolTip.SetToolTip(clickTypeComboBox, "Single sends one click; Double sends two clicks.");
        formToolTip.SetToolTip(clicksPerTriggerNumericUpDown, "Number of click actions per timer trigger (1-10).");
        formToolTip.SetToolTip(fixedPositionCheckBox, "Click at a saved X,Y instead of current cursor location.");
        formToolTip.SetToolTip(fixedXNumericUpDown, "Fixed X screen coordinate.");
        formToolTip.SetToolTip(fixedYNumericUpDown, "Fixed Y screen coordinate.");
        formToolTip.SetToolTip(pickPositionButton, "Capture next mouse click position as fixed target.");
        formToolTip.SetToolTip(clickLimitCheckBox, "Automatically stop after N click actions.");
        formToolTip.SetToolTip(clickLimitNumericUpDown, "Maximum click actions before auto-stop.");
        formToolTip.SetToolTip(durationLimitCheckBox, "Automatically stop after X seconds.");
        formToolTip.SetToolTip(durationLimitNumericUpDown, "Max runtime duration in seconds.");
        formToolTip.SetToolTip(jitterCheckBox, "Randomize interval by +/- percentage.");
        formToolTip.SetToolTip(jitterNumericUpDown, "Jitter percentage applied around base interval.");
        formToolTip.SetToolTip(alwaysOnTopCheckBox, "Keep the window above other windows.");
        formToolTip.SetToolTip(minimizeToTrayCheckBox, "Hide to tray when minimized.");
        formToolTip.SetToolTip(startButton, "Start auto-clicking.");
        formToolTip.SetToolTip(stopButton, "Stop auto-clicking.");
        formToolTip.SetToolTip(resetCounterButton, "Reset click counter and stats.");
        formToolTip.SetToolTip(cpsLabel, "Clicks per second during the current run.");
        formToolTip.SetToolTip(elapsedLabel, "Elapsed time for the current run.");
        formToolTip.SetToolTip(profileComboBox, "Type a name or select an existing profile.");
        formToolTip.SetToolTip(saveProfileButton, "Save current settings as the named profile.");
        formToolTip.SetToolTip(deleteProfileButton, "Delete the selected profile.");
    }

    private void ApplySettingsToUi()
    {
        intervalNumericUpDown.Value = Math.Clamp(_settings.IntervalValue, intervalNumericUpDown.Minimum, intervalNumericUpDown.Maximum);
        intervalUnitComboBox.SelectedItem = _settings.IntervalUnit;
        hotkeyComboBox.SelectedItem = _settings.Hotkey;
        hotkeyCtrlCheckBox.Checked = _settings.HotkeyCtrl;
        hotkeyAltCheckBox.Checked = _settings.HotkeyAlt;
        hotkeyShiftCheckBox.Checked = _settings.HotkeyShift;
        hotkeyWinCheckBox.Checked = _settings.HotkeyWin;
        mouseButtonComboBox.SelectedItem = _settings.MouseButton;
        clickTypeComboBox.SelectedItem = _settings.ClickType;
        clicksPerTriggerNumericUpDown.Value = Math.Clamp(_settings.ClicksPerTrigger, (int)clicksPerTriggerNumericUpDown.Minimum, (int)clicksPerTriggerNumericUpDown.Maximum);
        fixedPositionCheckBox.Checked = _settings.UseFixedPosition;
        fixedXNumericUpDown.Value = Math.Clamp(_settings.FixedX, (int)fixedXNumericUpDown.Minimum, (int)fixedXNumericUpDown.Maximum);
        fixedYNumericUpDown.Value = Math.Clamp(_settings.FixedY, (int)fixedYNumericUpDown.Minimum, (int)fixedYNumericUpDown.Maximum);
        clickLimitCheckBox.Checked = _settings.EnableClickLimit;
        clickLimitNumericUpDown.Value = Math.Clamp(_settings.MaxClicks, (int)clickLimitNumericUpDown.Minimum, (int)clickLimitNumericUpDown.Maximum);
        durationLimitCheckBox.Checked = _settings.EnableDurationLimit;
        durationLimitNumericUpDown.Value = Math.Clamp(_settings.MaxSeconds, (int)durationLimitNumericUpDown.Minimum, (int)durationLimitNumericUpDown.Maximum);
        jitterCheckBox.Checked = _settings.EnableJitter;
        jitterNumericUpDown.Value = Math.Clamp(_settings.JitterPercent, (int)jitterNumericUpDown.Minimum, (int)jitterNumericUpDown.Maximum);
        alwaysOnTopCheckBox.Checked = _settings.AlwaysOnTop;
        minimizeToTrayCheckBox.Checked = _settings.MinimizeToTray;
        TopMost = alwaysOnTopCheckBox.Checked;

        fixedXNumericUpDown.Enabled = fixedPositionCheckBox.Checked;
        fixedYNumericUpDown.Enabled = fixedPositionCheckBox.Checked;
        pickPositionButton.Enabled = fixedPositionCheckBox.Checked;
        clickLimitNumericUpDown.Enabled = clickLimitCheckBox.Checked;
        durationLimitNumericUpDown.Enabled = durationLimitCheckBox.Checked;
        jitterNumericUpDown.Enabled = jitterCheckBox.Checked;
    }

    private void SaveFromUi()
    {
        SettingsStore.Save(CollectSettingsFromUi());
    }

    private AppSettings CollectSettingsFromUi()
    {
        _settings.IntervalValue = intervalNumericUpDown.Value;
        _settings.IntervalUnit = GetSelectedIntervalUnit();
        _settings.Hotkey = hotkeyComboBox.SelectedItem is Keys key ? key : Keys.F6;
        _settings.HotkeyCtrl = hotkeyCtrlCheckBox.Checked;
        _settings.HotkeyAlt = hotkeyAltCheckBox.Checked;
        _settings.HotkeyShift = hotkeyShiftCheckBox.Checked;
        _settings.HotkeyWin = hotkeyWinCheckBox.Checked;
        _settings.MouseButton = mouseButtonComboBox.SelectedItem is MouseButtonType mouseButton ? mouseButton : MouseButtonType.Left;
        _settings.ClickType = clickTypeComboBox.SelectedItem is ClickType clickType ? clickType : ClickType.Single;
        _settings.ClicksPerTrigger = (int)clicksPerTriggerNumericUpDown.Value;
        _settings.UseFixedPosition = fixedPositionCheckBox.Checked;
        _settings.FixedX = (int)fixedXNumericUpDown.Value;
        _settings.FixedY = (int)fixedYNumericUpDown.Value;
        _settings.EnableClickLimit = clickLimitCheckBox.Checked;
        _settings.MaxClicks = (int)clickLimitNumericUpDown.Value;
        _settings.EnableDurationLimit = durationLimitCheckBox.Checked;
        _settings.MaxSeconds = (int)durationLimitNumericUpDown.Value;
        _settings.EnableJitter = jitterCheckBox.Checked;
        _settings.JitterPercent = (int)jitterNumericUpDown.Value;
        _settings.AlwaysOnTop = alwaysOnTopCheckBox.Checked;
        _settings.MinimizeToTray = minimizeToTrayCheckBox.Checked;
        return _settings;
    }

    private void HideToTray()
    {
        _trayIcon.Visible = true;
        Hide();
    }

    private void ShowFromTray()
    {
        Show();
        WindowState = FormWindowState.Normal;
        Activate();
        _trayIcon.Visible = false;
    }

    // --- Profiles ---

    private void InitializeProfiles()
    {
        _profiles = ProfilesStore.Load();
        RefreshProfileComboBox(null);
    }

    private void RefreshProfileComboBox(string? selectName)
    {
        profileComboBox.SelectedIndexChanged -= profileComboBox_SelectedIndexChanged;
        profileComboBox.Items.Clear();
        foreach (var name in _profiles.Keys.OrderBy(k => k, StringComparer.OrdinalIgnoreCase))
            profileComboBox.Items.Add(name);
        profileComboBox.Text = selectName ?? string.Empty;
        profileComboBox.SelectedIndexChanged += profileComboBox_SelectedIndexChanged;
    }

    private void profileComboBox_SelectedIndexChanged(object? sender, EventArgs e)
    {
        var name = profileComboBox.Text.Trim();
        if (!string.IsNullOrEmpty(name) && _profiles.TryGetValue(name, out var profile))
            ApplyProfile(profile);
    }

    private void saveProfileButton_Click(object? sender, EventArgs e)
    {
        var name = profileComboBox.Text.Trim();
        if (string.IsNullOrEmpty(name))
        {
            MessageBox.Show(this, "Enter a profile name first.", "Save Profile",
                MessageBoxButtons.OK, MessageBoxIcon.Information);
            profileComboBox.Focus();
            return;
        }
        _profiles[name] = CollectSettingsFromUi().Clone();
        ProfilesStore.Save(_profiles);
        RefreshProfileComboBox(name);
    }

    private void deleteProfileButton_Click(object? sender, EventArgs e)
    {
        var name = profileComboBox.Text.Trim();
        if (string.IsNullOrEmpty(name) || !_profiles.ContainsKey(name))
            return;
        if (MessageBox.Show(this, $"Delete profile \"{name}\"?", "Delete Profile",
                MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes)
            return;
        _profiles.Remove(name);
        ProfilesStore.Save(_profiles);
        RefreshProfileComboBox(null);
    }

    private void ApplyProfile(AppSettings profile)
    {
        var showFirstRun = _settings.ShowFirstRunNotice;
        _settings = profile.Clone();
        _settings.ShowFirstRunNotice = showFirstRun;
        ApplySettingsToUi();
        ApplyHotkeyRegistration();
        SaveFromUi();
    }

    // --- Stats (CPS / elapsed / reset) ---

    private void resetCounterButton_Click(object? sender, EventArgs e)
    {
        Interlocked.Exchange(ref _clickCount, 0);
        if (_running)
            _startedAtUtc = DateTime.UtcNow;
        else
        {
            cpsLabel.Text = "CPS: \u2014";
            elapsedLabel.Text = "Elapsed: \u2014";
        }
        UpdateClickCounter();
    }

    private void uiUpdateTimer_Tick(object? sender, EventArgs e) => UpdateStatsLabels();

    private void UpdateStatsLabels()
    {
        var count = Interlocked.Read(ref _clickCount);
        var elapsed = DateTime.UtcNow - _startedAtUtc;
        var cps = elapsed.TotalSeconds > 0.01 ? count / elapsed.TotalSeconds : 0d;
        var fmt = elapsed.TotalHours >= 1 ? @"h\:mm\:ss" : @"m\:ss";
        cpsLabel.Text = $"CPS: {cps:F1}";
        elapsedLabel.Text = $"Elapsed: {elapsed.ToString(fmt)}";
    }
}
