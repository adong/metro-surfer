/* Metro Surfer — procedural art for the world: track, buildings, trains, barriers, pickups and the dog.
   Characters, shared canvas helpers and sound come from the Claude Games kit (kit/). Every texture is painted
   on a canvas and every model is built from primitives, so the game ships with no image or model files. */
(function () {
  'use strict';
  const T = THREE;
  const { FONT, EMOJI_FONT, rand, randi, pick, makeCanvas, toTexture, shade, roundRect, std, mesh, boxUV } = Kit.gfx;

  // World dimensions shared with game.js (units are roughly metres).
  const dims = {
    LANE_W: 2.6,
    CAR_LEN: 10,
    TRAIN_TOP: 3.4,
    TRAIN_BOTTOM: 0.5,
    RAMP_LEN: 7,
    LOW_H: 1.1,
    HIGH_BOTTOM: 1.6,
    HIGH_TOP: 3.0,
    SEG_LEN: 60,
  };
  const { LANE_W, CAR_LEN, TRAIN_TOP, TRAIN_BOTTOM, RAMP_LEN, LOW_H, HIGH_BOTTOM, HIGH_TOP, SEG_LEN } = dims;

  // Sky colours are written straight to the screen (sRGB); FOG must match HORIZON.
  const SKY = { top: '#2a7bd6', mid: '#86c5f4', horizon: '#d6eafc' };
  // ---------------------------------------------------------------- textures

  function trackTexture() {
    const [c, g] = makeCanvas(256, 512);
    g.fillStyle = '#6f645b';
    g.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 7000; i++) {
      const v = randi(78, 150), s = rand(1.5, 4);
      g.fillStyle = `rgb(${v + 10},${v + 2},${v - 8})`;
      g.fillRect(rand(0, 256), rand(0, 512), s, s);
    }
    for (let i = 0; i < 8; i++) {
      const y = i * 64 + 22;
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.fillRect(12, y + 4, 232, 24);
      g.fillStyle = '#5a412f';
      g.fillRect(12, y, 232, 22);
      g.strokeStyle = 'rgba(30,18,10,0.45)';
      g.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.moveTo(14, y + 5 + k * 6);
        g.lineTo(242, y + 5 + k * 6 + rand(-2, 2));
        g.stroke();
      }
      g.fillStyle = '#2e2f33'; // tie plates under the rails
      g.fillRect(128 - 69 - 10, y + 2, 20, 18);
      g.fillRect(128 + 69 - 10, y + 2, 20, 18);
    }
    const t = toTexture(c, true);
    t.repeat.set(3, SEG_LEN / 10);
    return t;
  }

  function groundTexture() {
    const [c, g] = makeCanvas(256, 256);
    g.fillStyle = '#8d877d';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5000; i++) {
      const v = randi(110, 170), s = rand(1, 3);
      g.fillStyle = `rgb(${v},${v - 4},${v - 12})`;
      g.fillRect(rand(0, 256), rand(0, 256), s, s);
    }
    for (let i = 0; i < 25; i++) {
      g.fillStyle = pick(['#6f8f3a', '#5b7d2e', '#89a84a']);
      const x = rand(0, 256), y = rand(0, 256);
      for (let k = 0; k < 6; k++) g.fillRect(x + rand(-6, 6), y + rand(-6, 6), 3, 3);
    }
    const t = toTexture(c, true);
    t.repeat.set(1, SEG_LEN / 4);
    return t;
  }

  function hazardTexture(a, b) {
    const W = 256, H = 64;
    const [c, g] = makeCanvas(W, H);
    g.fillStyle = a;
    g.fillRect(0, 0, W, H);
    g.fillStyle = b;
    for (let x = -H; x < W + H; x += 48) {
      g.beginPath();
      g.moveTo(x, H);
      g.lineTo(x + 24, H);
      g.lineTo(x + 24 + H, 0);
      g.lineTo(x + H, 0);
      g.closePath();
      g.fill();
    }
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 6;
    g.strokeRect(0, 0, W, H);
    return toTexture(c);
  }

  const WORDS = ['TEDDY', 'CLAUDE', 'METRO', 'SURF!', 'ZOOM', 'RUN!', 'TED', 'WOW', 'YO!', 'GO!', 'TEDDY'];
  const SPRAY = ['#ff3d7f', '#18d4ff', '#ffd400', '#7cff4f', '#ff7a1a', '#b45cff', '#ffffff'];

  function graffitiTexture(featured) {
    const W = 1024, H = 164;
    const [c, g] = makeCanvas(W, H);
    const base = pick(['#9c9187', '#8f9399', '#a78f7d', '#86918f', '#a39a8c']);
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);
    for (let y = 0, row = 0; y < H; y += 20, row++) {
      for (let x = row % 2 ? -30 : 0; x < W; x += 60) {
        g.fillStyle = shade(base, rand(-0.08, 0.06));
        g.fillRect(x + 2, y + 2, 56, 16);
      }
    }
    const grime = g.createLinearGradient(0, 0, 0, H);
    grime.addColorStop(0, 'rgba(0,0,0,0)');
    grime.addColorStop(0.75, 'rgba(40,30,20,0.05)');
    grime.addColorStop(1, 'rgba(40,30,20,0.45)');
    g.fillStyle = grime;
    g.fillRect(0, 0, W, H);

    const queue = featured ? [featured] : [];
    let x = rand(10, 60);
    while (x < W - 120) {
      const word = queue.length ? queue.shift() : pick(WORDS);
      const size = rand(64, 96);
      g.save();
      g.font = `${size}px ${FONT}`;
      const w = g.measureText(word).width;
      if (x + w > W - 10) {
        g.restore();
        break;
      }
      g.translate(x + w / 2, H * rand(0.5, 0.62));
      g.rotate(rand(-0.08, 0.08));
      const c1 = pick(SPRAY);
      let c2 = pick(SPRAY);
      while (c2 === c1) c2 = pick(SPRAY);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineJoin = 'round';
      g.shadowColor = c1;
      g.shadowBlur = 18;
      g.lineWidth = 16;
      g.strokeStyle = '#15131c';
      g.strokeText(word, 0, 0);
      g.shadowBlur = 0;
      const grad = g.createLinearGradient(0, -size / 2, 0, size / 2);
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      g.fillStyle = grad;
      g.fillText(word, 0, 0);
      g.lineWidth = 2.5;
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.strokeText(word, -2, -2);
      g.fillStyle = c2; // paint drips
      for (let k = 0; k < 4; k++) g.fillRect(rand(-w / 2, w / 2), size * 0.3, 4, rand(8, 26));
      g.restore();
      x += w + rand(30, 110);
    }
    g.strokeStyle = 'rgba(20,20,30,0.7)'; // little scribbled tags
    g.lineWidth = 2.5;
    for (let i = 0; i < 6; i++) {
      const tx = rand(0, W), ty = rand(12, 48);
      g.beginPath();
      g.moveTo(tx, ty);
      for (let k = 0; k < 6; k++) g.lineTo(tx + k * 7 + rand(-3, 3), ty + rand(-10, 10));
      g.stroke();
    }
    const t = toTexture(c, true);
    t.repeat.set(2, 1); // a whole number of tiles per wall, so no word is cut off at a seam
    return t;
  }

  const FACADES = [
    { wall: '#b4533c', brick: true },
    { wall: '#d8c3a0' },
    { wall: '#5f939b' },
    { wall: '#7b7fa0' },
    { wall: '#e0a55a' },
    { wall: '#a46c95', brick: true },
    { wall: '#c9cfd6' },
  ];

  // One 8×8 m tile of building front: two floors of three windows.
  function facadeTexture(style) {
    const [c, g] = makeCanvas(256, 256);
    g.fillStyle = style.wall;
    g.fillRect(0, 0, 256, 256);
    if (style.brick) {
      for (let y = 0, r = 0; y < 256; y += 8, r++) {
        for (let x = r % 2 ? -8 : 0; x < 256; x += 16) {
          g.fillStyle = shade(style.wall, rand(-0.07, 0.05));
          g.fillRect(x + 1, y + 1, 14, 6);
        }
      }
    } else {
      for (let i = 0; i < 1500; i++) {
        g.fillStyle = `rgba(0,0,0,${rand(0.02, 0.07)})`;
        g.fillRect(rand(0, 256), rand(0, 256), 2, 2);
      }
    }
    for (let row = 0; row < 2; row++) {
      const y0 = row * 128;
      g.fillStyle = shade(style.wall, -0.2);
      g.fillRect(0, y0 + 118, 256, 10);
      for (let col = 0; col < 3; col++) {
        const x = 16 + col * 80, y = y0 + 20, w = 64, h = 80;
        g.fillStyle = shade(style.wall, 0.3);
        g.fillRect(x - 5, y - 5, w + 10, h + 10);
        const lit = Math.random() < 0.18;
        const gl = g.createLinearGradient(x, y, x + w, y + h);
        if (lit) {
          gl.addColorStop(0, '#fff0b8');
          gl.addColorStop(1, '#ffc56a');
        } else {
          gl.addColorStop(0, '#a9d2f0');
          gl.addColorStop(0.5, '#3f6189');
          gl.addColorStop(1, '#22344f');
        }
        g.fillStyle = gl;
        g.fillRect(x, y, w, h);
        g.fillStyle = shade(style.wall, 0.3);
        g.fillRect(x + w / 2 - 2, y, 4, h);
        g.fillRect(x, y + h * 0.45, w, 4);
        g.fillStyle = 'rgba(255,255,255,0.22)';
        g.beginPath();
        g.moveTo(x + 6, y + h - 6);
        g.lineTo(x + 24, y + 6);
        g.lineTo(x + 34, y + 6);
        g.lineTo(x + 16, y + h - 6);
        g.fill();
        g.fillStyle = shade(style.wall, -0.35);
        g.fillRect(x - 7, y + h + 4, w + 14, 6);
      }
    }
    return toTexture(c, true);
  }

  const BILLBOARDS = [
    { a: "TEDDY'S", b: 'PIZZA', bg: '#ff5a36', fg: '#ffd400' },
    { a: 'CLAUDE', b: 'CODE', bg: '#d97757', fg: '#fff4e6' },
    { a: 'GO TEDDY', b: 'GO!', bg: '#1b8cff', fg: '#ffffff' },
    { a: 'METRO', b: 'SURFER', bg: '#ffd400', fg: '#14121f' },
    { a: 'SHIP IT', b: '★★★', bg: '#7b5cff', fg: '#ffffff' },
  ];

  function billboardTexture(b) {
    const [c, g] = makeCanvas(512, 256);
    g.fillStyle = b.bg;
    g.fillRect(0, 0, 512, 256);
    const sheen = g.createLinearGradient(0, 0, 512, 256);
    sheen.addColorStop(0, 'rgba(255,255,255,0.25)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
    g.fillStyle = sheen;
    g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#fff6d0'; // marquee bulbs
    for (let x = 14; x < 512; x += 28) {
      g.beginPath(); g.arc(x, 12, 5, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(x, 244, 5, 0, Math.PI * 2); g.fill();
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.fillStyle = b.fg;
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 8;
    g.font = `58px ${FONT}`;
    g.strokeText(b.a, 256, 88);
    g.fillText(b.a, 256, 88);
    g.font = `80px ${FONT}`;
    g.strokeText(b.b, 256, 172);
    g.fillText(b.b, 256, 172);
    return toTexture(c);
  }

  function glass(g, x, y, w, h) {
    const gr = g.createLinearGradient(x, y, x + w, y + h);
    gr.addColorStop(0, '#c4e8ff');
    gr.addColorStop(0.35, '#5384ad');
    gr.addColorStop(1, '#1d2d44');
    g.fillStyle = gr;
    roundRect(g, x, y, w, h, 6);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = 3;
    g.stroke();
  }

  function trainSideTexture(color) {
    const W = 512, H = 160;
    const [c, g] = makeCanvas(W, H);
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, shade(color, 0.3));
    grad.addColorStop(0.45, color);
    grad.addColorStop(1, shade(color, -0.25));
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(0,0,0,0.16)';
    g.lineWidth = 2;
    for (let x = 0; x < W; x += 64) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }
    g.fillStyle = '#ffffff';
    g.fillRect(0, 100, W, 10);
    g.fillStyle = shade(color, -0.45);
    g.fillRect(0, 110, W, 6);
    for (const wx of [18, 180, 272, 434]) glass(g, wx, 30, 60, 50);
    for (const dx of [128, 384]) {
      g.fillStyle = shade(color, -0.12);
      roundRect(g, dx - 34, 20, 68, 136, 6);
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.45)';
      g.lineWidth = 3;
      g.stroke();
      g.beginPath();
      g.moveTo(dx, 20);
      g.lineTo(dx, 156);
      g.stroke();
      glass(g, dx - 28, 30, 22, 54);
      glass(g, dx + 6, 30, 22, 54);
    }
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, 148, W, 12);
    return toTexture(c);
  }

  function trainFrontTexture(color) {
    const W = 256, H = 320;
    const [c, g] = makeCanvas(W, H);
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, shade(color, 0.25));
    grad.addColorStop(1, shade(color, -0.2));
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#16141c';
    roundRect(g, 40, 14, 176, 38, 6);
    g.fill();
    g.fillStyle = '#ffb02e';
    g.font = `24px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('METRO', 128, 34);
    glass(g, 24, 62, 208, 112);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 194, W, 12);
    for (const x of [62, 194]) {
      g.fillStyle = '#2a2a30';
      g.beginPath(); g.arc(x, 246, 25, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff4c8';
      g.beginPath(); g.arc(x, 246, 16, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#16141c';
    roundRect(g, 102, 228, 52, 36, 5);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = `22px ${FONT}`;
    g.fillText(String(randi(1, 9)), 128, 247);
    g.fillStyle = '#2a2a30';
    g.fillRect(0, 288, W, 32);
    return toTexture(c);
  }

  // Emissive mask for the train front: only the headlights glow.
  function headlightTexture() {
    const [c, g] = makeCanvas(256, 320);
    g.fillStyle = '#000';
    g.fillRect(0, 0, 256, 320);
    g.fillStyle = '#fff';
    for (const x of [62, 194]) {
      g.beginPath(); g.arc(x, 246, 17, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#ffb02e';
    g.fillRect(44, 18, 168, 30);
    return toTexture(c);
  }

  function roofTexture() {
    const [c, g] = makeCanvas(128, 512);
    g.fillStyle = '#b8bdc5';
    g.fillRect(0, 0, 128, 512);
    g.strokeStyle = 'rgba(0,0,0,0.2)';
    g.lineWidth = 2;
    for (let y = 0; y < 512; y += 64) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 8; y < 512; y += 16) {
      g.fillRect(6, y, 3, 3);
      g.fillRect(119, y, 3, 3);
    }
    g.fillStyle = '#8d939c';
    roundRect(g, 34, 180, 60, 150, 8);
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.3)';
    for (let y = 192; y < 320; y += 12) g.fillRect(42, y, 44, 4);
    return toTexture(c);
  }

  function coinFaceTexture() {
    const [c, g] = makeCanvas(128, 128);
    const gr = g.createRadialGradient(54, 50, 6, 64, 64, 64);
    gr.addColorStop(0, '#fff6b8');
    gr.addColorStop(0.55, '#ffcd2e');
    gr.addColorStop(1, '#d68a00');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#b87400';
    g.lineWidth = 6;
    g.beginPath(); g.arc(64, 64, 50, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#e89a00';
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 15 : 34, a = -Math.PI / 2 + (i * Math.PI) / 5;
      g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    return toTexture(c);
  }

  function iconTexture(def) {
    const [c, g] = makeCanvas(128, 128);
    g.fillStyle = def.color;
    g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
    g.lineWidth = 7;
    g.strokeStyle = '#ffffff';
    g.stroke();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (def.text) {
      g.font = `52px ${FONT}`;
      g.lineWidth = 8;
      g.strokeStyle = '#14121f';
      g.strokeText(def.icon, 64, 68);
      g.fillStyle = '#ffffff';
      g.fillText(def.icon, 64, 68);
    } else {
      g.font = `64px ${EMOJI_FONT}`;
      g.fillText(def.icon, 64, 70);
    }
    return toTexture(c);
  }

  function boardTexture() {
    const [c, g] = makeCanvas(64, 256);
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#ff3d7f');
    gr.addColorStop(1, '#18d4ff');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 256);
    g.fillStyle = '#ffd400';
    g.beginPath(); // lightning bolt
    g.moveTo(38, 40); g.lineTo(18, 132); g.lineTo(34, 132); g.lineTo(24, 216); g.lineTo(48, 112); g.lineTo(32, 112);
    g.closePath();
    g.fill();
    return toTexture(c);
  }

  function cloudTexture() {
    const [c, g] = makeCanvas(256, 128);
    for (let i = 0; i < 14; i++) {
      const x = rand(50, 206), y = rand(56, 84), r = rand(22, 42);
      const gr = g.createRadialGradient(x, y - r * 0.3, r * 0.1, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.7, 'rgba(255,255,255,0.9)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    return toTexture(c);
  }

  // ---------------------------------------------------------------- shared resources

  const POWERUPS = {
    magnet: { icon: '🧲', color: '#ff3b5c', label: 'COIN MAGNET!' },
    jet: { icon: '🚀', color: '#ff9f1c', label: 'JETPACK!' },
    sneakers: { icon: '👟', color: '#2fd36b', label: 'SUPER SNEAKERS!' },
    mult: { icon: '2×', color: '#b45cff', label: '2× SCORE!', text: true },
    board: { icon: '🛹', color: '#18b4ff', label: '+1 HOVERBOARD' },
    zombie: { icon: '🧟', color: '#5fbf3a', label: 'ZOMBIE!' }, // not a power-up: a harmless scare card
  };
  const TRAIN_COLORS = ['#f7c51e', '#2f7fe2', '#e8453a', '#2fb36a', '#ff8a1f', '#8d5bd8', '#e9eef3'];

  const R = {};
  const Art = { dims, SKY, POWERUPS };

  Art.init = function () {
    R.trackMat = std('#ffffff', { map: trackTexture(), roughness: 0.95 });
    R.groundMat = std('#ffffff', { map: groundTexture(), roughness: 1 });
    R.lotMat = std('#77726b', { roughness: 1 });
    R.railMat = std('#c9ced6', { metalness: 0.7, roughness: 0.3 });
    R.wallMats = [];
    for (let i = 0; i < 7; i++) R.wallMats.push(std('#ffffff', { map: graffitiTexture(['TEDDY', 'CLAUDE', 'METRO'][i]), roughness: 0.9 }));
    R.capMat = std('#b9b3aa');
    R.poleMat = std('#2f4a3a', { metalness: 0.3, roughness: 0.6 });
    R.lampMat = new T.MeshBasicMaterial({ color: '#fff3c4' });
    R.facadeMats = FACADES.map((f) => std('#ffffff', { map: facadeTexture(f), roughness: 0.85 }));
    R.roofMat = std('#5b5a60', { roughness: 0.95 });
    R.towerMat = std('#8a5a3c');
    R.towerRoofMat = std('#5d3b27');
    R.billboardMats = BILLBOARDS.map((b) => new T.MeshBasicMaterial({ map: billboardTexture(b) }));
    R.frameMat = std('#3a3a44', { metalness: 0.5, roughness: 0.5 });
    R.hazardRed = std('#ffffff', { map: hazardTexture('#ffffff', '#e53935'), roughness: 0.6 });
    R.hazardYellow = std('#ffffff', { map: hazardTexture('#ffd400', '#1c1a22'), roughness: 0.6 });
    R.metal = std('#9aa0a8', { metalness: 0.6, roughness: 0.4 });
    R.dark = std('#24232b', { roughness: 0.7 });
    R.wheelMat = std('#3a3b42', { metalness: 0.6, roughness: 0.4 });
    R.trainRoofMat = std('#ffffff', { map: roofTexture(), roughness: 0.6, metalness: 0.2 });
    R.rampMat = std('#7d838c', { metalness: 0.4, roughness: 0.5 });
    R.warnMat = new T.MeshBasicMaterial({ color: '#ff8a00' });
    R.headlightTex = headlightTexture();
    R.trains = {};

    R.glowMat = new T.SpriteMaterial({ map: Kit.gfx.glowTexture(), color: '#fff1b0', blending: T.AdditiveBlending, depthWrite: false, transparent: true });

    // geometry, shared by every copy of a model
    R.bedGeo = new T.PlaneGeometry(LANE_W * 3, SEG_LEN);
    R.sideGeo = new T.PlaneGeometry(3.8, SEG_LEN);
    R.lotGeo = new T.PlaneGeometry(90, SEG_LEN);
    R.wallGeo = new T.PlaneGeometry(SEG_LEN, 4.4);
    R.capGeo = new T.BoxGeometry(0.5, 0.3, SEG_LEN);
    R.railGeo = new T.BoxGeometry(0.12, 0.16, SEG_LEN);
    R.poleGeo = new T.CylinderGeometry(0.08, 0.11, 5.8, 8);
    R.armGeo = new T.BoxGeometry(1.3, 0.08, 0.08);
    R.lampHeadGeo = new T.BoxGeometry(0.5, 0.15, 0.3);
    R.legGeo = new T.BoxGeometry(0.12, 2, 0.12);
    R.tankGeo = new T.CylinderGeometry(1.3, 1.3, 2.4, 14);
    R.tankRoofGeo = new T.ConeGeometry(1.45, 0.9, 14);
    R.acGeo = new T.BoxGeometry(1.4, 1, 1.2);
    R.bbPostGeo = new T.BoxGeometry(0.2, 3, 0.2);
    R.bbGeo = new T.PlaneGeometry(9, 4.5);
    R.bbBackGeo = new T.BoxGeometry(9.3, 4.8, 0.15);

    R.carGeo = new T.BoxGeometry(2.3, TRAIN_TOP - TRAIN_BOTTOM, CAR_LEN - 0.5);
    R.bogieGeo = new T.BoxGeometry(1.8, 0.35, 1.9);
    R.axleGeo = new T.CylinderGeometry(0.3, 0.3, 2.0, 12).rotateZ(Math.PI / 2);
    R.couplerGeo = new T.BoxGeometry(0.5, 0.4, 0.6);

    const ramp = new T.Shape();
    ramp.moveTo(0, 0);
    ramp.lineTo(RAMP_LEN, TRAIN_TOP - 0.02);
    ramp.lineTo(RAMP_LEN, 0);
    ramp.lineTo(0, 0);
    // shape x runs along the ramp; rotate so it points away from the player (-z), extrusion becomes the width (x)
    R.rampGeo = new T.ExtrudeGeometry(ramp, { depth: 2.2, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-1.1, 0, 0);
    R.rampSlope = Math.atan2(TRAIN_TOP, RAMP_LEN);
    R.plankGeo = new T.BoxGeometry(2.24, 0.08, Math.hypot(TRAIN_TOP, RAMP_LEN));

    R.lowPostGeo = new T.BoxGeometry(0.14, LOW_H, 0.14);
    R.lowBoardGeo = new T.BoxGeometry(2.4, 0.5, 0.14);
    R.footGeo = new T.BoxGeometry(0.5, 0.06, 0.5);
    R.highPostGeo = new T.BoxGeometry(0.16, HIGH_TOP, 0.16);
    R.highBoardGeo = new T.BoxGeometry(2.5, HIGH_TOP - HIGH_BOTTOM, 0.14);
    R.lampBulbGeo = new T.SphereGeometry(0.12, 10, 8);

    Art.coinGeo = new T.CylinderGeometry(0.42, 0.42, 0.1, 24).rotateX(Math.PI / 2);
    const face = coinFaceTexture();
    const faceMat = std('#ffffff', { map: face, emissiveMap: face, emissive: new T.Color('#ffffff'), emissiveIntensity: 0.35, metalness: 0.3, roughness: 0.3 });
    Art.coinMats = [std('#ffbf1f', { metalness: 0.4, roughness: 0.3, emissive: new T.Color('#b06d00'), emissiveIntensity: 0.6 }), faceMat, faceMat];

    R.bubbleGeo = new T.SphereGeometry(0.62, 20, 14);
    R.ringGeo = new T.TorusGeometry(0.78, 0.045, 8, 40);
    R.pw = {};
    for (const [type, def] of Object.entries(POWERUPS)) {
      R.pw[type] = {
        bubble: std(def.color, { emissive: new T.Color(def.color), emissiveIntensity: 0.5, transparent: true, opacity: 0.35, roughness: 0.2, depthWrite: false }),
        icon: new T.SpriteMaterial({ map: iconTexture(def), depthWrite: false }),
        ring: new T.MeshBasicMaterial({ color: def.color }),
      };
    }
  };

  // ---------------------------------------------------------------- sky

  Art.buildSky = function () {
    const vec = (hex) => {
      const n = parseInt(hex.slice(1), 16);
      return new T.Vector3((n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
    };
    const mat = new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      uniforms: { top: { value: vec(SKY.top) }, mid: { value: vec(SKY.mid) }, hor: { value: vec(SKY.horizon) } },
      vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader:
        'uniform vec3 top; uniform vec3 mid; uniform vec3 hor; varying vec3 vDir;' +
        'void main() { float h = vDir.y; vec3 c = mix(hor, mid, smoothstep(0.0, 0.16, h)); c = mix(c, top, smoothstep(0.16, 0.7, h)); gl_FragColor = vec4(c, 1.0); }',
    });
    const sky = new T.Mesh(new T.SphereGeometry(600, 32, 16), mat);
    sky.renderOrder = -1;
    sky.frustumCulled = false;
    return sky;
  };

  Art.buildClouds = function () {
    const g = new T.Group();
    const tex = cloudTexture();
    for (let i = 0; i < 16; i++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: tex, fog: false, depthWrite: false, transparent: true, opacity: rand(0.7, 0.95) }));
      const sc = rand(70, 130);
      s.scale.set(sc, sc * 0.45, 1);
      s.position.set(rand(-300, 300), rand(30, 95), rand(-560, -240));
      g.add(s);
    }
    return g;
  };

  // ---------------------------------------------------------------- environment

  function lamp(g, s, z) {
    mesh(R.poleGeo, R.poleMat, s * 6.9, 2.9, z, g);
    mesh(R.armGeo, R.poleMat, s * 6.3, 5.7, z, g, false);
    mesh(R.lampHeadGeo, R.lampMat, s * 5.7, 5.55, z, g, false);
  }

  function waterTower(g, x, y, z) {
    for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) mesh(R.legGeo, R.dark, x + dx, y + 1, z + dz, g, false);
    mesh(R.tankGeo, R.towerMat, x, y + 3.2, z, g, false);
    mesh(R.tankRoofGeo, R.towerRoofMat, x, y + 4.85, z, g, false);
  }

  // A rooftop billboard angled toward the track so the camera can read it.
  function billboard(g, s, x, y, z) {
    const b = new T.Group();
    mesh(R.bbPostGeo, R.frameMat, -2.5, 1.5, 0, b, false);
    mesh(R.bbPostGeo, R.frameMat, 2.5, 1.5, 0, b, false);
    mesh(R.bbBackGeo, R.frameMat, 0, 4.6, -0.1, b, false);
    const face = new T.Mesh(R.bbGeo, pick(R.billboardMats));
    face.position.set(0, 4.6, 0);
    b.add(face);
    b.position.set(x, y, z);
    b.rotation.y = s < 0 ? Math.PI / 4 : -Math.PI / 4;
    g.add(b);
    return face;
  }

  // One SEG_LEN-long slice of the world: track, walls, lamps and buildings. Content runs from z=0 to z=-SEG_LEN.
  Art.buildSegment = function () {
    const g = new T.Group();
    const L = SEG_LEN;
    const flat = (geo, mat, x, y) => {
      const m = new T.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, y, -L / 2);
      m.receiveShadow = true;
      g.add(m);
      return m;
    };
    flat(R.bedGeo, R.trackMat, 0, 0);
    flat(R.lotGeo, R.lotMat, 0, -0.03);
    for (const lx of [-LANE_W, 0, LANE_W]) {
      for (const o of [-0.7, 0.7]) mesh(R.railGeo, R.railMat, lx + o, 0.08, -L / 2, g, false).receiveShadow = true;
    }
    const walls = [], buildings = [], boards = [];
    for (const s of [-1, 1]) {
      flat(R.sideGeo, R.groundMat, s * 5.8, 0.005);
      const wall = new T.Mesh(R.wallGeo, pick(R.wallMats));
      wall.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2;
      wall.position.set(s * 7.7, 2.2, -L / 2);
      wall.receiveShadow = true;
      g.add(wall);
      walls.push(wall);
      mesh(R.capGeo, R.capMat, s * 7.85, 4.55, -L / 2, g, false);
      lamp(g, s, -12);
      lamp(g, s, -42);
      let z = 0;
      while (z > -L + 3) {
        const w = Math.min(rand(9, 17), L + z);
        if (w < 3) break;
        const dep = rand(8, 13), h = rand(9, 30);
        const geo = new T.BoxGeometry(dep, h, w);
        boxUV(geo, dep, h, w, 8);
        const fm = pick(R.facadeMats);
        const b = new T.Mesh(geo, [fm, fm, R.roofMat, R.roofMat, fm, fm]);
        b.position.set(s * (8.8 + dep / 2 + rand(0, 2)), h / 2, z - w / 2);
        g.add(b);
        buildings.push(b);
        const r = Math.random();
        if (r < 0.28) waterTower(g, b.position.x + rand(-1.5, 1.5), h, b.position.z + rand(-2, 2));
        else if (r < 0.5) boards.push(billboard(g, s, b.position.x - s * dep * 0.2, h, b.position.z));
        else if (r < 0.75) mesh(R.acGeo, R.metal, b.position.x + rand(-2, 2), h + 0.5, b.position.z + rand(-2, 2), g, false);
        z -= w + rand(0.4, 2.2);
      }
    }
    g.userData = { walls, buildings, boards };
    return g;
  };

  // Called when a segment is recycled to the front, so the scenery doesn't visibly repeat.
  Art.reskinSegment = function (seg) {
    for (const w of seg.userData.walls) w.material = pick(R.wallMats);
    for (const b of seg.userData.buildings) {
      const fm = pick(R.facadeMats);
      b.material = [fm, fm, R.roofMat, R.roofMat, fm, fm];
    }
    for (const f of seg.userData.boards) f.material = pick(R.billboardMats);
  };

  // ---------------------------------------------------------------- obstacles

  function trainMats(color) {
    if (R.trains[color]) return R.trains[color];
    const front = std('#ffffff', {
      map: trainFrontTexture(color),
      emissiveMap: R.headlightTex,
      emissive: new T.Color('#fff1b8'),
      emissiveIntensity: 0.2,
      roughness: 0.45,
      metalness: 0.15,
    });
    const frontLit = front.clone();
    frontLit.emissiveIntensity = 2.4;
    return (R.trains[color] = {
      side: std('#ffffff', { map: trainSideTexture(color), roughness: 0.45, metalness: 0.15 }),
      front,
      frontLit,
      end: std(color, { roughness: 0.6 }),
    });
  }

  // A train of `cars` cars. Origin is the centre of its front face; it extends toward -z.
  Art.buildTrain = function (cars, moving) {
    const m = trainMats(pick(TRAIN_COLORS));
    const g = new T.Group();
    for (let i = 0; i < cars; i++) {
      const zc = -(i * CAR_LEN + (CAR_LEN - 0.5) / 2);
      const front = i === 0 ? (moving ? m.frontLit : m.front) : m.end;
      const body = new T.Mesh(R.carGeo, [m.side, m.side, R.trainRoofMat, R.dark, front, m.end]);
      body.position.set(0, (TRAIN_TOP + TRAIN_BOTTOM) / 2, zc);
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);
      for (const off of [-3.3, 3.3]) {
        mesh(R.bogieGeo, R.dark, 0, 0.32, zc + off, g, false);
        mesh(R.axleGeo, R.wheelMat, 0, 0.3, zc + off - 0.55, g, false);
        mesh(R.axleGeo, R.wheelMat, 0, 0.3, zc + off + 0.55, g, false);
      }
      if (i > 0) mesh(R.couplerGeo, R.dark, 0, 1.0, -(i * CAR_LEN) + 0.25, g, false);
    }
    if (moving) {
      for (const x of [-0.59, 0.59]) {
        const s = new T.Sprite(R.glowMat);
        s.position.set(x, 1.17, 0.15);
        s.scale.setScalar(1.8);
        g.add(s);
      }
    }
    return g;
  };

  // A ramp up to train-roof height. Origin is its low end; it rises toward -z.
  Art.buildRamp = function () {
    const g = new T.Group();
    const body = mesh(R.rampGeo, R.rampMat, 0, 0, 0, g);
    body.receiveShadow = true;
    const plank = mesh(R.plankGeo, R.hazardYellow, 0, 0, 0, g, false);
    const n = new T.Vector3(0, Math.cos(R.rampSlope), Math.sin(R.rampSlope));
    plank.position.set(0, TRAIN_TOP / 2, -RAMP_LEN / 2).addScaledVector(n, 0.05);
    plank.rotation.x = R.rampSlope;
    plank.receiveShadow = true;
    return g;
  };

  // Low barrier: jump it.
  Art.buildLow = function () {
    const g = new T.Group();
    for (const x of [-1.05, 1.05]) {
      mesh(R.lowPostGeo, R.metal, x, LOW_H / 2, 0, g);
      mesh(R.footGeo, R.dark, x, 0.03, 0, g, false);
    }
    mesh(R.lowBoardGeo, R.hazardRed, 0, LOW_H - 0.27, 0, g);
    return g;
  };

  // High barrier: roll under it.
  Art.buildHigh = function () {
    const g = new T.Group();
    for (const x of [-1.15, 1.15]) {
      mesh(R.highPostGeo, R.metal, x, HIGH_TOP / 2, 0, g);
      mesh(R.footGeo, R.dark, x, 0.03, 0, g, false);
    }
    mesh(R.highBoardGeo, R.hazardYellow, 0, (HIGH_TOP + HIGH_BOTTOM) / 2, 0, g);
    for (const x of [-0.8, 0.8]) mesh(R.lampBulbGeo, R.warnMat, x, HIGH_TOP + 0.1, 0, g, false);
    return g;
  };

  Art.buildPowerup = function (type) {
    const r = R.pw[type];
    const g = new T.Group();
    const bubble = new T.Mesh(R.bubbleGeo, r.bubble);
    bubble.renderOrder = 1;
    g.add(bubble);
    const icon = new T.Sprite(r.icon);
    icon.scale.setScalar(0.92);
    icon.renderOrder = 2;
    g.add(icon);
    const ring = new T.Mesh(R.ringGeo, r.ring);
    g.add(ring);
    g.userData.ring = ring;
    return g;
  };

  // ---------------------------------------------------------------- the chasers' dog (people come from Kit.people)

  Art.buildDog = function () {
    const root = new T.Group();
    const fur = std('#a8703f'), darkFur = std('#6e4424'), black = std('#151418'), red = std('#e53935');
    const body = mesh(new T.BoxGeometry(0.36, 0.34, 0.85), fur, 0, 0.6, 0, root);
    const head = new T.Group();
    head.position.set(0, 0.2, -0.5);
    body.add(head);
    mesh(new T.BoxGeometry(0.32, 0.3, 0.34), fur, 0, 0, 0, head);
    mesh(new T.BoxGeometry(0.2, 0.15, 0.2), fur, 0, -0.05, -0.24, head);
    mesh(new T.BoxGeometry(0.08, 0.07, 0.05), black, 0, 0.0, -0.35, head);
    mesh(new T.BoxGeometry(0.08, 0.16, 0.08), darkFur, -0.12, 0.2, 0.04, head);
    mesh(new T.BoxGeometry(0.08, 0.16, 0.08), darkFur, 0.12, 0.2, 0.04, head);
    mesh(new T.BoxGeometry(0.34, 0.08, 0.1), red, 0, -0.12, 0.16, head);
    const tail = new T.Group();
    tail.position.set(0, 0.12, 0.42);
    body.add(tail);
    mesh(new T.BoxGeometry(0.07, 0.07, 0.32), darkFur, 0, 0, 0.14, tail);
    const legGeo = new T.BoxGeometry(0.1, 0.42, 0.1).translate(0, -0.21, 0);
    const legs = [[-0.12, -0.3], [0.12, -0.3], [-0.12, 0.3], [0.12, 0.3]].map(([x, z]) => {
      const l = new T.Group();
      l.position.set(x, 0.42, z);
      root.add(l);
      mesh(legGeo, fur, 0, 0, 0, l);
      return l;
    });
    return { root, body, legs, tail };
  };

  Art.poseDog = function (d, ph) {
    const s = Math.sin(ph);
    d.legs[0].rotation.x = s * 0.9;
    d.legs[1].rotation.x = s * 0.7;
    d.legs[2].rotation.x = -s * 0.9;
    d.legs[3].rotation.x = -s * 0.7;
    d.body.position.y = 0.6 + Math.abs(Math.cos(ph)) * 0.06;
    d.tail.rotation.x = 0.6 + Math.sin(ph * 2) * 0.3;
  };

  Art.buildBoard = function () {
    const g = new T.Group();
    const top = std('#ffffff', { map: boardTexture(), roughness: 0.4 });
    const edge = std('#18d4ff', { emissive: new T.Color('#18d4ff'), emissiveIntensity: 0.8 });
    const deck = new T.Mesh(new T.BoxGeometry(0.7, 0.08, 1.55), [edge, edge, top, edge, edge, edge]);
    deck.castShadow = true;
    g.add(deck);
    const glow = new T.Sprite(new T.SpriteMaterial({ map: Kit.gfx.glowTexture(), color: '#28e0ff', blending: T.AdditiveBlending, depthWrite: false, transparent: true }));
    glow.scale.set(2.2, 1.1, 1);
    glow.position.y = -0.15;
    g.add(glow);
    return g;
  };

  Art.buildJetpack = function () {
    const g = new T.Group();
    const tankGeo = new T.CylinderGeometry(0.13, 0.13, 0.6, 14);
    const tank = std('#d8dde3', { metalness: 0.7, roughness: 0.25 });
    const flameGeo = new T.ConeGeometry(0.11, 0.55, 10).rotateX(Math.PI);
    const flameMat = new T.MeshBasicMaterial({ color: '#ffb02e', transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false });
    const flames = [];
    for (const x of [-0.15, 0.15]) {
      mesh(tankGeo, tank, x, 0.38, 0.33, g);
      flames.push(mesh(flameGeo, flameMat, x, -0.2, 0.33, g, false));
    }
    g.userData.flames = flames;
    return g;
  };

  // Word Hunt letter tiles: a glowing card that always faces the camera.
  const letterMats = {};
  Art.buildLetter = function (ch) {
    if (!letterMats[ch]) {
      const [c, g] = makeCanvas(128, 128);
      const gr = g.createLinearGradient(0, 0, 128, 128);
      gr.addColorStop(0, '#b45cff');
      gr.addColorStop(1, '#ff3d7f');
      g.fillStyle = gr;
      roundRect(g, 8, 8, 112, 112, 22);
      g.fill();
      g.lineWidth = 8;
      g.strokeStyle = '#ffd400';
      g.stroke();
      g.font = `78px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineJoin = 'round';
      g.lineWidth = 10;
      g.strokeStyle = '#14121f';
      g.strokeText(ch, 64, 70);
      g.fillStyle = '#ffffff';
      g.fillText(ch, 64, 70);
      letterMats[ch] = new T.SpriteMaterial({ map: toTexture(c), depthWrite: false });
    }
    const grp = new T.Group();
    const glow = new T.Sprite(R.letterGlowMat || (R.letterGlowMat = new T.SpriteMaterial({ map: Kit.gfx.glowTexture(), color: '#ffd400', blending: T.AdditiveBlending, depthWrite: false, transparent: true })));
    glow.scale.setScalar(2.6);
    const tile = new T.Sprite(letterMats[ch]);
    tile.scale.setScalar(1.15);
    grp.add(glow, tile);
    grp.userData.tile = tile;
    return grp;
  };

  window.MetroArt = Art;
})();
