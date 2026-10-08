# Changelog

## Unreleased

### Added

- Shop, Spark, Threat, and Notes on the DM screen open as modules. On the player seat, Order, Pack, Notes, and Table open over the dice. Closing a module leaves the table where it was.
- The shop switches between Buy and Sell. The coin purse shows platinum, gold, electrum, silver, and copper. Opening it buys missing ammunition for a bow or crossbow in the pack, and a component pouch for a spellcaster who has no focus, when this counter sells them.
- The DM shop has the 2014 equipment list: weapons, armor, gear, tools, mounts, trade goods, and food and lodging. A stall still opens a short counter. Add from the base list when this shop sells something else.
- The purse converts platinum, gold, electrum, silver, and copper. 1 pp is 10 gp, and 1 ep is 5 sp. A price can be written in any of those coins.
- Once a player joins, the seat folds into one line, and Clear this browser sits with Save and Restore. The light picker opens on demand. On a phone, the dice and Roll stay pinned to the bottom of the screen.
- The DM screen puts the latest call, the party, and the roll feed first. Table talk moves to the side, the shop folds into its own section, and the code shrinks to a line once someone sits down.
- A Keys list on both screens, a text size switch, brighter faint text, and named page regions for screen readers.
- The DM can ask a seat, or the whole table, for a roll. The player's Table tab shows who is here.
- Lantern can be added to a phone's home screen and opens offline for solo play.
- One character can be imported from a file at the character step.
- Lantern publishes from Buildkite. A merge to main tests the table, then deploys the Worker and these pages to lantern.azraelsmods.com.
- The DM opens a stall, not one general counter. An apothecary sells vials, a smith sells arms and a +1, a scribe sells spellbooks, and a tavern takes a tab or a room for the night. Lines can come off the counter, and the price can change.
- A stall buys back the goods it sells, at half the price on the sign. An apothecary will not buy a sword. A service, such as a room or a +1, is not sold back.
- The shop no longer gives away a starter pack. The class kit is packed once, when the character sits down. After that, a line costs the price on the sign. A price of 0 is the DM's choice.
- A player can buy a sale back for the same coin until the DM closes the shop. Closing the player popup leaves that sale on the counter.
- Lantern tests run on GitHub when the lantern files change.
- The DM screen leads with the party. Each seat shows hit points, armor class, conditions, passive Perception and Insight, and the light closest to going out. The latest roll stays pinned above the table, the log can show only rolls, and notes typed here never reach the players. The encounter budget can take its levels from the seated heroes.
- The player seat no longer builds prompts or encounters. Spark and the encounter budget live on the Dungeon Master screen.
- At the table the sheet is a pack. Skills and carried items are buttons. The class starting gear is packed when the character sits down, and the shop takes the price out of the purse. The DM screen has a switch that closes that popup, and opens it again.
- A character is made in six steps: name, people, class, scores, story, then sit down.
- Players keep private drafts on the Notes tab. Scratch is still the line the DM can read.
- The table can talk. A message to everyone is heard by the whole table. A whisper is heard by the two people in it, and the DM can whisper a player back.
- A front door. Opening Lantern asks you to choose the player seat or the Dungeon Master screen, and the two sides no longer share one page. A link with a table code still opens the player seat.
- A save file for the night. Save a copy downloads the character and the rest of the table, and Restore puts that file back into this browser. The browser still holds the live game, and clearing that stored data deletes it.
- Characters belong to a table. The first join creates one. Later joins can load a living character, create another, or view and export a character who died.
- Lantern, a browser table companion for 5e nights: dice, initiative, light sources, a 2014 encounter budget, and original improvisation prompts. The night stays in this browser.
- A DM screen. Players join a table code, and the DM sees every roll (who, and what it was for), the order, hit points, lights, the encounter budget, prompts, and scratch notes.
- A character sheet. The common 2014 races, classes, subclasses, and backgrounds are listed, and Custom is there for anything else. Ability scores can be the standard array, point buy, 4d6, or typed in. The DM sees the sheet.

### Fixed

- Dice buttons render their labels. Rolls and the encounter verdict no longer print an empty "null". A combatant at 0 hit points is marked Down, and adding a creature brings the verdict into view.
