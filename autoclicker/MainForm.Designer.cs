namespace AutoClicker;

partial class MainForm
{
    private System.ComponentModel.IContainer components = null!;

    private System.Windows.Forms.Timer clickTimer;
    private NumericUpDown intervalNumericUpDown;
    private Label intervalLabel;
    private Button startButton;
    private Button stopButton;
    private Label statusLabel;
    private Label hotkeyLabel;

    protected override void Dispose(bool disposing)
    {
        if (disposing && components != null)
            components.Dispose();
        base.Dispose(disposing);
    }

    private void InitializeComponent()
    {
        components = new System.ComponentModel.Container();
        clickTimer = new System.Windows.Forms.Timer(components);
        intervalNumericUpDown = new NumericUpDown();
        intervalLabel = new Label();
        startButton = new Button();
        stopButton = new Button();
        statusLabel = new Label();
        hotkeyLabel = new Label();
        ((System.ComponentModel.ISupportInitialize)intervalNumericUpDown).BeginInit();
        SuspendLayout();
        //
        // intervalNumericUpDown
        //
        intervalNumericUpDown.Location = new Point(120, 16);
        intervalNumericUpDown.Maximum = new decimal(new int[] { 3600000, 0, 0, 0 });
        intervalNumericUpDown.Minimum = new decimal(new int[] { 1, 0, 0, 0 });
        intervalNumericUpDown.Name = "intervalNumericUpDown";
        intervalNumericUpDown.Size = new Size(120, 23);
        intervalNumericUpDown.TabIndex = 1;
        intervalNumericUpDown.Value = new decimal(new int[] { 500, 0, 0, 0 });
        intervalNumericUpDown.ValueChanged += intervalNumericUpDown_ValueChanged;
        //
        // intervalLabel
        //
        intervalLabel.AutoSize = true;
        intervalLabel.Location = new Point(16, 18);
        intervalLabel.Name = "intervalLabel";
        intervalLabel.Size = new Size(95, 15);
        intervalLabel.TabIndex = 0;
        intervalLabel.Text = "Interval (ms):";
        //
        // startButton
        //
        startButton.Location = new Point(16, 56);
        startButton.Name = "startButton";
        startButton.Size = new Size(100, 28);
        startButton.TabIndex = 2;
        startButton.Text = "Start";
        startButton.UseVisualStyleBackColor = true;
        startButton.Click += startButton_Click;
        //
        // stopButton
        //
        stopButton.Enabled = false;
        stopButton.Location = new Point(132, 56);
        stopButton.Name = "stopButton";
        stopButton.Size = new Size(100, 28);
        stopButton.TabIndex = 3;
        stopButton.Text = "Stop";
        stopButton.UseVisualStyleBackColor = true;
        stopButton.Click += stopButton_Click;
        //
        // statusLabel
        //
        statusLabel.AutoSize = true;
        statusLabel.Location = new Point(16, 100);
        statusLabel.Name = "statusLabel";
        statusLabel.Size = new Size(89, 15);
        statusLabel.TabIndex = 4;
        statusLabel.Text = "Status: Stopped";
        //
        // hotkeyLabel
        //
        hotkeyLabel.AutoSize = true;
        hotkeyLabel.Location = new Point(16, 124);
        hotkeyLabel.Name = "hotkeyLabel";
        hotkeyLabel.Size = new Size(88, 15);
        hotkeyLabel.TabIndex = 5;
        hotkeyLabel.Text = "Hotkey: F6";
        //
        // MainForm
        //
        AutoScaleDimensions = new SizeF(7F, 15F);
        AutoScaleMode = AutoScaleMode.Font;
        ClientSize = new Size(254, 161);
        Controls.Add(hotkeyLabel);
        Controls.Add(statusLabel);
        Controls.Add(stopButton);
        Controls.Add(startButton);
        Controls.Add(intervalNumericUpDown);
        Controls.Add(intervalLabel);
        FormBorderStyle = FormBorderStyle.FixedSingle;
        MaximizeBox = false;
        Name = "MainForm";
        StartPosition = FormStartPosition.CenterScreen;
        Text = "AutoClicker";
        ((System.ComponentModel.ISupportInitialize)intervalNumericUpDown).EndInit();
        ResumeLayout(false);
        PerformLayout();
    }
}
