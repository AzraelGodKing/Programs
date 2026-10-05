import json
import sys
import threading
import unittest
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from room import Table, TableError
from server import Handler
from http.server import ThreadingHTTPServer


class TableTests(unittest.TestCase):
    def test_two_players_stay_separate(self):
        table = Table()
        code = table.create()
        self.assertEqual(len(code), 4)
        table.update(code, {
            "name": "Mara",
            "summaries": ["Rolled 18 for Perception. 1d20 + 3."],
            "intent": "Perception",
            "snapshot": {"notes": "the well is warm", "tab": "dice"},
        })
        table.update(code, {
            "name": "Ivo",
            "summaries": ["Lit a torch."],
            "snapshot": {"lights": [{"kind": "torch"}]},
        })
        view = table.view(code)
        self.assertEqual(
            [event["summary"] for event in view["events"]],
            ["Lit a torch.", "Rolled 18 for Perception. 1d20 + 3."],
        )
        self.assertEqual(view["events"][1]["name"], "Mara")
        by_name = {player["name"]: player for player in view["players"]}
        self.assertEqual(by_name["Mara"]["snapshot"]["notes"], "the well is warm")
        self.assertEqual(by_name["Mara"]["intent"], "Perception")
        self.assertEqual(by_name["Ivo"]["snapshot"]["lights"][0]["kind"], "torch")

    def test_blank_summary_updates_the_board_without_a_log_line(self):
        table = Table()
        code = table.create()
        table.update(code, {"name": "Mara", "summaries": [], "snapshot": {"notes": "still writing"}})
        view = table.view(code)
        self.assertEqual(view["events"], [])
        self.assertEqual(view["players"][0]["snapshot"]["notes"], "still writing")

    def test_unknown_table_and_bad_payloads(self):
        table = Table()
        self.assertIsNone(table.view("ZZZZ"))
        code = table.create()
        self.assertIsNone(table.update("NOPE", {"name": "Mara", "snapshot": {}}))
        with self.assertRaises(TableError):
            table.update(code, {"name": "   ", "snapshot": {}})
        with self.assertRaises(TableError):
            table.update(code, {"name": "Mara", "snapshot": ["nope"]})

    def test_event_log_caps(self):
        table = Table()
        code = table.create()
        for index in range(520):
            table.update(code, {"name": "Mara", "summaries": [f"Action {index}"], "snapshot": {}})
        view = table.view(code)
        self.assertEqual(len(view["events"]), 500)
        self.assertEqual(view["events"][0]["summary"], "Action 519")


class ServerTests(unittest.TestCase):
    def test_http_round_trip(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        port = server.server_address[1]
        try:
            created = request(port, "POST", "/api/rooms")
            self.assertEqual(created.status, 201)
            code = json.loads(created.body)["code"]
            posted = request(port, "POST", f"/api/rooms/{code}", {
                "name": "Mara",
                "summaries": ["Added Guard to the order at initiative 14."],
                "intent": "Initiative",
                "snapshot": {"combat": {"combatants": [{"name": "Guard", "hp": 8}]}},
            })
            self.assertEqual(posted.status, 200)
            fetched = request(port, "GET", f"/api/rooms/{code}")
            view = json.loads(fetched.body)
            self.assertEqual(view["events"][0]["name"], "Mara")
            self.assertIn("Guard", view["events"][0]["summary"])
            self.assertEqual(view["players"][0]["snapshot"]["combat"]["combatants"][0]["hp"], 8)
            self.assertIs(view["shop"], True)
            closed = request(port, "POST", f"/api/rooms/{code}/shop", {"open": False})
            self.assertEqual(closed.status, 200)
            self.assertIs(json.loads(closed.body)["shop"], False)
            again = json.loads(request(port, "GET", f"/api/rooms/{code}").body)
            self.assertIs(again["shop"], False)
            opened = request(port, "POST", f"/api/rooms/{code}/shop", {"open": True})
            self.assertIs(json.loads(opened.body)["shop"], True)
            missing = request(port, "GET", "/api/rooms/ZZZZ")
            self.assertEqual(missing.status, 404)
        finally:
            server.shutdown()


def request(port, method, path, payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(
        f"http://127.0.0.1:{port}{path}",
        data=data,
        method=method,
        headers={"content-type": "application/json"} if data else {},
    )
    try:
        with urllib.request.urlopen(req) as response:
            return Response(response.status, response.read().decode())
    except urllib.error.HTTPError as error:
        return Response(error.code, error.read().decode())


class Response:
    def __init__(self, status, body):
        self.status = status
        self.body = body


if __name__ == "__main__":
    unittest.main()
