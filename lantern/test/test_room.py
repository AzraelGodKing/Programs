import json
import sys
import threading
import unittest
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from room import DM_NAME, Table, TableError
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


class TalkTests(unittest.TestCase):
    def test_whispers_stay_between_the_two_seats(self):
        table = Table()
        code = table.create()
        table.talk(code, {"name": "Mara", "text": "On the table.", "to": ""})
        table.talk(code, {"name": "Mara", "text": "Just for Ivo.", "to": "Ivo"})
        table.talk(code, {"name": DM_NAME, "text": "The door is trapped.", "to": "Mara"})
        self.assertEqual(
            [item["text"] for item in table.view(code)["messages"]],
            ["On the table."],
        )
        self.assertEqual(
            [item["text"] for item in table.view(code, "Ivo")["messages"]],
            ["On the table.", "Just for Ivo."],
        )
        self.assertEqual(
            [item["text"] for item in table.view(code, "Mara")["messages"]],
            ["On the table.", "Just for Ivo.", "The door is trapped."],
        )
        self.assertEqual(
            [item["text"] for item in table.view(code, DM_NAME)["messages"]],
            ["On the table.", "The door is trapped."],
        )
        with self.assertRaises(TableError):
            table.talk(code, {"name": "Mara", "text": "   ", "to": ""})
        with self.assertRaises(TableError):
            table.talk(code, {"name": "Mara", "text": "Hello", "to": "Mara"})

    def test_a_stall_keeps_only_the_lines_on_the_counter(self):
        table = Table()
        code = table.create()
        self.assertIs(table.view(code)["shop"], True)
        shop = table.set_shop(code, {
            "open": True,
            "stall": "apothecary",
            "name": "  Vials  ",
            "goods": [
                {"id": "potion-healing", "name": "Potion of healing", "cp": 4000, "service": False},
                {"id": "upgrade-plus-1", "name": "Bring a weapon or armor from +0 to +1", "cp": 50000, "service": True},
                {"id": "nope", "name": "", "cp": 1},
                {"id": "Longsword", "name": "Longsword", "cp": 1500},
            ],
        })
        self.assertEqual(shop["name"], "Vials")
        self.assertEqual(shop["stall"], "apothecary")
        self.assertEqual([item["id"] for item in shop["goods"]], ["potion-healing", "upgrade-plus-1"])
        self.assertIs(shop["goods"][1]["service"], True)
        self.assertEqual(table.view(code)["shop"]["name"], "Vials")
        closed = table.set_shop(code, {"open": False, "name": "Vials", "stall": "apothecary", "goods": shop["goods"]})
        self.assertIs(closed["open"], False)
        self.assertEqual(table.view(code)["shop"]["goods"][0]["cp"], 4000)

    def test_a_sale_can_be_bought_back_until_the_dm_closes(self):
        table = Table()
        code = table.create()
        table.set_shop(code, {
            "open": True,
            "name": "Smith",
            "stall": "smith",
            "goods": [{"id": "longsword", "name": "Longsword", "cp": 1500, "service": False}],
        })
        held = table.trade_buyback(code, {"name": "Mara", "action": "sell", "id": "longsword", "cp": 750})
        held = table.trade_buyback(code, {"name": "Mara", "action": "sell", "id": "longsword", "cp": 750})
        self.assertEqual(held, [{"id": "longsword", "seller": "Mara", "cp": 750, "qty": 2}])
        with self.assertRaises(TableError):
            table.trade_buyback(code, {"name": "Ivo", "action": "buy", "id": "longsword", "cp": 750})
        table.set_shop(code, {
            "open": True,
            "name": "Tavern",
            "stall": "tavern",
            "goods": [],
        })
        self.assertEqual(table.view(code)["buybacks"][0]["qty"], 2)
        bought = table.trade_buyback(code, {"name": "Mara", "action": "buy", "id": "longsword", "cp": 750})
        self.assertEqual(bought[0]["qty"], 1)
        table.set_shop(code, {"open": False, "name": "Tavern", "stall": "tavern", "goods": []})
        self.assertEqual(table.view(code)["buybacks"], [])
        with self.assertRaises(TableError):
            table.trade_buyback(code, {"name": "Mara", "action": "buy", "id": "longsword", "cp": 750})
        table.set_shop(code, {"open": True, "name": "Smith", "stall": "smith", "goods": []})
        self.assertEqual(table.view(code)["buybacks"], [])


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
            said = request(port, "POST", f"/api/rooms/{code}/talk", {
                "name": "Mara",
                "text": "The well is warm.",
                "to": "",
            })
            self.assertEqual(said.status, 200)
            whispered = request(port, "POST", f"/api/rooms/{code}/talk", {
                "name": "Mara",
                "text": "I palmed the key.",
                "to": DM_NAME,
            })
            self.assertEqual(whispered.status, 200)
            public = json.loads(request(port, "GET", f"/api/rooms/{code}").body)
            self.assertEqual([item["text"] for item in public["messages"]], ["The well is warm."])
            privately = json.loads(request(port, "GET", f"/api/rooms/{code}?as={DM_NAME.replace(' ', '%20')}").body)
            self.assertEqual(
                [item["text"] for item in privately["messages"]],
                ["The well is warm.", "I palmed the key."],
            )
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
