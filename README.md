# Metro Surfer

A 3D endless runner in the spirit of Subway Surfers. It's built with Claude Code from plain JavaScript and Three.js.
There are no image, model, or audio files: every texture is painted on a canvas, every model is built from boxes, and every sound is synthesised.

## Play

- **Double-click `index.html`.** It works offline because Three.js is vendored in `vendor/`.
- **Send one file:** `dist/metro-surfer.html` is the whole game inlined, about 700 KB. AirDrop or email it, then open it in a browser.
- Rebuild that file after any edit: `python3 tools/bundle.py`
- Scores, the chosen runner, Tommy's card and Word Hunt progress are saved per browser *and* per way of opening the game, so `index.html` and `dist/metro-surfer.html` each keep their own.

| Keys | Touch | |
|---|---|---|
| ← → or A D | swipe left / right | switch lanes (on the title screen: pick a runner) |
| ↑ W Space | swipe up | jump (press just before landing to buffer it) |
| ↓ S | swipe down | roll; in mid-air it slams you down |
| B | double-tap or 🛹 button | hoverboard: survives one crash |
| C | 🤖 button | Claude autopilot on/off; any arrow takes the wheel back |
| T | Tommy button (bottom right) | call Tommy, any time and as often as you like |
| P / Esc | ❚❚ button | pause |
| M | 🔊 button | sound on/off |

## Runners, Tommy, the zombie and the Word Hunt

- **Pick your runner** on the title screen. TEDDY is modelled on the photo: black spiky hair, a big grin, a blue brick-wall tee and red sneakers. The others are ZOOM, LUNA, BOLT the robot and BRUNO the bear. Each runner keeps its own best score, so everyone in the family can have one.
- **ZOMBIE** (Tommy's idea): a cartoon zombie shambles right up to the screen with a groan and a "BOO!". You get this two ways: by picking the ZOMBIE runner (then you run as him, arms out), or by running into a 🧟 zombie card on the track. When you hit the card, the run freezes until the scare is over and then carries on with a moment of protection, so it can never cost you a run.
- **TOMMY** is a buddy, not a runner, and he's modelled on his photo: short black hair, a mint space tee with a UFO beaming up a dinosaur, cream joggers, and his favourite Y pose (both arms up, peace fingers). Tap his card on the title screen, his button during a run, or press T, and he runs in doing the Y pose. He follows your runner for about 10 s, copying their jumps and rolls, and hands over a treat (🍦 💧 🧃 🍪 🍉 🍌) that your runner carries. Then he poses again and drops back. Tap again while he's there and he poses and hands over another treat; tap after he's gone and he comes right back.
  **Tommy has your back:** while he's running with you (until he starts dropping back, about 9.6 s; his orange bar shows the time left), crashing into a train or barrier doesn't end the run. The obstacle bursts, "TOMMY SAVED YOU!" pops up and he does a Y pose. Side bumps don't bring the inspector, and your hoverboard isn't used up. Calling him again keeps the protection going.
- **Word Hunt:** letter tiles for the current word appear on the track, one at a time and in order. Spell the word for 100 coins plus its reward. TEDDY gives a hoverboard, TOMMY makes Tommy come running, METRO gives 2× score, SURF super sneakers, ZOMBIE a magnet and CLAUDE a jetpack. Progress carries over between runs.
- **Make it yours:** `js/avatars.js` holds the runners, Tommy's look and the word list. Copy an entry to add a player (say, Dad) or a word; every field is a colour or a style name.

## What's in it

- **Obstacles:** 3 lanes, with trains parked or rolling toward you. A rolling train has its headlights on and sounds its horn when it starts moving. There are also ramps up onto train roofs, barriers you jump, and barriers you roll under.
- **Hits:** clipping the side of a train is a stumble, and the inspector and his dog close in. Stumble twice and you're busted.
- **Power-ups:** 🧲 coin magnet, 🚀 jetpack (with a coin trail in the sky), 👟 super sneakers (high enough to jump onto trains), 2× score, and 🛹 extra hoverboards.
- **Speed and scenery:** a kid-friendly pace that eases from 15 m/s toward 28. Graffiti walls (look for TEDDY), rooftop billboards, water towers, and a synthesised Am–F–C–G soundtrack.
- **Saving:** your best score is saved in the browser. Runs where the autopilot drove don't count toward it.
- **Speed:** every run starts at 15 m/s and speeds up gently on its own: about 20 after a minute, 23 after two, never past 28. To change it, edit `START_SPEED`, `TOP_SPEED` and `RAMP_TIME` at the top of `js/game.js`. The Space bar only jumps: holding it gives one jump and doesn't change your speed.

## The autopilot (and how the level generator is tested)

Ten times a second, the autopilot simulates 75 possible futures about 1.2 s ahead. Each future is a move now, plus maybe a second move a moment later. They use the same physics function as the player, and it makes the first move of the best one. The title screen uses it to play in the background.

Every row of obstacles has a guaranteed **safe lane** that moves at most one lane per row. Rolling trains are never placed where they could sweep into it. You can check that the generator is fair from the browser console:

```js
metro.soak(300)                 // 5 min of autopilot play, headless; logs every crash and stumble
metro.soak(60, { auto: false }) // nobody steering: proves the test can actually fail
```

At the last check (kid-friendly speeds), 6 × 5-minute runs gave 0 crashes and 0 stumbles. With the autopilot off, the same test logged 13 crashes in its first minute.

## Files

```
index.html        page, HUD and screens (CSS inline)
js/avatars.js     runners, Tommy and the Word Hunt words: edit this to add players or words
js/art.js         canvas textures + models from primitives
js/audio.js       Web Audio sound effects and music
js/game.js        physics, level generator, autopilot, input, main loop
vendor/three.min.js   Three.js r149 (MIT, see three.LICENSE)
tools/bundle.py   builds dist/metro-surfer.html
```
