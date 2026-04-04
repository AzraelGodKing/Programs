using System.Runtime.InteropServices;

namespace AutoClicker;

public partial class MainForm : Form
{
    private const int HotKeyId = 1;
    private const int WM_HOTKEY = 0x0312;
    private const uint VkF6 = 0x75;
    private const uint ModNorepeat = 0x4000;

    private bool _hotkeyRegistered;

    public MainForm()
    {
        InitializeComponent();
        clickTimer.Tick += (_, _) => MouseInput.SendLeftClick();
    }

    protected override void OnLoad(EventArgs e)
    {
        base.OnLoad(e);
        _hotkeyRegistered = RegisterHotKey(Handle, HotKeyId, ModNorepeat, VkF6)
            || RegisterHotKey(Handle, HotKeyId, 0, VkF6);
        if (!_hotkeyRegistered)
        {
            MessageBox.Show(
                this,
                "Could not register global hotkey F6. Another app may be using it. Use Start and Stop in this window.",
                "Hotkey unavailable",
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning);
            hotkeyLabel.Text = "Hotkey: unavailable (F6)";
        }

        UpdateUiState();
    }

    protected override void OnFormClosed(FormClosedEventArgs e)
    {
        if (_hotkeyRegistered)
            UnregisterHotKey(Handle, HotKeyId);
        base.OnFormClosed(e);
    }

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == WM_HOTKEY && m.WParam.ToInt32() == HotKeyId)
        {
            ToggleRunning();
            return;
        }

        base.WndProc(ref m);
    }

    private void startButton_Click(object sender, EventArgs e) => Start();

    private void stopButton_Click(object sender, EventArgs e) => Stop();

    private void intervalNumericUpDown_ValueChanged(object sender, EventArgs e)
    {
        if (clickTimer.Enabled)
            clickTimer.Interval = (int)intervalNumericUpDown.Value;
    }

    private void ToggleRunning()
    {
        if (clickTimer.Enabled)
            Stop();
        else
            Start();
    }

    private void Start()
    {
        clickTimer.Interval = Math.Max(1, (int)intervalNumericUpDown.Value);
        clickTimer.Start();
        UpdateUiState();
    }

    private void Stop()
    {
        clickTimer.Stop();
        UpdateUiState();
    }

    private void UpdateUiState()
    {
        var running = clickTimer.Enabled;
        startButton.Enabled = !running;
        stopButton.Enabled = running;
        statusLabel.Text = running ? "Status: Running" : "Status: Stopped";
        intervalNumericUpDown.Enabled = !running;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool UnregisterHotKey(IntPtr hWnd, int id);
}
