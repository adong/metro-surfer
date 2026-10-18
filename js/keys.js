/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: "Metro Surfer",
  keys: [
    ["switch lanes", "← → or A D"],
    ["jump", "↑ W or Space"],
    ["roll (in the air: slam down)", "↓ or S"],
    ["hoverboard", "B"],
    ["call your brother", "T"],
    ["Claude autopilot", "C"],
    ["pause", "P or Esc"],
    ["back to the menu (when paused)", "H"],
    ["sound on / off", "M"],
  ],
  touch: "Swipe left, right, up or down. Double-tap for the hoverboard, and tap your brother's face (bottom right) to call him.",
});
