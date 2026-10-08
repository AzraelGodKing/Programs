# Lantern

A table companion for the part of a 5e night that is not a character sheet. Open it and choose the player seat or the Dungeon Master screen.

Character sheets already have apps. What goes missing at the table is the rest of the hour: the die in the middle, whose turn it is, whether the torch is still burning, whether this fight is a speed bump or a grave, and something to say when the room goes quiet. Lantern is that page. Closing the tab leaves the night in this browser. Save a copy downloads that whole night, character included, and Restore puts the file back. Clearing this browser, or the browser's stored data for Lantern, deletes the copy that lives here. The downloaded file stays where you put it. Join a table code and the DM screen watches the same night as it happens.

## Run it

From the repository root:

```bash
npm test
npm start
```

Open http://localhost:5173 and choose a side.

The player seat is http://localhost:5173/player.html. The DM screen is http://localhost:5173/dm.html. Open a table, share the four-character code, and each player joins with their name. The code is the only key. Anyone who has it can post, and the DM sees every seat: the character and what they carry, rolls and what they were for, the order, hit points, lights, and scratch notes. The party sits in a row, with passive Perception and Insight, armor class, conditions, and the light closest to going out. The newest call stays on screen, and the log can be narrowed to rolls. Notes typed on the DM screen stay in that browser. Prompts and the encounter budget are drawn on the DM screen, and the budget can use the levels of the heroes who sat down. Solo play still works with the name and code left blank. The shared table lives in the memory of that server, so restarting it starts a new night.

A merge to main runs the Buildkite pipeline `lantern`. That pipeline tests this repository, then deploys the Worker and these pages to https://lantern.azraelsmods.com. The deploy agent needs `CLOUDFLARE_API_TOKEN`.

## What is on the table

- **Dice.** The usual set, with advantage and disadvantage on the d20. Say what the roll is for. A natural 20 or 1 is marked from the die that counts. The last dozen rolls stay visible.
- **Order.** Initiative, hit points, armor class, and the conditions you actually track, plus concentration. Ties keep the earlier name. The highlighted name goes first, and Start begins the round there.
- **Light.** Candle, torch, oil lamp, hooded lantern, and bullseye lantern, timed from the moment you strike them. Lowering the hood does not save the oil.
- **Pack.** The sheet is finished before anyone sits down, in six steps: name, people, class, scores, story, then sit down. At the table it is a row of skills and carried items. Tap a skill to roll it. Tap an item to use it. The class starting gear and purse are packed once, when the character sits down. The purse spends platinum, gold, electrum, silver, and copper at the usual rates: 1 pp is 10 gp, and 1 ep is 5 sp. After that, a line on the counter costs the price on the sign. The DM chooses the stall: a market, an apothecary, a smith, a scribe, a tavern, or a stable. The base list on that screen is the 2014 equipment, and a line from it can be added to the counter. A line can come off that counter, and the price can change, before the shop opens. The shop switches between Buy and Sell, and the coin purse shows each coin. Opening it buys missing arrows or bolts for a ranged weapon in the pack, and a component pouch for a spellcaster who has no focus, when this counter sells them. The same counter buys those goods back at half the price on the sign. The seller can buy that piece back for the same coin until the DM closes the shop. Closing the player’s own popup leaves the sale on the counter. A service, such as a room or a +1, is not sold back.
- **Notes.** Drafts stay in this browser. The DM does not see them. Scratch is the one line the DM can read.
- **Table.** Say it to everyone, or whisper one person. A whisper shows for those two seats. The DM can whisper a player back. The table code is still the only key. The tab shows who is at the table and who has gone quiet.
- **Asked rolls.** The DM can ask one seat, or the whole table, for a roll by name: a skill, an ability check or save, or initiative. The player's screen offers Roll it, which rolls with their own bonus and shares the result.
- **Threat, on the DM screen.** The 2014 encounter budget: party thresholds, creature experience, and the multiplier for how many creatures are in the fight. A party smaller than three steps the multiplier up. A party of six or more steps it down. It is a pacing guide, not a promise.
- **Spark, on the DM screen.** Original people, places, twists, rumors, and trinkets. They are not from a published adventure or table.
- **Character.** One hero from the common 2014 races, classes, subclasses, and backgrounds, made before the table. Custom is there for a people, a class, or a subclass the list does not have. Scores can be the standard array, point buy, four d6s dropping the lowest, or typed in. Joining a table with no character starts a sheet. Later joins load a living character, create another, view and export one who died, or import a character file exported from another browser.
- **Scratch.** A note that stays with the rest of the night.

Keys 1–5 switch dice, order, the pack, notes, and the table while you are not typing. R rolls. N advances the round. Press ? on either screen for the list. Text size is a switch in the header and stays with this browser.

On a phone, Lantern can be added to the home screen. The pages open offline for solo play. The shared table needs the network.

This browser holds the game. Save a copy keeps a file of the fight, the party, the flames, the prompts, the character, and the notes. Clearing this browser deletes the copy stored here.
