namespace AutoClicker;

partial class MainForm
{
    private System.ComponentModel.IContainer components = null!;

    private System.Windows.Forms.Timer captureCountdownTimer;
    private System.Windows.Forms.Timer startDelayTimer;
    private System.Windows.Forms.Timer uiTimer;
    private Label intervalLabel;
    private NumericUpDown intervalNumericUpDown;
    private Label jitterLabel;
    private NumericUpDown jitterNumericUpDown;
    private Label pressLabel;
    private NumericUpDown pressNumericUpDown;
    private Label clicksPerTickLabel;
    private NumericUpDown clicksPerTickNumericUpDown;
    private Label clickLimitLabel;
    private NumericUpDown clickLimitNumericUpDown;
    private Label mouseButtonLabel;
    private ComboBox mouseButtonCombo;
    private Label modeLabel;
    private RadioButton modeClickRadio;
    private RadioButton modeHoldRadio;
    private Label startDelayLabel;
    private NumericUpDown startDelayNumericUpDown;
    private Label positionJitterLabel;
    private NumericUpDown positionJitterNumericUpDown;
    private Label timeLimitLabel;
    private NumericUpDown timeLimitNumericUpDown;
    private CheckBox leavePointerCheckBox;
    private CheckBox stopOnMoveCheckBox;
    private CheckBox fixedPositionCheckBox;
    private Button setPositionButton;
    private Button removePointButton;
    private Button clearPointsButton;
    private Label positionLabel;
    private ListBox pointsListBox;
    private Label startHotkeyLabel;
    private ComboBox startHotkeyCombo;
    private CheckBox startCtrlCheck;
    private CheckBox startAltCheck;
    private CheckBox startShiftCheck;
    private Label stopHotkeyLabel;
    private ComboBox stopHotkeyCombo;
    private CheckBox stopCtrlCheck;
    private CheckBox stopAltCheck;
    private CheckBox stopShiftCheck;
    private CheckBox minimizeToTrayCheckBox;
    private CheckBox alwaysOnTopCheckBox;
    private Label presetLabel;
    private ComboBox presetCombo;
    private Button savePresetButton;
    private Button deletePresetButton;
    private Button startButton;
    private Button stopButton;
    private Label statusLabel;
    private Label statsLabel;
    private Label hotkeyStatusLabel;
    private NotifyIcon trayIcon;
    private ToolTip toolTip;

    protected override void Dispose(bool disposing)
    {
        if (disposing && components != null)
            components.Dispose();
        base.Dispose(disposing);
    }

    private void InitializeComponent()
    {
        components = new System.ComponentModel.Container();
        captureCountdownTimer = new System.Windows.Forms.Timer(components);
        startDelayTimer = new System.Windows.Forms.Timer(components);
        uiTimer = new System.Windows.Forms.Timer(components);
        intervalLabel = new Label();
        intervalNumericUpDown = new NumericUpDown();
        jitterLabel = new Label();
        jitterNumericUpDown = new NumericUpDown();
        pressLabel = new Label();
        pressNumericUpDown = new NumericUpDown();
        clicksPerTickLabel = new Label();
        clicksPerTickNumericUpDown = new NumericUpDown();
        clickLimitLabel = new Label();
        clickLimitNumericUpDown = new NumericUpDown();
        mouseButtonLabel = new Label();
        mouseButtonCombo = new ComboBox();
        modeLabel = new Label();
        modeClickRadio = new RadioButton();
        modeHoldRadio = new RadioButton();
        startDelayLabel = new Label();
        startDelayNumericUpDown = new NumericUpDown();
        positionJitterLabel = new Label();
        positionJitterNumericUpDown = new NumericUpDown();
        timeLimitLabel = new Label();
        timeLimitNumericUpDown = new NumericUpDown();
        leavePointerCheckBox = new CheckBox();
        stopOnMoveCheckBox = new CheckBox();
        fixedPositionCheckBox = new CheckBox();
        setPositionButton = new Button();
        removePointButton = new Button();
        clearPointsButton = new Button();
        positionLabel = new Label();
        pointsListBox = new ListBox();
        startHotkeyLabel = new Label();
        startHotkeyCombo = new ComboBox();
        startCtrlCheck = new CheckBox();
        startAltCheck = new CheckBox();
        startShiftCheck = new CheckBox();
        stopHotkeyLabel = new Label();
        stopHotkeyCombo = new ComboBox();
        stopCtrlCheck = new CheckBox();
        stopAltCheck = new CheckBox();
        stopShiftCheck = new CheckBox();
        minimizeToTrayCheckBox = new CheckBox();
        alwaysOnTopCheckBox = new CheckBox();
        presetLabel = new Label();
        presetCombo = new ComboBox();
        savePresetButton = new Button();
        deletePresetButton = new Button();
        startButton = new Button();
        stopButton = new Button();
        statusLabel = new Label();
        statsLabel = new Label();
        hotkeyStatusLabel = new Label();
        trayIcon = new NotifyIcon(components);
        toolTip = new ToolTip(components);
        ((System.ComponentModel.ISupportInitialize)intervalNumericUpDown).BeginInit();
        ((System.ComponentModel.ISupportInitialize)jitterNumericUpDown).BeginInit();
        ((System.ComponentModel.ISupportInitialize)pressNumericUpDown).BeginInit();
        ((System.ComponentModel.ISupportInitialize)clicksPerTickNumericUpDown).BeginInit();
        ((System.ComponentModel.ISupportInitialize)clickLimitNumericUpDown).BeginInit();
        ((System.ComponentModel.ISupportInitialize)startDelayNumericUpDown).BeginInit();
        ((System.ComponentModel.ISupportInitialize)positionJitterNumericUpDown).BeginInit();
        ((System.ComponentModel.ISupportInitialize)timeLimitNumericUpDown).BeginInit();
        SuspendLayout();
        //
        // timers
        //
        captureCountdownTimer.Interval = 1000;
        startDelayTimer.Interval = 1000;
        uiTimer.Interval = 50;
        //
        // intervalLabel
        //
        intervalLabel.AutoSize = true;
        intervalLabel.Location = new Point(12, 18);
        intervalLabel.Name = "intervalLabel";
        intervalLabel.Text = "Interval (ms):";
        //
        // intervalNumericUpDown
        //
        intervalNumericUpDown.Location = new Point(148, 14);
        intervalNumericUpDown.Maximum = new decimal(new int[] { 3600000, 0, 0, 0 });
        intervalNumericUpDown.Minimum = new decimal(new int[] { 1, 0, 0, 0 });
        intervalNumericUpDown.Name = "intervalNumericUpDown";
        intervalNumericUpDown.Size = new Size(100, 23);
        intervalNumericUpDown.TabIndex = 1;
        intervalNumericUpDown.Value = new decimal(new int[] { 500, 0, 0, 0 });
        //
        // jitterLabel
        //
        jitterLabel.AutoSize = true;
        jitterLabel.Location = new Point(280, 18);
        jitterLabel.Name = "jitterLabel";
        jitterLabel.Text = "Jitter (+ms):";
        //
        // jitterNumericUpDown
        //
        jitterNumericUpDown.Location = new Point(420, 14);
        jitterNumericUpDown.Maximum = new decimal(new int[] { 10000, 0, 0, 0 });
        jitterNumericUpDown.Name = "jitterNumericUpDown";
        jitterNumericUpDown.Size = new Size(100, 23);
        jitterNumericUpDown.TabIndex = 3;
        //
        // pressLabel
        //
        pressLabel.AutoSize = true;
        pressLabel.Location = new Point(12, 50);
        pressLabel.Name = "pressLabel";
        pressLabel.Text = "Press (ms):";
        //
        // pressNumericUpDown
        //
        pressNumericUpDown.Location = new Point(148, 46);
        pressNumericUpDown.Maximum = new decimal(new int[] { 5000, 0, 0, 0 });
        pressNumericUpDown.Name = "pressNumericUpDown";
        pressNumericUpDown.Size = new Size(100, 23);
        pressNumericUpDown.TabIndex = 5;
        //
        // clicksPerTickLabel
        //
        clicksPerTickLabel.AutoSize = true;
        clicksPerTickLabel.Location = new Point(280, 50);
        clicksPerTickLabel.Name = "clicksPerTickLabel";
        clicksPerTickLabel.Text = "Clicks / tick:";
        //
        // clicksPerTickNumericUpDown
        //
        clicksPerTickNumericUpDown.Location = new Point(420, 46);
        clicksPerTickNumericUpDown.Maximum = new decimal(new int[] { 20, 0, 0, 0 });
        clicksPerTickNumericUpDown.Minimum = new decimal(new int[] { 1, 0, 0, 0 });
        clicksPerTickNumericUpDown.Name = "clicksPerTickNumericUpDown";
        clicksPerTickNumericUpDown.Size = new Size(100, 23);
        clicksPerTickNumericUpDown.TabIndex = 7;
        clicksPerTickNumericUpDown.Value = new decimal(new int[] { 1, 0, 0, 0 });
        //
        // clickLimitLabel
        //
        clickLimitLabel.AutoSize = true;
        clickLimitLabel.Location = new Point(12, 82);
        clickLimitLabel.Name = "clickLimitLabel";
        clickLimitLabel.Text = "Limit (0 = none):";
        //
        // clickLimitNumericUpDown
        //
        clickLimitNumericUpDown.Location = new Point(148, 78);
        clickLimitNumericUpDown.Maximum = new decimal(new int[] { 1000000, 0, 0, 0 });
        clickLimitNumericUpDown.Name = "clickLimitNumericUpDown";
        clickLimitNumericUpDown.Size = new Size(100, 23);
        clickLimitNumericUpDown.TabIndex = 9;
        //
        // mouseButtonLabel
        //
        mouseButtonLabel.AutoSize = true;
        mouseButtonLabel.Location = new Point(280, 82);
        mouseButtonLabel.Name = "mouseButtonLabel";
        mouseButtonLabel.Text = "Mouse button:";
        //
        // mouseButtonCombo
        //
        mouseButtonCombo.DropDownStyle = ComboBoxStyle.DropDownList;
        mouseButtonCombo.Items.AddRange(new object[] { "Left", "Right", "Middle" });
        mouseButtonCombo.Location = new Point(420, 78);
        mouseButtonCombo.Name = "mouseButtonCombo";
        mouseButtonCombo.Size = new Size(100, 23);
        mouseButtonCombo.TabIndex = 11;
        //
        // modeLabel
        //
        modeLabel.AutoSize = true;
        modeLabel.Location = new Point(12, 114);
        modeLabel.Name = "modeLabel";
        modeLabel.Text = "Mode:";
        //
        // modeClickRadio
        //
        modeClickRadio.AutoSize = true;
        modeClickRadio.Checked = true;
        modeClickRadio.Location = new Point(148, 112);
        modeClickRadio.Name = "modeClickRadio";
        modeClickRadio.TabIndex = 13;
        modeClickRadio.TabStop = true;
        modeClickRadio.Text = "Click";
        modeClickRadio.UseVisualStyleBackColor = true;
        //
        // modeHoldRadio
        //
        modeHoldRadio.AutoSize = true;
        modeHoldRadio.Location = new Point(210, 112);
        modeHoldRadio.Name = "modeHoldRadio";
        modeHoldRadio.TabIndex = 14;
        modeHoldRadio.Text = "Hold";
        modeHoldRadio.UseVisualStyleBackColor = true;
        //
        // startDelayLabel
        //
        startDelayLabel.AutoSize = true;
        startDelayLabel.Location = new Point(280, 114);
        startDelayLabel.Name = "startDelayLabel";
        startDelayLabel.Text = "Start delay (s):";
        //
        // startDelayNumericUpDown
        //
        startDelayNumericUpDown.Location = new Point(420, 110);
        startDelayNumericUpDown.Maximum = new decimal(new int[] { 60, 0, 0, 0 });
        startDelayNumericUpDown.Name = "startDelayNumericUpDown";
        startDelayNumericUpDown.Size = new Size(100, 23);
        startDelayNumericUpDown.TabIndex = 16;
        //
        // positionJitterLabel
        //
        positionJitterLabel.AutoSize = true;
        positionJitterLabel.Location = new Point(12, 146);
        positionJitterLabel.Name = "positionJitterLabel";
        positionJitterLabel.Text = "Pos. jitter (px):";
        //
        // positionJitterNumericUpDown
        //
        positionJitterNumericUpDown.Location = new Point(148, 142);
        positionJitterNumericUpDown.Maximum = new decimal(new int[] { 200, 0, 0, 0 });
        positionJitterNumericUpDown.Name = "positionJitterNumericUpDown";
        positionJitterNumericUpDown.Size = new Size(100, 23);
        positionJitterNumericUpDown.TabIndex = 18;
        //
        // stopOnMoveCheckBox
        //
        stopOnMoveCheckBox.AutoSize = true;
        stopOnMoveCheckBox.Location = new Point(280, 144);
        stopOnMoveCheckBox.Name = "stopOnMoveCheckBox";
        stopOnMoveCheckBox.TabIndex = 19;
        stopOnMoveCheckBox.Text = "Stop if mouse moves";
        stopOnMoveCheckBox.UseVisualStyleBackColor = true;
        //
        // timeLimitLabel
        //
        timeLimitLabel.AutoSize = true;
        timeLimitLabel.Location = new Point(12, 178);
        timeLimitLabel.Name = "timeLimitLabel";
        timeLimitLabel.Text = "Time limit (s):";
        //
        // timeLimitNumericUpDown
        //
        timeLimitNumericUpDown.Location = new Point(148, 174);
        timeLimitNumericUpDown.Maximum = new decimal(new int[] { 86400, 0, 0, 0 });
        timeLimitNumericUpDown.Name = "timeLimitNumericUpDown";
        timeLimitNumericUpDown.Size = new Size(100, 23);
        timeLimitNumericUpDown.TabIndex = 20;
        //
        // leavePointerCheckBox
        //
        leavePointerCheckBox.AutoSize = true;
        leavePointerCheckBox.Location = new Point(280, 176);
        leavePointerCheckBox.Name = "leavePointerCheckBox";
        leavePointerCheckBox.TabIndex = 21;
        leavePointerCheckBox.Text = "Leave pointer";
        leavePointerCheckBox.UseVisualStyleBackColor = true;
        //
        // fixedPositionCheckBox
        //
        fixedPositionCheckBox.AutoSize = true;
        fixedPositionCheckBox.Location = new Point(12, 208);
        fixedPositionCheckBox.Name = "fixedPositionCheckBox";
        fixedPositionCheckBox.TabIndex = 20;
        fixedPositionCheckBox.Text = "Use saved points";
        fixedPositionCheckBox.UseVisualStyleBackColor = true;
        //
        // positionLabel
        //
        positionLabel.AutoSize = true;
        positionLabel.Location = new Point(160, 210);
        positionLabel.Name = "positionLabel";
        positionLabel.Text = "No points yet";
        //
        // setPositionButton
        //
        setPositionButton.Location = new Point(12, 236);
        setPositionButton.Name = "setPositionButton";
        setPositionButton.Size = new Size(130, 26);
        setPositionButton.TabIndex = 22;
        setPositionButton.Text = "Capture in 3s…";
        setPositionButton.UseVisualStyleBackColor = true;
        setPositionButton.Click += setPositionButton_Click;
        //
        // removePointButton
        //
        removePointButton.Location = new Point(148, 236);
        removePointButton.Name = "removePointButton";
        removePointButton.Size = new Size(80, 26);
        removePointButton.TabIndex = 23;
        removePointButton.Text = "Remove";
        removePointButton.UseVisualStyleBackColor = true;
        //
        // clearPointsButton
        //
        clearPointsButton.Location = new Point(234, 236);
        clearPointsButton.Name = "clearPointsButton";
        clearPointsButton.Size = new Size(80, 26);
        clearPointsButton.TabIndex = 24;
        clearPointsButton.Text = "Clear";
        clearPointsButton.UseVisualStyleBackColor = true;
        //
        // pointsListBox
        //
        pointsListBox.IntegralHeight = false;
        pointsListBox.Location = new Point(12, 270);
        pointsListBox.Name = "pointsListBox";
        pointsListBox.Size = new Size(508, 72);
        pointsListBox.TabIndex = 25;
        //
        // startHotkeyLabel
        //
        startHotkeyLabel.AutoSize = true;
        startHotkeyLabel.Location = new Point(12, 356);
        startHotkeyLabel.Name = "startHotkeyLabel";
        startHotkeyLabel.Text = "Start hotkey:";
        //
        // startHotkeyCombo
        //
        startHotkeyCombo.DropDownStyle = ComboBoxStyle.DropDownList;
        startHotkeyCombo.Items.AddRange(new object[]
        {
            "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
        });
        startHotkeyCombo.Location = new Point(148, 352);
        startHotkeyCombo.Name = "startHotkeyCombo";
        startHotkeyCombo.Size = new Size(64, 23);
        startHotkeyCombo.TabIndex = 27;
        //
        // startCtrlCheck
        //
        startCtrlCheck.AutoSize = true;
        startCtrlCheck.Location = new Point(224, 354);
        startCtrlCheck.Name = "startCtrlCheck";
        startCtrlCheck.TabIndex = 28;
        startCtrlCheck.Text = "Ctrl";
        startCtrlCheck.UseVisualStyleBackColor = true;
        //
        // startAltCheck
        //
        startAltCheck.AutoSize = true;
        startAltCheck.Location = new Point(284, 354);
        startAltCheck.Name = "startAltCheck";
        startAltCheck.TabIndex = 29;
        startAltCheck.Text = "Alt";
        startAltCheck.UseVisualStyleBackColor = true;
        //
        // startShiftCheck
        //
        startShiftCheck.AutoSize = true;
        startShiftCheck.Location = new Point(340, 354);
        startShiftCheck.Name = "startShiftCheck";
        startShiftCheck.TabIndex = 30;
        startShiftCheck.Text = "Shift";
        startShiftCheck.UseVisualStyleBackColor = true;
        //
        // stopHotkeyLabel
        //
        stopHotkeyLabel.AutoSize = true;
        stopHotkeyLabel.Location = new Point(12, 388);
        stopHotkeyLabel.Name = "stopHotkeyLabel";
        stopHotkeyLabel.Text = "Stop hotkey:";
        //
        // stopHotkeyCombo
        //
        stopHotkeyCombo.DropDownStyle = ComboBoxStyle.DropDownList;
        stopHotkeyCombo.Items.AddRange(new object[]
        {
            "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
        });
        stopHotkeyCombo.Location = new Point(148, 384);
        stopHotkeyCombo.Name = "stopHotkeyCombo";
        stopHotkeyCombo.Size = new Size(64, 23);
        stopHotkeyCombo.TabIndex = 32;
        //
        // stopCtrlCheck
        //
        stopCtrlCheck.AutoSize = true;
        stopCtrlCheck.Location = new Point(224, 386);
        stopCtrlCheck.Name = "stopCtrlCheck";
        stopCtrlCheck.TabIndex = 33;
        stopCtrlCheck.Text = "Ctrl";
        stopCtrlCheck.UseVisualStyleBackColor = true;
        //
        // stopAltCheck
        //
        stopAltCheck.AutoSize = true;
        stopAltCheck.Location = new Point(284, 386);
        stopAltCheck.Name = "stopAltCheck";
        stopAltCheck.TabIndex = 34;
        stopAltCheck.Text = "Alt";
        stopAltCheck.UseVisualStyleBackColor = true;
        //
        // stopShiftCheck
        //
        stopShiftCheck.AutoSize = true;
        stopShiftCheck.Location = new Point(340, 386);
        stopShiftCheck.Name = "stopShiftCheck";
        stopShiftCheck.TabIndex = 35;
        stopShiftCheck.Text = "Shift";
        stopShiftCheck.UseVisualStyleBackColor = true;
        //
        // minimizeToTrayCheckBox
        //
        minimizeToTrayCheckBox.AutoSize = true;
        minimizeToTrayCheckBox.Location = new Point(12, 420);
        minimizeToTrayCheckBox.Name = "minimizeToTrayCheckBox";
        minimizeToTrayCheckBox.TabIndex = 36;
        minimizeToTrayCheckBox.Text = "Minimize to tray";
        minimizeToTrayCheckBox.UseVisualStyleBackColor = true;
        //
        // alwaysOnTopCheckBox
        //
        alwaysOnTopCheckBox.AutoSize = true;
        alwaysOnTopCheckBox.Location = new Point(160, 420);
        alwaysOnTopCheckBox.Name = "alwaysOnTopCheckBox";
        alwaysOnTopCheckBox.TabIndex = 37;
        alwaysOnTopCheckBox.Text = "Always on top";
        alwaysOnTopCheckBox.UseVisualStyleBackColor = true;
        //
        // presetLabel
        //
        presetLabel.AutoSize = true;
        presetLabel.Location = new Point(12, 454);
        presetLabel.Name = "presetLabel";
        presetLabel.Text = "Preset:";
        //
        // presetCombo
        //
        presetCombo.AutoCompleteMode = AutoCompleteMode.SuggestAppend;
        presetCombo.AutoCompleteSource = AutoCompleteSource.ListItems;
        presetCombo.Location = new Point(148, 450);
        presetCombo.MaxLength = 48;
        presetCombo.Name = "presetCombo";
        presetCombo.Size = new Size(230, 23);
        presetCombo.TabIndex = 39;
        //
        // savePresetButton
        //
        savePresetButton.Location = new Point(388, 448);
        savePresetButton.Name = "savePresetButton";
        savePresetButton.Size = new Size(64, 26);
        savePresetButton.TabIndex = 40;
        savePresetButton.Text = "Save";
        savePresetButton.UseVisualStyleBackColor = true;
        //
        // deletePresetButton
        //
        deletePresetButton.Location = new Point(458, 448);
        deletePresetButton.Name = "deletePresetButton";
        deletePresetButton.Size = new Size(62, 26);
        deletePresetButton.TabIndex = 41;
        deletePresetButton.Text = "Delete";
        deletePresetButton.UseVisualStyleBackColor = true;
        //
        // startButton
        //
        startButton.Location = new Point(12, 488);
        startButton.Name = "startButton";
        startButton.Size = new Size(100, 28);
        startButton.TabIndex = 42;
        startButton.Text = "Start";
        startButton.UseVisualStyleBackColor = true;
        startButton.Click += startButton_Click;
        //
        // stopButton
        //
        stopButton.Enabled = false;
        stopButton.Location = new Point(120, 488);
        stopButton.Name = "stopButton";
        stopButton.Size = new Size(100, 28);
        stopButton.TabIndex = 43;
        stopButton.Text = "Stop";
        stopButton.UseVisualStyleBackColor = true;
        stopButton.Click += stopButton_Click;
        //
        // statusLabel
        //
        statusLabel.AutoSize = true;
        statusLabel.Location = new Point(12, 528);
        statusLabel.Name = "statusLabel";
        statusLabel.Text = "Status: Stopped";
        //
        // statsLabel
        //
        statsLabel.AutoSize = true;
        statsLabel.Location = new Point(12, 550);
        statsLabel.Name = "statsLabel";
        statsLabel.Text = "Clicks: 0 — 00:00";
        //
        // hotkeyStatusLabel
        //
        hotkeyStatusLabel.Location = new Point(12, 572);
        hotkeyStatusLabel.Name = "hotkeyStatusLabel";
        hotkeyStatusLabel.Size = new Size(508, 36);
        hotkeyStatusLabel.Text = "Start: F6\r\nStop: F7";
        //
        // trayIcon
        //
        trayIcon.Text = "AutoClicker";
        trayIcon.Visible = false;
        //
        // toolTip
        //
        toolTip.SetToolTip(intervalNumericUpDown, "Time from the start of one click to the start of the next.");
        toolTip.SetToolTip(jitterNumericUpDown, "Adds a random 0…N milliseconds to each interval.");
        toolTip.SetToolTip(pressNumericUpDown, "How long to hold the button down on each click. 0 is a quick click.");
        toolTip.SetToolTip(clicksPerTickNumericUpDown, "Clicks sent each interval. 2 is a double-click, spaced 40 ms apart.");
        toolTip.SetToolTip(clickLimitNumericUpDown, "Stop after this many clicks. 0 keeps going until Stop.");
        toolTip.SetToolTip(timeLimitNumericUpDown, "Stop after this many seconds of clicking or holding. 0 keeps going until Stop.");
        toolTip.SetToolTip(leavePointerCheckBox, "Click the window under each saved point and leave your pointer where it is. Turn off Stop if mouse moves if you want to keep using the mouse. Some programs only respond to a real cursor click.");
        toolTip.SetToolTip(startDelayNumericUpDown, "Wait this many seconds after Start so you can focus another window.");
        toolTip.SetToolTip(positionJitterNumericUpDown, "Random pixel offset around each saved point.");
        toolTip.SetToolTip(stopOnMoveCheckBox, "Stop when the pointer moves a few pixels from the click position.");
        toolTip.SetToolTip(presetCombo, "Type a name and Save. Pick a saved name to load those settings.");
        //
        // MainForm
        //
        AutoScaleDimensions = new SizeF(7F, 15F);
        AutoScaleMode = AutoScaleMode.Font;
        CancelButton = stopButton;
        ClientSize = new Size(532, 620);
        Controls.Add(hotkeyStatusLabel);
        Controls.Add(statsLabel);
        Controls.Add(statusLabel);
        Controls.Add(stopButton);
        Controls.Add(startButton);
        Controls.Add(deletePresetButton);
        Controls.Add(savePresetButton);
        Controls.Add(presetCombo);
        Controls.Add(presetLabel);
        Controls.Add(alwaysOnTopCheckBox);
        Controls.Add(minimizeToTrayCheckBox);
        Controls.Add(stopShiftCheck);
        Controls.Add(stopAltCheck);
        Controls.Add(stopCtrlCheck);
        Controls.Add(stopHotkeyCombo);
        Controls.Add(stopHotkeyLabel);
        Controls.Add(startShiftCheck);
        Controls.Add(startAltCheck);
        Controls.Add(startCtrlCheck);
        Controls.Add(startHotkeyCombo);
        Controls.Add(startHotkeyLabel);
        Controls.Add(pointsListBox);
        Controls.Add(clearPointsButton);
        Controls.Add(removePointButton);
        Controls.Add(setPositionButton);
        Controls.Add(positionLabel);
        Controls.Add(fixedPositionCheckBox);
        Controls.Add(leavePointerCheckBox);
        Controls.Add(timeLimitNumericUpDown);
        Controls.Add(timeLimitLabel);
        Controls.Add(stopOnMoveCheckBox);
        Controls.Add(positionJitterNumericUpDown);
        Controls.Add(positionJitterLabel);
        Controls.Add(startDelayNumericUpDown);
        Controls.Add(startDelayLabel);
        Controls.Add(modeHoldRadio);
        Controls.Add(modeClickRadio);
        Controls.Add(modeLabel);
        Controls.Add(mouseButtonCombo);
        Controls.Add(mouseButtonLabel);
        Controls.Add(clickLimitNumericUpDown);
        Controls.Add(clickLimitLabel);
        Controls.Add(clicksPerTickNumericUpDown);
        Controls.Add(clicksPerTickLabel);
        Controls.Add(pressNumericUpDown);
        Controls.Add(pressLabel);
        Controls.Add(jitterNumericUpDown);
        Controls.Add(jitterLabel);
        Controls.Add(intervalNumericUpDown);
        Controls.Add(intervalLabel);
        FormBorderStyle = FormBorderStyle.FixedSingle;
        MaximizeBox = false;
        Name = "MainForm";
        StartPosition = FormStartPosition.CenterScreen;
        Text = "AutoClicker";
        ((System.ComponentModel.ISupportInitialize)intervalNumericUpDown).EndInit();
        ((System.ComponentModel.ISupportInitialize)jitterNumericUpDown).EndInit();
        ((System.ComponentModel.ISupportInitialize)pressNumericUpDown).EndInit();
        ((System.ComponentModel.ISupportInitialize)clicksPerTickNumericUpDown).EndInit();
        ((System.ComponentModel.ISupportInitialize)clickLimitNumericUpDown).EndInit();
        ((System.ComponentModel.ISupportInitialize)startDelayNumericUpDown).EndInit();
        ((System.ComponentModel.ISupportInitialize)positionJitterNumericUpDown).EndInit();
        ((System.ComponentModel.ISupportInitialize)timeLimitNumericUpDown).EndInit();
        ResumeLayout(false);
        PerformLayout();
    }
}
