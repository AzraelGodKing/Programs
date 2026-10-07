"""In-memory table shared by players and the DM screen."""

import json
import re
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
MESSAGE_CAP = 200
MESSAGE_LENGTH = 400
DM_NAME = "Dungeon Master"


class TableError(ValueError):
    pass


class Table:
    def __init__(self):
        self._lock = threading.Lock()
        self._rooms = {}

    def create(self):
        with self._lock:
            code = self._fresh_code()
            self._rooms[code] = {"events": [], "players": {}, "shop": True, "messages": []}
            return code

    def view(self, code, viewer=""):
        with self._lock:
            room = self._rooms.get(code)
            if room is None:
                return None
            who = clean_viewer(viewer)
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
            messages = [
                dict(message)
                for message in room.get("messages", [])
                if message_visible(message, who)
            ]
            shop = room.get("shop", True)
            buybacks = [dict(line) for line in room.get("buybacks", [])] if shop_is_open(shop) else []
            return {
                "code": code,
                "events": events,
                "players": players,
                "shop": shop,
                "buybacks": buybacks,
                "messages": messages,
            }

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

    def set_shop(self, code, payload):
        shop = clean_shop(payload)
        with self._lock:
            room = self._rooms.get(code)
            if room is None:
                return None
            room["shop"] = shop
            if not shop_is_open(shop):
                room["buybacks"] = []
            return shop

    def trade_buyback(self, code, payload):
        name, action, item_id, price = clean_buyback(payload)
        with self._lock:
            room = self._rooms.get(code)
            if room is None:
                return None
            if not shop_is_open(room.get("shop", True)):
                raise TableError("The shop is closed.")
            lines = room.setdefault("buybacks", [])
            found = next((
                line for line in lines
                if line["seller"] == name and line["id"] == item_id and line["cp"] == price
            ), None)
            if action == "sell":
                if found:
                    found["qty"] = min(99, found["qty"] + 1)
                elif len(lines) >= 60:
                    raise TableError("The counter is holding too much.")
                else:
                    lines.append({"id": item_id, "seller": name, "cp": price, "qty": 1})
            else:
                if not found or found["qty"] < 1:
                    raise TableError("That is no longer held for buy back.")
                found["qty"] -= 1
                if found["qty"] <= 0:
                    lines.remove(found)
            return [dict(line) for line in lines]

    def talk(self, code, payload):
        if not isinstance(payload, dict):
            raise TableError("Expected an object.")
        name = clean_name(payload.get("name"))
        text = clean_message(payload.get("text"))
        target = clean_target(payload.get("to"))
        if target == name:
            raise TableError("Whisper someone else.")
        ask = clean_ask(payload.get("ask"), name)
        with self._lock:
            room = self._rooms.get(code)
            if room is None:
                return None
            messages = room.setdefault("messages", [])
            message = {
                "id": secrets.token_hex(8),
                "at": int(time.time() * 1000),
                "from": name,
                "to": target,
                "text": text,
            }
            if ask:
                message["ask"] = ask
            messages.append(message)
            if len(messages) > MESSAGE_CAP:
                room["messages"] = messages[-MESSAGE_CAP:]
            return dict(message)

    def _fresh_code(self):
        for _ in range(30):
            code = "".join(secrets.choice(ALPHABET) for _ in range(4))
            if code not in self._rooms:
                return code
        raise TableError("Could not open a table.")


def shop_is_open(shop):
    if isinstance(shop, dict):
        return shop.get("open") is not False
    return shop is not False


def clean_buyback(payload):
    if not isinstance(payload, dict):
        raise TableError("Expected an object.")
    name = clean_name(payload.get("name"))
    action = payload.get("action")
    if action not in ("sell", "buy"):
        raise TableError("Say whether this is a sale or a buy back.")
    item_id = payload.get("id")
    if not isinstance(item_id, str) or re.fullmatch(r"[a-z0-9-]{1,40}", item_id) is None:
        raise TableError("That is not on the counter.")
    price = payload.get("cp")
    if isinstance(price, bool) or not isinstance(price, int) or price < 0 or price > 10_000_000:
        raise TableError("That price is not a price.")
    return name, action, item_id, price


def clean_shop(payload):
    if not isinstance(payload, dict):
        raise TableError("Expected an object.")
    open_ = payload.get("open")
    if not isinstance(open_, bool):
        raise TableError("The shop switch has to be on or off.")
    if "goods" not in payload and "name" not in payload and "stall" not in payload:
        return open_
    name = payload.get("name", "")
    if not isinstance(name, str):
        raise TableError("The shop needs a name.")
    name = " ".join(name.split())[:40]
    stall = payload.get("stall", "")
    if not isinstance(stall, str) or re.fullmatch(r"[a-z0-9-]{0,20}", stall.strip() or "") is None:
        stall = ""
    else:
        stall = stall.strip()
    goods_raw = payload.get("goods", [])
    if not isinstance(goods_raw, list):
        raise TableError("The counter has to be a list.")
    goods = []
    seen = set()
    for raw in goods_raw:
        if len(goods) == 60:
            break
        if not isinstance(raw, dict):
            continue
        item_id = raw.get("id")
        if not isinstance(item_id, str) or re.fullmatch(r"[a-z0-9-]{1,40}", item_id) is None:
            continue
        if item_id in seen:
            continue
        label = raw.get("name")
        if not isinstance(label, str):
            continue
        label = " ".join(label.split())[:60]
        if not label:
            continue
        price = raw.get("cp")
        if isinstance(price, bool) or not isinstance(price, int) or price < 0 or price > 10_000_000:
            continue
        goods.append({
            "id": item_id,
            "name": label,
            "cp": price,
            "service": raw.get("service") is True,
        })
        seen.add(item_id)
    return {"open": open_, "name": name or "Shop", "stall": stall, "goods": goods}


def clean_viewer(value):
    if not isinstance(value, str):
        return ""
    return " ".join(value.split())[:NAME_LENGTH]


def message_visible(message, viewer):
    target = message.get("to") or ""
    if not target:
        return True
    if not viewer:
        return False
    return message.get("from") == viewer or target == viewer


def clean_message(value):
    if not isinstance(value, str):
        raise TableError("A message has to be text.")
    text = " ".join(value.split())[:MESSAGE_LENGTH]
    if not text:
        raise TableError("Write a message first.")
    return text


def clean_target(value):
    if value is None or value == "":
        return ""
    if not isinstance(value, str):
        raise TableError("Whisper a name, or leave it open to the table.")
    target = " ".join(value.split())[:NAME_LENGTH]
    return target


def clean_ask(value, name):
    """A roll the DM asks for, like "Perception". Only the DM can ask."""
    if value is None or value == "":
        return ""
    if not isinstance(value, str):
        raise TableError("Ask for a roll by name.")
    if name != DM_NAME:
        raise TableError("Only the DM asks for rolls.")
    return " ".join(value.split())[:INTENT_LENGTH]


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
