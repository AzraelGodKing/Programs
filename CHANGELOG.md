# Changelog

## Unreleased

### Added

- Grocery List reminds you before Cabinet food goes bad. Tap a Cabinet item to give it an expiry date with a quick pick (3 days to 1 month) or the calendar. Anything expired or expiring within two days moves to a Use soon section, and a morning notification lists those items and opens the Cabinet when tapped. Updating keeps your Cabinet; existing items start without a date.
- Grocery List can use Gemini Nano, the free AI built into newer Android phones such as the Galaxy S26 Ultra. AI settings → Connect with → Gemini Nano on this phone runs recipe requests, pasted recipes and Cabinet photo scans on the phone itself, offline and at no cost, after a one-time model download. It's less capable than Claude and can't open links, so the Claude options stay available. Claude settings is now called AI settings.
- Grocery List can scan your Cabinet. In the Cabinet, the camera button takes or picks a photo of a shelf or the fridge, Claude lists the groceries it sees, and you untick anything wrong before the rest goes in. Items already in the Cabinet start unticked.
- Grocery List can use the Claude plan you already pay for. Claude settings → Connect with → Claude app opens requests and photos in the official Claude app with a ready-made prompt, and sharing Claude's reply back lands it in Add recipe or the Cabinet review. Anthropic doesn't allow other apps to sign in with a Claude subscription, so this hands off instead. The API key option still works for everything in one tap.
- Grocery List can use Claude, off until you turn it on in Menu → Claude settings with your own Anthropic API key, which stays on the phone and out of backups. Ask Claude writes a DASH-diet recipe from a request like "quick chicken dinner for 2", or reads a pasted recipe or a link and suggests DASH swaps, then adds the ingredients you tick to the list. Add recipe gains Read with Claude for recipes the built-in parser struggles with. You can pick Opus, Sonnet or Haiku, and share the recipe to a notes app.
- Grocery List has a Cabinet for what's already at home. Add staples by hand or move checked items there after shopping; when you add a recipe, anything in the Cabinet starts unticked, and an item you ran out of goes back on the list with one tap. Updating keeps your existing list.
- Grocery List updates itself. When it opens it checks the repo's releases for a newer build and offers to download it, showing progress, then hands it to Android's installer. Menu → Check for updates runs the same check on demand and shows the installed build.
- Grocery List, a new Android app in `grocery-list/`. Paste a recipe or share it from the browser, untick what you already have, and the ingredients land on a list grouped by store section. Check items off, edit them, or swipe to delete with Undo. Adding the same ingredient again combines the amounts, so 1 cup and 4 tbsp of milk becomes 1 1/4 cups. Each build on main is published as a release with an installable APK.

### Changed

- Grocery List release builds are numbered without gaps from now on. Pull requests are checked by a separate workflow, so they no longer use up build numbers.

- `npm start` runs the local table server with Node. Room POST routes, in-memory table storage, and the offline cache write each have one code path.
- The player Order tab is Roll for initiative. The button rolls a d20 plus the Dexterity modifier from the sheet and adds that character to the shared order. Rolling again updates the same seat. The Dungeon Master still moves the round.
- The Python copy of the table rules is gone. Join, whisper, and shop are checked against the JavaScript room module.
- Initiative sorting uses one `sortOrder` helper on the player seat and the DM screen.

### Removed

- Unused `armorLabel` and `cleanViewer`.

### Added

- A battle map in a Map module on the DM screen: a grid with an optional picture, tokens for the party and the creatures in the order, and fog the DM paints on and off. Players open it from their seat and move only their own token. Hidden tokens and creatures in fog are not sent to players.
- A spectator link in the Table module: a read-only page with the order, the map, table talk, public rolls, and quests. The DM can turn the link off.
- Post the recap to Discord, in the Table module: a recap and the next session go to a channel through a webhook address kept in the DM's browser.
- Running the table, in a Table module on the DM screen. A spotlight lists who has said and done least in the last six hours. Start the session posts a recap, calls a ready check, and lists the open quests. Pause dims every seat with a short message. A mood such as Storm or Tavern shows on every seat. Table talk can be slowed or paused, and players can still whisper the DM. Seats can be renamed or removed, and Move to a new device gives a player a link that sits them back in their own seat. House rules and lines and veils show in every Party module. The X-card history lists when it was tapped, for the DM only, and never who. The next session shows on every seat, can take the poll's leading choice, and players can add it to their calendar.
- Prep. Ready encounters such as "3 Wolf, 1 Dire wolf" drop into the order in one tap. The Story notebook and the Threat and Spark prep save to one file and open again in another browser. The session log downloads as Markdown with who was there, loot and experience, quests, the talk, and the rolls, leaving out secret rolls and whispers. Layout buttons under the module bar open a module and set the feed in one tap: Combat, Roleplay, Shopping, or your own.
- Seeing the party on the DM screen. Seat cards show a health bar that turns at bloodied, temporary hit points, inspiration, spell slots and class resources, and a warning when someone is encumbered. A Packs module lists everyone's gear and attunement, finds who carries something, and shows each player's scratch notes beside the party notes. The feed has a Secret filter for secret rolls.
- Rewards on the DM screen. Loot goes into the party stash or one player's pack, with coin. A magic item can arrive unidentified under a plain name and be identified later, so the player's pack shows the real name and what it does. Inspiration, experience, and milestones are handed out with a reason in the feed, and the seat prompts a level up when it has the experience. Haggling sets a discount or markup for one player at the shop. A treasure hoard rolls from Lantern's own tables by challenge rating and can go straight into the stash.
- Story on the DM screen, kept in the DM's browser between sessions. Handouts with words and a picture go to one player or the table and open on their seat. Read-aloud boxes are written ahead and read to the table with one tap, set apart in the chat. NPC cards keep a voice and secrets, and show the table only what they can see. Quests and glossary entries can be hidden until revealed. A session plan ticks off scenes, marks where you stopped, and can warn the table about a scene's content. A random encounter table rolls by weight and sends the result to the order or Threat. The day, hour, and weather show on every seat and move with rests and travel.
- DM combat in the Order module. Quick add seats a monster from your Library or a short SRD list with its attacks, and a group can share one initiative roll. A row can be hidden from the players until you reveal it. Attack buttons roll to hit and damage privately into Your rolls, with a crit doubling the dice. Damage several rows applies one effect to the picked rows, each rolling its own save for half or none. Conditions can last a number of rounds and clear themselves. A concentrating monster rolls its Constitution save when hit. Legendary actions and the lair get reminders at the right point in the round. Delay moves a row behind the next one. A turn timer shows on the DM screen and every seat.
- Calling rolls. An ask can carry a DC, shown to the players or kept on the DM screen, and answers come back as a card with pass or fail and a group result. Against rolls a creature's side for a contested roll. Asks can be saved as presets. Roll for them rolls a player's ask from their sheet when they are away, and the feed says the DM rolled it. Passive checks lists each hero's passive Perception, Investigation, and Insight against a DC.
- Read a PDF into Lantern's own format. On the DM screen, a Library module reads stat blocks, spells, and magic items from a PDF, shows what it found to check and fix, and keeps them in this browser with search and export. A monster goes into Threat or rolls into the order, and an item goes into the party stash. A character sheet PDF becomes a Lantern character file to hand to a player. On the player seat, Import reads a character sheet PDF, from a fillable sheet's fields or from printed text, and opens the steps to check it before you sit down. The pack has a spellbook that reads spells from a PDF or a Lantern file, with Prepare for tonight, and magic items can be read the same way. PDFs are read in the browser with a bundled copy of pdf.js and are never uploaded. A scanned PDF with no text says so.
- Your turn at a shared table. A strip under the tabs says whose turn it is and when you are up next, the order marks the next row, and your turn can ping with a tone, a buzz, and a flashing tab title. A turn helper ticks off action, bonus action, movement, and an object, keeps your reaction for the round, and has End turn, which the room accepts only from the seat whose turn it is. E ends your turn.
- Table talk can be in character, as the character's name and portrait, or out of character. /me writes an action. @name pings that player, [[Name]] links the glossary, and the table shows who is typing. Messages take reactions and pins. The Table module lists the table's rolls in each player's feed color, and a session recap gathers the talk and rolls of the last hours with a copy button.
- A Party module shared by the table: party notes, quests, a glossary, a stash for items and a coin pot with an even split, the Help action that gives an ally advantage on their next d20, a poll for the next session, and a ready check.
- An X-card in the header. It pauses the scene for everyone, the DM screen included, and does not record who tapped it.
- The seat chips say here, away, or disconnected. A Display section under Keys has high contrast and reduced motion. Turn changes and table talk are announced to screen readers, and phone buttons are at least 44 pixels tall.
- Saved rolls on the dice panel. Name an attack with its to hit and damage, and it is one tap. A natural 20 offers the damage with the dice doubled. A saved roll can count ammunition.
- A secret roll is shared with the DM and nobody else at the table. The DM feed marks it.
- Inspiration can be spent on the last roll to roll it again.
- The roll history keeps fifty rolls and can show only attacks, damage, checks, saves, or secret rolls. A roll can name its target from the order.
- The pack has checks and saves for every ability, damage, healing, and temporary hit points, a long rest, and your own conditions, which the DM sees on the order. Taking damage while concentrating sets up the Constitution save with its DC.
- Spell slots as pips, filled from the class tables or set by hand. Class resources such as Rage, Ki, and Channel Divinity, with short and long rest resets.
- A portrait and a feed color for the character. The pack shows carried weight against Strength. Arrows and bolts can be counted shot by shot. A potion of healing rolls its healing when you drink it. Magic items can be added, with three attunement slots. Level up walks through the steps for the new level.
- A QR code beside the table code opens the player seat with the room filled in. The DM secret stays on the DM screen.
- Each character step shows what the choice gives before you move on: ancestry traits and darkvision, class features, the one subclass in this subset, hit points, and proficiencies. Ability modifiers stay visible as the scores change. A starting kit is chosen on Sit down, and Sit down is what saves.
- One initiative list for the table. The DM seats the party and moves the round. Players see the same list. At 0 hit points the row has three success pips, three failure pips, and Stable on the third success. Exhaustion is a count from 0 to 6.
- A seat token for each player, and a DM secret that is not the code read aloud. Whispers, shop changes, and asked rolls are accepted only from the token that owns the seat.
- The scene froze pauses every flame, including while the page is hidden, and gives that time back when the scene moves. Darkvision is on the sheet and on the flame line.
- Play alone opens the character steps in this browser. A blank code does the same. Join still wants a four-character code.
- A skill tap fills the die and waits for Roll. Armor class comes from the armor and shield in the pack, with a typed override. Tonight’s spells, a breath weapon, inspiration, and a short rest live on the pack. Revise reopens the six steps without replacing the gear.
- The class kit step offers the usual gear choices. The people and class steps call the lists an SRD subset.
- Missing arrows, bolts, or a component pouch are a question on the shop. The purse changes only after a tap.
- Sparks, party levels, and creature groups are stored with the notes for that table code.
- The front door says what the player seat and the DM screen are for. Save a copy stays in the header. The deletion sentence is on Clear. The first time a character sits down, Lantern offers Save a copy once. Next to the table code, a week of silence clears the shared table.
- Shop, Spark, Threat, and Notes on the DM screen open as modules. On the player seat, Order, Pack, Notes, and Table open over the dice. Closing a module leaves the table where it was.
- The shop switches between Buy and Sell. The coin purse shows platinum, gold, electrum, silver, and copper.
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

### Removed

- Unused player leftovers from when Spark and Threat moved to the DM screen: the encounter and spark renderers, no-op handlers, and CSS for those tabs. Old saves still load. The leftover prepare-drawer save field is gone; `#dm-prepare` has been missing since that drawer became a module.
- Unused CSS leftovers: `.save-explain`, `.kicker`, `.bands`, leftover `[data-rating]` colors on the old player verdict, the `#panel-character > :not(#kit)` hide from when the pack lived in that panel, `.inline`, `.hp-line`, `.rest-actions`, `.death-line`, `.mark-picks`, `button.mark-chip` / `.mark-chip.is-on`, `.tab-badge`, `.roll-strip`, `.table-order`, and `.seat-card .hp-line`. Room helpers that nothing imports are no longer exported. Unused `playingAlone()` is gone.

### Fixed

- The player page no longer jumps while it loads. The seat line and the dice formula start with their text, and a browser that already has a seat folds the join form before the first paint.

- Dice buttons render their labels. Rolls and the encounter verdict no longer print an empty "null". A combatant at 0 hit points is marked Down, and adding a creature brings the verdict into view.
