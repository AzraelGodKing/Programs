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
            self._rooms[code] = {
                "events": [],
                "players": {},
                "shop": True,
                "messages": [],
                "order": blank_order(),
            }
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
                "order": clean_order(room.get("order")),
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

    def set_order(self, code, payload):
        if not isinstance(payload, dict):
            raise TableError("Expected an object.")
        name = clean_name(payload.get("name"))
        with self._lock:
            room = self._rooms.get(code)
            if room is None:
                return None
            result = apply_order(clean_order(room.get("order")), payload, name, name == DM_NAME)
            if not result["ok"]:
                raise TableError(result["reason"])
            room["order"] = result["order"]
            return result["order"]

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


MARKS = (
    "blinded",
    "charmed",
    "deafened",
    "frightened",
    "grappled",
    "incapacitated",
    "invisible",
    "paralyzed",
    "petrified",
    "poisoned",
    "prone",
    "restrained",
    "stunned",
    "unconscious",
    "concentrating",
)
ROW_CAP = 24
ROW_ID = re.compile(r"[A-Za-z0-9-]{8,40}")


def blank_order():
    return {"round": 1, "started": False, "activeId": None, "rows": [], "rev": 0}


def clamp_int(value, fallback, low, high):
    if isinstance(value, bool) or not isinstance(value, int):
        return fallback
    return max(low, min(high, value))


def clean_label(value, limit=80):
    if not isinstance(value, str):
        return ""
    return " ".join(value.split())[:limit]


def clean_marks(value):
    source = value if isinstance(value, list) else []
    return [mark for mark in MARKS if mark in source]


def clean_row(raw):
    if not isinstance(raw, dict):
        return None
    row_id = raw.get("id")
    name = clean_label(raw.get("name", ""))
    if not isinstance(row_id, str) or ROW_ID.fullmatch(row_id) is None or not name:
        return None
    max_hp = clamp_int(raw.get("maxHp"), 1, 1, 999)
    ac = raw.get("ac")
    return {
        "id": row_id,
        "name": name,
        "seat": clean_label(raw.get("seat", ""), 40),
        "init": clamp_int(raw.get("init"), 0, -100, 200),
        "bonus": clamp_int(raw.get("bonus"), 0, -30, 30),
        "hp": clamp_int(raw.get("hp"), 0, 0, max_hp),
        "maxHp": max_hp,
        "ac": None if ac in (None, "") else clamp_int(ac, None, 0, 40),
        "marks": clean_marks(raw.get("marks")),
        "added": clamp_int(raw.get("added"), 0, 0, 1_000_000_000),
    }


def turn_rows(order):
    rows = order.get("rows") if isinstance(order, dict) else []
    return sorted(rows, key=lambda row: (-row["init"], row["added"]))


def clean_order(raw):
    blank = blank_order()
    if not isinstance(raw, dict):
        return blank
    rows = []
    seen = set()
    for item in raw.get("rows") or []:
        row = clean_row(item)
        if row is None or row["id"] in seen:
            continue
        seen.add(row["id"])
        rows.append(row)
        if len(rows) == ROW_CAP:
            break
    started = raw.get("started") is True and len(rows) > 0
    active = raw.get("activeId")
    active_id = active if any(row["id"] == active for row in rows) else None
    if started and active_id is None:
        active_id = turn_rows({"rows": rows})[0]["id"]
    if not started:
        active_id = None
    return {
        "round": clamp_int(raw.get("round"), 1, 1, 999),
        "started": started,
        "activeId": active_id,
        "rows": rows,
        "rev": clamp_int(raw.get("rev"), 0, 0, 1_000_000_000),
    }


def clone_order(order):
    return json.loads(json.dumps(order))


def bump_order(order):
    order["rev"] += 1
    return {"ok": True, "order": order}


def fail_order(reason):
    return {"ok": False, "reason": reason}


def next_added(rows):
    return max((row["added"] for row in rows), default=0) + 1


def row_id():
    return secrets.token_hex(8)


def placeholder_row(action, seat, rows):
    hp = clamp_int(action.get("hp"), 0, 0, 999)
    max_hp = clamp_int(action.get("maxHp"), max(hp, 1), 1, 999)
    ac = action.get("ac")
    return {
        "id": row_id(),
        "name": clean_label(action.get("label", "")) or seat,
        "seat": seat,
        "init": 0,
        "bonus": 0,
        "hp": min(hp, max_hp),
        "maxHp": max_hp,
        "ac": clamp_int(ac, None, 0, 40) if isinstance(ac, int) and not isinstance(ac, bool) else None,
        "marks": clean_marks(action.get("marks")),
        "added": next_added(rows),
    }


def write_vitals(row, action):
    if "maxHp" in action and action.get("maxHp") not in (None, ""):
        row["maxHp"] = clamp_int(action.get("maxHp"), row["maxHp"], 1, 999)
    if "hp" in action and action.get("hp") not in (None, ""):
        row["hp"] = clamp_int(action.get("hp"), row["hp"], 0, row["maxHp"])
    else:
        row["hp"] = min(row["hp"], row["maxHp"])
    ac = action.get("ac")
    if isinstance(ac, int) and not isinstance(ac, bool):
        row["ac"] = clamp_int(ac, row["ac"], 0, 40)
    if "marks" in action:
        row["marks"] = clean_marks(action.get("marks"))
    label = clean_label(action.get("label", ""))
    if label:
        row["name"] = label


def apply_order(order, action, name, dm):
    current = clean_order(order)
    name = clean_label(name, 40)
    op = action.get("op") if isinstance(action, dict) else ""
    if not name:
        return fail_order("A name is required.")
    if op == "add":
        if not dm:
            return fail_order("The DM adds creatures.")
        label = clean_label(action.get("label", ""))
        if not label:
            return fail_order("Give them a name.")
        if len(current["rows"]) >= ROW_CAP:
            return fail_order("The order holds 24.")
        nxt = clone_order(current)
        hp = clamp_int(action.get("hp"), 10, 0, 999)
        max_hp = clamp_int(action.get("maxHp"), max(hp, 1), 1, 999)
        ac = action.get("ac")
        nxt["rows"].append({
            "id": row_id(),
            "name": label,
            "seat": "",
            "init": clamp_int(action.get("init"), 0, -100, 200),
            "bonus": clamp_int(action.get("bonus"), 0, -30, 30),
            "hp": min(hp, max_hp),
            "maxHp": max_hp,
            "ac": clamp_int(ac, None, 0, 40) if isinstance(ac, int) and not isinstance(ac, bool) else None,
            "marks": [],
            "added": next_added(nxt["rows"]),
        })
        return bump_order(nxt)
    if op == "remove":
        if not dm:
            return fail_order("The DM removes a name.")
        nxt = clone_order(current)
        index = next((i for i, row in enumerate(nxt["rows"]) if row["id"] == action.get("id")), -1)
        if index < 0:
            return fail_order("That name is not in the order.")
        removed = nxt["rows"].pop(index)
        if not nxt["rows"]:
            nxt["started"] = False
            nxt["round"] = 1
            nxt["activeId"] = None
        elif nxt["activeId"] == removed["id"]:
            nxt["activeId"] = turn_rows(nxt)[0]["id"] if nxt["started"] else None
        return bump_order(nxt)
    if op == "next":
        if not dm:
            return fail_order("The DM advances the round.")
        if not current["rows"]:
            return fail_order("The order is empty.")
        nxt = clone_order(current)
        listing = turn_rows(nxt)
        if not nxt["started"]:
            nxt["started"] = True
            nxt["activeId"] = listing[0]["id"]
            nxt["round"] = max(1, nxt["round"])
            return bump_order(nxt)
        index = next((i for i, row in enumerate(listing) if row["id"] == nxt["activeId"]), -1)
        if index < 0 or index >= len(listing) - 1:
            nxt["activeId"] = listing[0]["id"]
            if index >= len(listing) - 1:
                nxt["round"] = min(999, nxt["round"] + 1)
        else:
            nxt["activeId"] = listing[index + 1]["id"]
        return bump_order(nxt)
    if op == "back":
        if not dm:
            return fail_order("The DM steps the round back.")
        nxt = clone_order(current)
        if not nxt["started"] or not nxt["rows"]:
            return bump_order(nxt)
        listing = turn_rows(nxt)
        index = next((i for i, row in enumerate(listing) if row["id"] == nxt["activeId"]), -1)
        if index <= 0:
            if nxt["round"] <= 1:
                nxt["round"] = 1
                nxt["activeId"] = listing[0]["id"]
            else:
                nxt["round"] -= 1
                nxt["activeId"] = listing[-1]["id"]
        else:
            nxt["activeId"] = listing[index - 1]["id"]
        return bump_order(nxt)
    if op == "initiative":
        if dm:
            return fail_order("Players roll their own initiative.")
        nxt = clone_order(current)
        row = next((item for item in nxt["rows"] if item["seat"] == name), None)
        if row is None:
            if len(nxt["rows"]) >= ROW_CAP:
                return fail_order("The order holds 24.")
            row = {
                "id": row_id(),
                "name": clean_label(action.get("label", "")) or name,
                "seat": name,
                "init": 0,
                "bonus": 0,
                "hp": 1,
                "maxHp": 1,
                "ac": None,
                "marks": clean_marks(action.get("marks")),
                "added": next_added(nxt["rows"]),
            }
            nxt["rows"].append(row)
        label = clean_label(action.get("label", ""))
        row["name"] = label or row["name"]
        row["init"] = clamp_int(action.get("init"), row["init"], -100, 200)
        row["bonus"] = clamp_int(action.get("bonus"), row["bonus"], -30, 30)
        if "maxHp" in action and action.get("maxHp") not in (None, ""):
            row["maxHp"] = clamp_int(action.get("maxHp"), row["maxHp"], 1, 999)
        if "hp" in action and action.get("hp") not in (None, ""):
            row["hp"] = clamp_int(action.get("hp"), row["hp"], 0, row["maxHp"])
        ac = action.get("ac")
        if isinstance(ac, int) and not isinstance(ac, bool):
            row["ac"] = clamp_int(ac, row["ac"], 0, 40)
        if "marks" in action:
            row["marks"] = clean_marks(action.get("marks"))
        if not nxt["started"]:
            nxt["activeId"] = None
        return bump_order(nxt)
    if op == "vitals":
        nxt = clone_order(current)
        row = None
        if dm:
            if isinstance(action.get("id"), str):
                row = next((item for item in nxt["rows"] if item["id"] == action.get("id")), None)
            seat = clean_label(action.get("seat", ""), 40)
            if row is None and seat:
                row = next((item for item in nxt["rows"] if item["seat"] == seat), None)
            if row is None and seat:
                if len(nxt["rows"]) >= ROW_CAP:
                    return fail_order("The order holds 24.")
                nxt["rows"].append(placeholder_row(action, seat, nxt["rows"]))
                return bump_order(nxt)
            if row is None:
                return fail_order("That name is not in the order.")
        else:
            row = next((item for item in nxt["rows"] if item["seat"] == name), None)
            if row is None:
                if len(nxt["rows"]) >= ROW_CAP:
                    return fail_order("The order holds 24.")
                nxt["rows"].append(placeholder_row(action, name, nxt["rows"]))
                return bump_order(nxt)
        write_vitals(row, action)
        return bump_order(nxt)
    if op == "step":
        delta = clamp_int(action.get("delta"), None, -999, 999)
        if delta is None:
            return fail_order("Hit points need a step.")
        nxt = clone_order(current)
        if dm:
            row = next((item for item in nxt["rows"] if item["id"] == action.get("id")), None)
            if row is None:
                return fail_order("That name is not in the order.")
        else:
            row = next((item for item in nxt["rows"] if item["seat"] == name), None)
            if row is None:
                return fail_order("Roll initiative, or the DM has not added you.")
            if action.get("id") and action.get("id") != row["id"]:
                return fail_order("That name is not yours.")
        row["hp"] = min(row["maxHp"], max(0, row["hp"] + delta))
        return bump_order(nxt)
    return fail_order("That is not an order action.")


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
