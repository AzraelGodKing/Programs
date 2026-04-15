namespace AutoClicker;

partial class MainForm
{
    private System.ComponentModel.IContainer components = null!;
    private NumericUpDown intervalNumericUpDown;
    private ComboBox intervalUnitComboBox;
    private Label intervalLabel;
    private Button startButton;
    private Button stopButton;
    private Label statusLabel;
    private Label hotkeyLabel;
    private ComboBox hotkeyComboBox;
    private CheckBox hotkeyCtrlCheckBox;
    private CheckBox hotkeyAltCheckBox;
    private CheckBox hotkeyShiftCheckBox;
    private CheckBox hotkeyWinCheckBox;
    private Label mouseButtonLabel;
    private ComboBox mouseButtonComboBox;
    private Label clickTypeLabel;
    private ComboBox clickTypeComboBox;
    private Label clicksPerTriggerLabel;
    private NumericUpDown clicksPerTriggerNumericUpDown;
    private CheckBox fixedPositionCheckBox;
    private NumericUpDown fixedXNumericUpDown;
    private NumericUpDown fixedYNumericUpDown;
    private Label fixedPositionLabel;
    private Button pickPositionButton;
    private CheckBox clickLimitCheckBox;
    private NumericUpDown clickLimitNumericUpDown;
    private CheckBox durationLimitCheckBox;
    private NumericUpDown durationLimitNumericUpDown;
    private CheckBox jitterCheckBox;
    private NumericUpDown jitterNumericUpDown;
    private CheckBox alwaysOnTopCheckBox;
    private CheckBox minimizeToTrayCheckBox;
    private Label clickCounterLabel;
    private ToolTip formToolTip;

    protected override void Dispose(bool disposing)
    {
        if (disposing && components != null)
            components.Dispose();
        base.Dispose(disposing);
    }

    private void InitializeComponent()
    {
        components = new System.ComponentModel.Container();
        intervalNumericUpDown = new NumericUpDown();
        intervalUnitComboBox = new ComboBox();
        intervalLabel = new Label();
        startButton = new Button();
        stopButton = new Button();
        statusLabel = new Label();
        hotkeyLabel = new Label();
        hotkeyComboBox = new ComboBox();
        hotkeyCtrlCheckBox = new CheckBox();
        hotkeyAltCheckBox = new CheckBox();
        hotkeyShiftCheckBox = new CheckBox();
        hotkeyWinCheckBox = new CheckBox();
        mouseButtonLabel = new Label();
        mouseButtonComboBox = new ComboBox();
        clickTypeLabel = new Label();
        clickTypeComboBox = new ComboBox();
        clicksPerTriggerLabel = new Label();
        clicksPerTriggerNumericUpDown = new NumericUpDown();
        fixedPositionCheckBox = new CheckBox();
        fixedXNumericUpDown = new NumericUpDown();
        fixedYNumericUpDown = new NumericUpDown();
        fixedPositionLabel = new Label();
        pickPositionButton = new Button();
        clickLimitCheckBox = new CheckBox();
        clickLimitNumericUpDown = new NumericUpDown();
        durationLimitCheckBox = new CheckBox();
        durationLimitNumericUpDown = new NumericUpDown();
        jitterCheckBox = new CheckBox();
        jitterNumericUpDown = new NumericUpDown();
        alwaysOnTopCheckBox = new CheckBox();
        minimizeToTrayCheckBox = new CheckBox();
        clickCounterLabel = new Label();
        formToolTip = new ToolTip(components);
        ((System.ComponentModel.ISupportInitialize)intervalNumericUpDown).BeginInit();
        ((System.ComponentModel.ISupportInitialize)clicksPerTriggerNumericUpDown).BeginInit();
        ((System.ComponentModel.ISupportInitialize)fixedXNumericUpDown).BeginInit();
        ((System.ComponentModel.ISupportInitialize)fixedYNumericUpDown).BeginInit();
        ((System.ComponentModel.ISupportInitialize)clickLimitNumericUpDown).BeginInit();
        ((System.ComponentModel.ISupportInitialize)durationLimitNumericUpDown).BeginInit();
        ((System.ComponentModel.ISupportInitialize)jitterNumericUpDown).BeginInit();
        SuspendLayout();
        //
        // intervalNumericUpDown
        //
        intervalNumericUpDown.Location = new Point(122, 14);
        intervalNumericUpDown.Maximum = new decimal(new int[] { 3600000, 0, 0, 0 });
        intervalNumericUpDown.Minimum = new decimal(new int[] { 1, 0, 0, 0 });
        intervalNumericUpDown.Name = "intervalNumericUpDown";
        intervalNumericUpDown.Size = new Size(98, 23);
        intervalNumericUpDown.TabIndex = 1;
        intervalNumericUpDown.Value = new decimal(new int[] { 500, 0, 0, 0 });
        intervalNumericUpDown.ValueChanged += intervalNumericUpDown_ValueChanged;
        //
        // intervalUnitComboBox
        //
        intervalUnitComboBox.DropDownStyle = ComboBoxStyle.DropDownList;
        intervalUnitComboBox.FormattingEnabled = true;
        intervalUnitComboBox.Location = new Point(227, 14);
        intervalUnitComboBox.Name = "intervalUnitComboBox";
        intervalUnitComboBox.Size = new Size(90, 23);
        intervalUnitComboBox.TabIndex = 2;
        intervalUnitComboBox.SelectedIndexChanged += intervalUnitComboBox_SelectedIndexChanged;
        //
        // intervalLabel
        //
        intervalLabel.AutoSize = true;
        intervalLabel.Location = new Point(16, 16);
        intervalLabel.Name = "intervalLabel";
        intervalLabel.Size = new Size(79, 15);
        intervalLabel.TabIndex = 0;
        intervalLabel.Text = "Click interval:";
        //
        // startButton
        //
        startButton.Location = new Point(16, 420);
        startButton.Name = "startButton";
        startButton.Size = new Size(90, 28);
        startButton.TabIndex = 30;
        startButton.Text = "Start";
        startButton.UseVisualStyleBackColor = true;
        startButton.Click += startButton_Click;
        //
        // stopButton
        //
        stopButton.Enabled = false;
        stopButton.Location = new Point(114, 420);
        stopButton.Name = "stopButton";
        stopButton.Size = new Size(90, 28);
        stopButton.TabIndex = 31;
        stopButton.Text = "Stop";
        stopButton.UseVisualStyleBackColor = true;
        stopButton.Click += stopButton_Click;
        //
        // statusLabel
        //
        statusLabel.AutoSize = true;
        statusLabel.Location = new Point(16, 459);
        statusLabel.Name = "statusLabel";
        statusLabel.Size = new Size(89, 15);
        statusLabel.TabIndex = 32;
        statusLabel.Text = "Status: Stopped";
        //
        // hotkeyLabel
        //
        hotkeyLabel.AutoSize = true;
        hotkeyLabel.Location = new Point(16, 46);
        hotkeyLabel.Name = "hotkeyLabel";
        hotkeyLabel.Size = new Size(76, 15);
        hotkeyLabel.TabIndex = 3;
        hotkeyLabel.Text = "Hotkey: F6";
        //
        // hotkeyComboBox
        //
        hotkeyComboBox.DropDownStyle = ComboBoxStyle.DropDownList;
        hotkeyComboBox.FormattingEnabled = true;
        hotkeyComboBox.Location = new Point(122, 43);
        hotkeyComboBox.Name = "hotkeyComboBox";
        hotkeyComboBox.Size = new Size(98, 23);
        hotkeyComboBox.TabIndex = 4;
        hotkeyComboBox.SelectedIndexChanged += hotkeyControl_Changed;
        //
        // hotkeyCtrlCheckBox
        //
        hotkeyCtrlCheckBox.AutoSize = true;
        hotkeyCtrlCheckBox.Location = new Point(227, 46);
        hotkeyCtrlCheckBox.Name = "hotkeyCtrlCheckBox";
        hotkeyCtrlCheckBox.Size = new Size(45, 19);
        hotkeyCtrlCheckBox.TabIndex = 5;
        hotkeyCtrlCheckBox.Text = "Ctrl";
        hotkeyCtrlCheckBox.UseVisualStyleBackColor = true;
        hotkeyCtrlCheckBox.CheckedChanged += hotkeyControl_Changed;
        //
        // hotkeyAltCheckBox
        //
        hotkeyAltCheckBox.AutoSize = true;
        hotkeyAltCheckBox.Location = new Point(276, 46);
        hotkeyAltCheckBox.Name = "hotkeyAltCheckBox";
        hotkeyAltCheckBox.Size = new Size(40, 19);
        hotkeyAltCheckBox.TabIndex = 6;
        hotkeyAltCheckBox.Text = "Alt";
        hotkeyAltCheckBox.UseVisualStyleBackColor = true;
        hotkeyAltCheckBox.CheckedChanged += hotkeyControl_Changed;
        //
        // hotkeyShiftCheckBox
        //
        hotkeyShiftCheckBox.AutoSize = true;
        hotkeyShiftCheckBox.Location = new Point(321, 46);
        hotkeyShiftCheckBox.Name = "hotkeyShiftCheckBox";
        hotkeyShiftCheckBox.Size = new Size(50, 19);
        hotkeyShiftCheckBox.TabIndex = 7;
        hotkeyShiftCheckBox.Text = "Shift";
        hotkeyShiftCheckBox.UseVisualStyleBackColor = true;
        hotkeyShiftCheckBox.CheckedChanged += hotkeyControl_Changed;
        //
        // hotkeyWinCheckBox
        //
        hotkeyWinCheckBox.AutoSize = true;
        hotkeyWinCheckBox.Location = new Point(375, 46);
        hotkeyWinCheckBox.Name = "hotkeyWinCheckBox";
        hotkeyWinCheckBox.Size = new Size(47, 19);
        hotkeyWinCheckBox.TabIndex = 8;
        hotkeyWinCheckBox.Text = "Win";
        hotkeyWinCheckBox.UseVisualStyleBackColor = true;
        hotkeyWinCheckBox.CheckedChanged += hotkeyControl_Changed;
        //
        // mouseButtonLabel
        //
        mouseButtonLabel.AutoSize = true;
        mouseButtonLabel.Location = new Point(16, 77);
        mouseButtonLabel.Name = "mouseButtonLabel";
        mouseButtonLabel.Size = new Size(84, 15);
        mouseButtonLabel.TabIndex = 9;
        mouseButtonLabel.Text = "Mouse button:";
        //
        // mouseButtonComboBox
        //
        mouseButtonComboBox.DropDownStyle = ComboBoxStyle.DropDownList;
        mouseButtonComboBox.FormattingEnabled = true;
        mouseButtonComboBox.Location = new Point(122, 74);
        mouseButtonComboBox.Name = "mouseButtonComboBox";
        mouseButtonComboBox.Size = new Size(120, 23);
        mouseButtonComboBox.TabIndex = 10;
        mouseButtonComboBox.SelectedIndexChanged += mouseButtonComboBox_SelectedIndexChanged;
        //
        // clickTypeLabel
        //
        clickTypeLabel.AutoSize = true;
        clickTypeLabel.Location = new Point(16, 107);
        clickTypeLabel.Name = "clickTypeLabel";
        clickTypeLabel.Size = new Size(58, 15);
        clickTypeLabel.TabIndex = 11;
        clickTypeLabel.Text = "Click type:";
        //
        // clickTypeComboBox
        //
        clickTypeComboBox.DropDownStyle = ComboBoxStyle.DropDownList;
        clickTypeComboBox.FormattingEnabled = true;
        clickTypeComboBox.Location = new Point(122, 104);
        clickTypeComboBox.Name = "clickTypeComboBox";
        clickTypeComboBox.Size = new Size(120, 23);
        clickTypeComboBox.TabIndex = 12;
        clickTypeComboBox.SelectedIndexChanged += clickTypeComboBox_SelectedIndexChanged;
        //
        // clicksPerTriggerLabel
        //
        clicksPerTriggerLabel.AutoSize = true;
        clicksPerTriggerLabel.Location = new Point(16, 137);
        clicksPerTriggerLabel.Name = "clicksPerTriggerLabel";
        clicksPerTriggerLabel.Size = new Size(93, 15);
        clicksPerTriggerLabel.TabIndex = 13;
        clicksPerTriggerLabel.Text = "Clicks per trigger:";
        //
        // clicksPerTriggerNumericUpDown
        //
        clicksPerTriggerNumericUpDown.Location = new Point(122, 134);
        clicksPerTriggerNumericUpDown.Maximum = new decimal(new int[] { 10, 0, 0, 0 });
        clicksPerTriggerNumericUpDown.Minimum = new decimal(new int[] { 1, 0, 0, 0 });
        clicksPerTriggerNumericUpDown.Name = "clicksPerTriggerNumericUpDown";
        clicksPerTriggerNumericUpDown.Size = new Size(64, 23);
        clicksPerTriggerNumericUpDown.TabIndex = 14;
        clicksPerTriggerNumericUpDown.Value = new decimal(new int[] { 1, 0, 0, 0 });
        clicksPerTriggerNumericUpDown.ValueChanged += clicksPerTriggerNumericUpDown_ValueChanged;
        //
        // fixedPositionCheckBox
        //
        fixedPositionCheckBox.AutoSize = true;
        fixedPositionCheckBox.Location = new Point(16, 168);
        fixedPositionCheckBox.Name = "fixedPositionCheckBox";
        fixedPositionCheckBox.Size = new Size(121, 19);
        fixedPositionCheckBox.TabIndex = 15;
        fixedPositionCheckBox.Text = "Use fixed position";
        fixedPositionCheckBox.UseVisualStyleBackColor = true;
        fixedPositionCheckBox.CheckedChanged += fixedPositionCheckBox_CheckedChanged;
        //
        // fixedXNumericUpDown
        //
        fixedXNumericUpDown.Location = new Point(122, 194);
        fixedXNumericUpDown.Maximum = new decimal(new int[] { 10000, 0, 0, 0 });
        fixedXNumericUpDown.Name = "fixedXNumericUpDown";
        fixedXNumericUpDown.Size = new Size(78, 23);
        fixedXNumericUpDown.TabIndex = 16;
        fixedXNumericUpDown.ValueChanged += fixedPositionValueChanged;
        //
        // fixedYNumericUpDown
        //
        fixedYNumericUpDown.Location = new Point(206, 194);
        fixedYNumericUpDown.Maximum = new decimal(new int[] { 10000, 0, 0, 0 });
        fixedYNumericUpDown.Name = "fixedYNumericUpDown";
        fixedYNumericUpDown.Size = new Size(78, 23);
        fixedYNumericUpDown.TabIndex = 17;
        fixedYNumericUpDown.ValueChanged += fixedPositionValueChanged;
        //
        // fixedPositionLabel
        //
        fixedPositionLabel.AutoSize = true;
        fixedPositionLabel.Location = new Point(16, 196);
        fixedPositionLabel.Name = "fixedPositionLabel";
        fixedPositionLabel.Size = new Size(70, 15);
        fixedPositionLabel.TabIndex = 18;
        fixedPositionLabel.Text = "Position X,Y";
        //
        // pickPositionButton
        //
        pickPositionButton.Location = new Point(291, 193);
        pickPositionButton.Name = "pickPositionButton";
        pickPositionButton.Size = new Size(123, 24);
        pickPositionButton.TabIndex = 18;
        pickPositionButton.Text = "Pick position";
        pickPositionButton.UseVisualStyleBackColor = true;
        pickPositionButton.Click += pickPositionButton_Click;
        //
        // clickLimitCheckBox
        //
        clickLimitCheckBox.AutoSize = true;
        clickLimitCheckBox.Location = new Point(16, 231);
        clickLimitCheckBox.Name = "clickLimitCheckBox";
        clickLimitCheckBox.Size = new Size(122, 19);
        clickLimitCheckBox.TabIndex = 19;
        clickLimitCheckBox.Text = "Stop after N clicks";
        clickLimitCheckBox.UseVisualStyleBackColor = true;
        clickLimitCheckBox.CheckedChanged += clickLimitCheckBox_CheckedChanged;
        //
        // clickLimitNumericUpDown
        //
        clickLimitNumericUpDown.Location = new Point(153, 229);
        clickLimitNumericUpDown.Maximum = new decimal(new int[] { 1000000, 0, 0, 0 });
        clickLimitNumericUpDown.Minimum = new decimal(new int[] { 1, 0, 0, 0 });
        clickLimitNumericUpDown.Name = "clickLimitNumericUpDown";
        clickLimitNumericUpDown.Size = new Size(89, 23);
        clickLimitNumericUpDown.TabIndex = 20;
        clickLimitNumericUpDown.Value = new decimal(new int[] { 100, 0, 0, 0 });
        clickLimitNumericUpDown.ValueChanged += clickLimitNumericUpDown_ValueChanged;
        //
        // durationLimitCheckBox
        //
        durationLimitCheckBox.AutoSize = true;
        durationLimitCheckBox.Location = new Point(16, 261);
        durationLimitCheckBox.Name = "durationLimitCheckBox";
        durationLimitCheckBox.Size = new Size(144, 19);
        durationLimitCheckBox.TabIndex = 21;
        durationLimitCheckBox.Text = "Stop after X seconds";
        durationLimitCheckBox.UseVisualStyleBackColor = true;
        durationLimitCheckBox.CheckedChanged += durationLimitCheckBox_CheckedChanged;
        //
        // durationLimitNumericUpDown
        //
        durationLimitNumericUpDown.Location = new Point(166, 259);
        durationLimitNumericUpDown.Maximum = new decimal(new int[] { 86400, 0, 0, 0 });
        durationLimitNumericUpDown.Minimum = new decimal(new int[] { 1, 0, 0, 0 });
        durationLimitNumericUpDown.Name = "durationLimitNumericUpDown";
        durationLimitNumericUpDown.Size = new Size(76, 23);
        durationLimitNumericUpDown.TabIndex = 22;
        durationLimitNumericUpDown.Value = new decimal(new int[] { 60, 0, 0, 0 });
        durationLimitNumericUpDown.ValueChanged += durationLimitNumericUpDown_ValueChanged;
        //
        // jitterCheckBox
        //
        jitterCheckBox.AutoSize = true;
        jitterCheckBox.Location = new Point(16, 291);
        jitterCheckBox.Name = "jitterCheckBox";
        jitterCheckBox.Size = new Size(136, 19);
        jitterCheckBox.TabIndex = 23;
        jitterCheckBox.Text = "Interval jitter (+/- %)";
        jitterCheckBox.UseVisualStyleBackColor = true;
        jitterCheckBox.CheckedChanged += jitterCheckBox_CheckedChanged;
        //
        // jitterNumericUpDown
        //
        jitterNumericUpDown.Location = new Point(166, 289);
        jitterNumericUpDown.Maximum = new decimal(new int[] { 100, 0, 0, 0 });
        jitterNumericUpDown.Name = "jitterNumericUpDown";
        jitterNumericUpDown.Size = new Size(76, 23);
        jitterNumericUpDown.TabIndex = 24;
        jitterNumericUpDown.ValueChanged += jitterNumericUpDown_ValueChanged;
        //
        // alwaysOnTopCheckBox
        //
        alwaysOnTopCheckBox.AutoSize = true;
        alwaysOnTopCheckBox.Location = new Point(16, 321);
        alwaysOnTopCheckBox.Name = "alwaysOnTopCheckBox";
        alwaysOnTopCheckBox.Size = new Size(101, 19);
        alwaysOnTopCheckBox.TabIndex = 25;
        alwaysOnTopCheckBox.Text = "Always on top";
        alwaysOnTopCheckBox.UseVisualStyleBackColor = true;
        alwaysOnTopCheckBox.CheckedChanged += alwaysOnTopCheckBox_CheckedChanged;
        //
        // minimizeToTrayCheckBox
        //
        minimizeToTrayCheckBox.AutoSize = true;
        minimizeToTrayCheckBox.Location = new Point(16, 346);
        minimizeToTrayCheckBox.Name = "minimizeToTrayCheckBox";
        minimizeToTrayCheckBox.Size = new Size(108, 19);
        minimizeToTrayCheckBox.TabIndex = 26;
        minimizeToTrayCheckBox.Text = "Minimize to tray";
        minimizeToTrayCheckBox.UseVisualStyleBackColor = true;
        minimizeToTrayCheckBox.CheckedChanged += minimizeToTrayCheckBox_CheckedChanged;
        //
        // clickCounterLabel
        //
        clickCounterLabel.AutoSize = true;
        clickCounterLabel.Location = new Point(16, 484);
        clickCounterLabel.Name = "clickCounterLabel";
        clickCounterLabel.Size = new Size(53, 15);
        clickCounterLabel.TabIndex = 33;
        clickCounterLabel.Text = "Clicks: 0";
        //
        // MainForm
        //
        AutoScaleDimensions = new SizeF(7F, 15F);
        AutoScaleMode = AutoScaleMode.Font;
        ClientSize = new Size(440, 510);
        Controls.Add(clickCounterLabel);
        Controls.Add(minimizeToTrayCheckBox);
        Controls.Add(alwaysOnTopCheckBox);
        Controls.Add(jitterNumericUpDown);
        Controls.Add(jitterCheckBox);
        Controls.Add(durationLimitNumericUpDown);
        Controls.Add(durationLimitCheckBox);
        Controls.Add(clickLimitNumericUpDown);
        Controls.Add(clickLimitCheckBox);
        Controls.Add(pickPositionButton);
        Controls.Add(fixedPositionLabel);
        Controls.Add(fixedYNumericUpDown);
        Controls.Add(fixedXNumericUpDown);
        Controls.Add(fixedPositionCheckBox);
        Controls.Add(clicksPerTriggerNumericUpDown);
        Controls.Add(clicksPerTriggerLabel);
        Controls.Add(clickTypeComboBox);
        Controls.Add(clickTypeLabel);
        Controls.Add(mouseButtonComboBox);
        Controls.Add(mouseButtonLabel);
        Controls.Add(hotkeyWinCheckBox);
        Controls.Add(hotkeyShiftCheckBox);
        Controls.Add(hotkeyAltCheckBox);
        Controls.Add(hotkeyCtrlCheckBox);
        Controls.Add(hotkeyComboBox);
        Controls.Add(intervalUnitComboBox);
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
        FormClosing += MainForm_FormClosing;
        Resize += MainForm_Resize;
        Shown += MainForm_Shown;
        ((System.ComponentModel.ISupportInitialize)intervalNumericUpDown).EndInit();
        ((System.ComponentModel.ISupportInitialize)clicksPerTriggerNumericUpDown).EndInit();
        ((System.ComponentModel.ISupportInitialize)fixedXNumericUpDown).EndInit();
        ((System.ComponentModel.ISupportInitialize)fixedYNumericUpDown).EndInit();
        ((System.ComponentModel.ISupportInitialize)clickLimitNumericUpDown).EndInit();
        ((System.ComponentModel.ISupportInitialize)durationLimitNumericUpDown).EndInit();
        ((System.ComponentModel.ISupportInitialize)jitterNumericUpDown).EndInit();
        ResumeLayout(false);
        PerformLayout();
    }
}
