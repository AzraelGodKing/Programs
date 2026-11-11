# Grocery List

A personal Android app: paste a recipe, get an interactive grocery list.

## What it does

- **Add recipe**: paste a whole recipe (or just its ingredients), or share text into the app from a browser or notes app. It finds the "Ingredients" section, parses each line into amount, unit and item, and sorts items into store sections. Untick anything you already have, then add the rest.
- **Interactive list**: tap to check off (checked items drop to "In cart"), the pencil to edit, swipe left to delete (with Undo), + to add an item by hand. The menu can remove checked items, uncheck everything, or clear the list.
- **Merging**: adding the same ingredient again combines amounts when the units allow it: 1 cup + 4 tbsp milk becomes 1 1/4 cups, 2 tsp + 1 tsp becomes 1 tbsp. Different kinds of units (2 cans vs 1 lb) stay as separate lines.
- **Cabinet**: the kitchen icon opens a list of what you already have at home. Add staples by hand, or after shopping use the list's menu → Put checked items in Cabinet. When you add a recipe, ingredients already in the Cabinet start unticked and say "In your Cabinet" (a Cabinet "salt" also covers "kosher salt"); tick one if you need more anyway. Ran out of something? Tap the cart icon next to it in the Cabinet to move it back onto the grocery list. Swipe left to remove (with Undo).
- **Updates**: on launch the app checks this repo's releases for a newer Grocery List build and offers to download it. Menu → Check for updates does the same on demand. The first time, Android asks you to allow Grocery List to install apps.
- **Claude (optional, off by default)**: Menu → AI settings turns it on. Connect with either the **Claude app**, which uses your Pro/Max plan by opening requests in the official Claude app (you share Claude's reply back to Grocery List; Anthropic doesn't allow third-party apps to sign in with a subscription), or an **API key** from console.anthropic.com, billed to you, which does everything in-app. Then Menu → Ask Claude for a recipe writes a DASH-diet recipe from a request, or reads a pasted recipe or a link, keeps it as written, and suggests DASH swaps. You tick the ingredients to add, and can share the recipe to a notes app. Add recipe also gets a Read with Claude button. Pick Opus (best), Sonnet, or Haiku (cheapest) in settings. In the Cabinet, the camera button scans a photo: Claude lists the groceries it sees and you review them before they're added.
- **Gemini Nano (optional, free)**: in AI settings, Connect with → Gemini Nano on this phone uses Google's on-device model through Android AICore instead of Claude. It works on supported phones only (Galaxy S25/S26 series, Pixel 9 and later, among others; see [Google's device list](https://developers.google.com/ml-kit/genai)), needs a one-time model download the first time, runs offline, costs nothing and sends nothing off the phone. It's much smaller than Claude: it can't open links, its context is about 4,000 tokens, and its recipes and photo lists need more checking. Android only lets it run while the app is on screen, with a per-app daily limit.
- Your list and Cabinet are stored on the phone (Room/SQLite), with no account. Network use is the update check and, only if you turn it on, the Claude API. The API key is kept in the app's private storage and excluded from Android backups.

## Installing on your phone

Every push to `main` builds an APK in GitHub Actions and publishes it as a release.

1. On the phone, open this repo's **Releases** page, find the newest **Grocery List build N**, and download its `grocery-list-N.apk`.
2. Open it. The first time, Android asks you to allow installs from your browser; allow it.
3. Later builds install over the old one and keep your list. From build 3 on, the app finds and installs them itself.

The APK is signed with `app/signing/debug.keystore`, which is checked in on purpose so every build can update the previous one. Since this repo is public, only install APKs from this repo's own releases.

## Building locally

Needs JDK 17 and the Android SDK (Android Studio installs both). Run from this folder:

```
cd grocery-list
./gradlew testDebugUnitTest assembleDebug
```

The APK lands in `app/build/outputs/apk/debug/`.

## Code map

- `parse/`: plain Kotlin, no Android: `IngredientParser`, units and conversions, merge rules, store-section rules, Cabinet matching. Unit tests in `app/src/test`.
- `data/`: Room entities (list items and Cabinet items), DAOs and the repository that merges new items into the list. Schema changes need a Room migration in `GroceryDatabase` so updates keep your data.
- `ui/`: Jetpack Compose screens.
- `claude/`: the optional AI features. `GeminiNano` wraps ML Kit's GenAI Prompt API for the on-device mode, with its prompts in plain-Kotlin `NanoPrompts`. `ClaudeRecipeClient` (Anthropic Java SDK, DASH system prompt, JSON schema for structured output, web fetch for links) and `ClaudeRecipe` are plain Kotlin with unit tests; settings and screens are the Android side.
