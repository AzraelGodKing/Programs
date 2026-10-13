#!/usr/bin/env python3
"""Launch Lantern. The table rules live in worker/room.js, which this server runs."""

import os
import sys
from pathlib import Path

NODE = os.environ.get("NODE", "node")
SCRIPT = Path(__file__).resolve().with_name("serve.mjs")
os.execvp(NODE, [NODE, str(SCRIPT), *sys.argv[1:]])
