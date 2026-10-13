"""The Python suite checks the one room module: join, whisper, and shop."""

import json
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTRACT = Path(__file__).resolve().parent / "room-contract.mjs"


class RoomModuleTests(unittest.TestCase):
    def test_join_whisper_and_shop_match_the_room_module(self):
        result = subprocess.run(
            ["node", str(CONTRACT)],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        report = json.loads(result.stdout)
        self.assertEqual(report["joined"], "Mara")
        self.assertEqual(report["publicWhisper"], [])
        self.assertEqual(report["ivoWhisper"], ["On the table.", "Just for Ivo."])
        self.assertEqual(
            report["maraWhisper"],
            ["On the table.", "Just for Ivo.", "The door is trapped."],
        )
        self.assertEqual(report["dmWhisper"], ["On the table.", "The door is trapped."])
        self.assertEqual(report["shopName"], "Vials")
        self.assertTrue(report["playerShopBlocked"])
        self.assertTrue(report["impostorBlocked"])


if __name__ == "__main__":
    unittest.main()
