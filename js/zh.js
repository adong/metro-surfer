/* 中文 for Metro Surfer: the words on the page, the toasts and the ? panel (Kit.lang, from kit/lang.js).
   The kids' names, the logo and the street art (graffiti, billboards, Word Hunt letters) stay in English on purpose:
   Word Hunt is a spelling game, and the walls are a real-looking subway. */
(function () {
  const L = Kit.lang;
  L.keep(['METRO', 'SURFER', 'Metro Surfer', 'TEDDY', 'TOMMY', 'Teddy', 'Tommy', 'ZOOM', 'LUNA', 'BOLT', 'BRUNO', 'Claude Code']);

  L.add({
    // title screen
    'Dodge the trains. Grab the coins. Outrun the inspector.': '躲开火车，收集金币，甩掉检票员！',
    'PICK YOUR RUNNER': '选择你的跑手', 'Pick your runner': '选择你的跑手', 'ZOMBIE': '僵尸',
    'pick runner / switch lanes': '选跑手 / 换跑道', 'roll': '翻滚', 'hoverboard': '悬浮滑板',
    'Claude autopilot': 'Claude 自动驾驶', 'call': '叫', 'WORD HUNT': '单词寻宝', 'Word Hunt': '单词寻宝',
    'Swipe ← → ↑ ↓ to move · double-tap for the hoverboard': '滑动 ← → ↑ ↓ 移动 · 连点两下用悬浮滑板',
    "'S BEST": ' 的最高分',
    // buttons (their tooltips)
    'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)', 'Claude autopilot (C)': 'Claude 自动驾驶 (C)',
    'Hoverboard (B / double-tap)': '悬浮滑板 (B / 连点两下)', 'Call Tommy (T)': '叫 Tommy (T)', 'Call Teddy (T)': '叫 Teddy (T)',
    'Tommy is guarding you': 'Tommy 在保护你', 'Teddy is guarding you': 'Teddy 在保护你',
    '🤖 Claude is driving — press an arrow to take over': '🤖 Claude 在驾驶，按方向键接手',
    // pause and game over
    '🏠 MENU': '🏠 菜单', 'P · Esc · Space to resume · H for the menu': 'P · Esc · 空格 继续 · H 回菜单',
    'BUSTED!': '被抓住啦！', 'COINS': '金币', '★ NEW BEST! ★': '★ 新纪录！★', '↻ RUN AGAIN': '↻ 再跑一次',
    "🤖 Autopilot helped this run, so it doesn't count toward BEST": '🤖 这局有自动驾驶帮忙，不算最高分',
    'Space · Enter · Tap to run again · H for the menu': '空格 · 回车 · 点一下 再跑一次 · H 回菜单',
    // toasts while running
    'HOVERBOARD!': '悬浮滑板！', 'WATCH OUT!': '小心！', 'BOARD SAVED YOU!': '滑板救了你！', 'TRAIN SURFER!': '火车冲浪手！',
    'COIN MAGNET!': '金币磁铁！', 'JETPACK!': '喷气背包！', 'SUPER SNEAKERS!': '超级跑鞋！', '2× SCORE!': '得分 2 倍！',
    '+1 HOVERBOARD': '+1 悬浮滑板', 'ZOMBIE!': '僵尸来啦！', 'BOO!': '哇呜！', 'SWISH!': '唰！进球！',
    'CLAUDE IS DRIVING': 'Claude 在驾驶', 'YOUR CONTROL': '换你来跑', 'YOUR BUDDY JOINS YOU!': '兄弟来陪你跑啦！',
    '+100 MORE COINS': '再加 100 金币', 'LOADING…': '加载中…',
    'This browser can’t run WebGL, so Metro Surfer can’t start.': '这个浏览器跑不了 WebGL，Metro Surfer 开不了。',
    // the ? panel (js/keys.js)
    'switch lanes': '换跑道', 'roll (in the air: slam down)': '翻滚（空中按：快速落地）',
    'back to the menu (when paused)': '回菜单（暂停时）',
    "Swipe left, right, up or down. Double-tap for the hoverboard, and tap your brother's face (bottom right) to call him.":
      '上下左右滑动。连点两下用悬浮滑板，点右下角兄弟的头像叫他来。',
  });

  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', 'JUICE BOX': '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  L.rule(/^(.+)'S BEST$/, '$1 的最高分');
  L.rule(/^GO (.+)!$/, '$1 加油！');
  L.rule(/^(.+) SAVED YOU!$/, '$1 救了你！');
  L.rule(/^(.+)'S HERE!$/, '$1 来啦！');
  L.rule(/^(.+) JOINS YOU!$/, '$1 来陪你跑啦！');
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE BOX|COOKIE|WATERMELON|BANANA) FROM (.+)!$/, (m, emoji, item, who) => `${emoji} ${who} 送来的${TREAT[item]}！`);
  L.rule(/^\+100 COINS · (.*)$/, (m, rest) => `+100 金币 · ${L.t(rest)}`);
})();
