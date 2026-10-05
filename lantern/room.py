"""In-memory table shared by players and the DM screen."""

import json
import secrets
import threading
import time

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
EVENT_CAP = 500
SUMMARY_CAP = 20
SUMMARY_LENGTH = 300
NAME_LENGTH = 40
INTENT_LENGTH = 60
SNAPSHOT_BYTES = 200_000


class TableError(ValueError):
    pass


class Table:
    def __init__(self):
        self._lock = threading.Lock()
        self._rooms = {}

    def create(self):
        with self._lock:
            code = self._fresh_code()
            self._rooms[code] = {"events": [], "players": {}}
            return code

    def view(self, code):
        with self._lock:
            room = self._rooms.get(code)
            if room is None:
                return None
            players = [
                {
                    "name": name,
                    "seen": record["seen"],
                    "intent": record["intent"],
                    "snapshot": record["snapshot"],
                }
                for name, record in room["players"].items()
            ]
            players.sort(key=lambda player: player["seen"], reverse=True)
            events = list(reversed(room["events"]))
            return {"code": code, "events": events, "players": players}

    def update(self, code, payload):
        if not isinstance(payload, dict):
            raise TableError("Expected an object.")
        name = clean_name(payload.get("name"))
        summaries = clean_summaries(payload.get("summaries"))
        intent = clean_intent(payload.get("intent"))
        snapshot = payload.get("snapshot", {})
        if not isinstance(snapshot, dict):
            raise TableError("The table snapshot has to be an object.")
        encoded = json.dumps(snapshot).encode("utf-8")
        if len(encoded) > SNAPSHOT_BYTES:
            raise TableError("That update is too large.")
        snapshot = json.loads(encoded)

        with self._lock:
            room = self._rooms.get(code)
            if room is None:
                return None
            now = int(time.time() * 1000)
            room["players"][name] = {
                "seen": now,
                "intent": intent,
                "snapshot": snapshot,
            }
            for summary in summaries:
                room["events"].append({
                    "id": secrets.token_hex(8),
                    "at": now,
                    "name": name,
                    "summary": summary,
                })
            if len(room["events"]) > EVENT_CAP:
                room["events"] = room["events"][-EVENT_CAP:]
            return True

    def _fresh_code(self):
        for _ in range(30):
            code = "".join(secrets.choice(ALPHABET) for _ in range(4))
            if code not in self._rooms:
                return code
        raise TableError("Could not open a table.")


def clean_name(value):
    if not isinstance(value, str):
        raise TableError("A name is required.")
    name = " ".join(value.split())[:NAME_LENGTH]
    if not name:
        raise TableError("A name is required.")
    return name


def clean_intent(value):
    if value is None:
        return ""
    if not isinstance(value, str):
        raise TableError("The roll note has to be text.")
    return " ".join(value.split())[:INTENT_LENGTH]


def clean_summaries(value):
    if value is None:
        return []
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, list):
        raise TableError("The activity log has to be a list.")
    summaries = []
    for item in value[:SUMMARY_CAP]:
        if not isinstance(item, str):
            continue
        text = " ".join(item.split())[:SUMMARY_LENGTH]
        if text:
            summaries.append(text)
    return summaries
