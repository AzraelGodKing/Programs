# Lantern

A table companion for the part of a 5e night that is not a character sheet.

Character sheets already have apps. What goes missing at the table is the rest of the hour: the die in the middle, whose turn it is, whether the torch is still burning, whether this fight is a speed bump or a grave, and something to say when the room goes quiet. Lantern is that page. Closing the tab leaves the night in this browser. Join a table code and the DM screen watches the same night as it happens.

## Run it

From the repository root:

```bash
npm test
npm start
```

Open http://localhost:5173

The DM screen is http://localhost:5173/dm.html. Open a table, share the four-character code, and each player joins with their name. The code is the only key. Anyone who has it can post, and the DM sees every seat: the character, rolls and what they were for, the order, hit points, lights, the encounter budget, prompts, and scratch notes. Solo play still works with the name and code left blank. The shared table lives in the memory of that server, so restarting it starts a new night.

## What is on the table

- **Dice.** The usual set, with advantage and disadvantage on the d20. Say what the roll is for. A natural 20 or 1 is marked from the die that counts. The last dozen rolls stay visible.
- **Order.** Initiative, hit points, armor class, and the conditions you actually track, plus concentration. Ties keep the earlier name. The highlighted name goes first, and Start begins the round there.
- **Light.** Candle, torch, oil lamp, hooded lantern, and bullseye lantern, timed from the moment you strike them. Lowering the hood does not save the oil.
- **Threat.** The 2014 encounter budget: party thresholds, creature experience, and the multiplier for how many creatures are in the fight. A party smaller than three steps the multiplier up. A party of six or more steps it down. It is a pacing guide, not a promise.
- **Spark.** Original people, places, twists, rumors, and trinkets. They are not from a published adventure or table.
- **Character.** One hero from the common 2014 races, classes, subclasses, and backgrounds. Custom is there for a people, a class, or a subclass the list does not have. Scores can be the standard array, point buy, four d6s dropping the lowest, or typed in.
- **Scratch.** A note that stays with the rest of the night.

Keys 1–5 switch tools while you are not typing. R rolls. N advances the round.

Clearing the browser wipes the fight, the party, the flames, the prompts, the character, and the notes stored here.
