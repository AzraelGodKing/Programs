namespace AutoClicker;

/// <summary>
/// First-run notice dialog for legal and policy reminders.
/// </summary>
internal sealed class FirstRunNoticeForm : Form
{
    private readonly CheckBox _dontShowAgainCheckBox;

    /// <summary>
    /// True when user asks to suppress this notice on later runs.
    /// </summary>
    internal bool DontShowAgain => _dontShowAgainCheckBox.Checked;

    /// <summary>
    /// Initializes the first-run notice form.
    /// </summary>
    internal FirstRunNoticeForm()
    {
        Text = "AutoClicker Notice";
        FormBorderStyle = FormBorderStyle.FixedDialog;
        StartPosition = FormStartPosition.CenterParent;
        MinimizeBox = false;
        MaximizeBox = false;
        ClientSize = new Size(480, 250);

        var message = new Label
        {
            AutoSize = false,
            Location = new Point(12, 12),
            Size = new Size(456, 165),
            Text = "Use AutoClicker only where permitted.\r\n\r\n" +
                   "- Respect game Terms of Service.\r\n" +
                   "- Follow workplace policies.\r\n" +
                   "- Comply with local laws and regulations.\r\n\r\n" +
                   "You are responsible for how this tool is used.",
        };

        _dontShowAgainCheckBox = new CheckBox
        {
            AutoSize = true,
            Location = new Point(12, 185),
            Text = "Don't show this again"
        };

        var okButton = new Button
        {
            Text = "I Understand",
            DialogResult = DialogResult.OK,
            Location = new Point(360, 210),
            Size = new Size(108, 28)
        };

        Controls.Add(message);
        Controls.Add(_dontShowAgainCheckBox);
        Controls.Add(okButton);

        AcceptButton = okButton;
    }
}
