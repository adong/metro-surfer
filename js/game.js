/* Metro Surfer — game logic.
   The player runs toward -z. Gameplay code works in track distance d = -z, so "further ahead" means a bigger d.
   One physics step (stepPlayer) drives both the real player and the autopilot's look-ahead simulations. */
(function () {
  'use strict';
  const T = THREE, A = window.MetroArt, S = window.MetroSound;
  const { LANE_W, TRAIN_TOP, RAMP_LEN, CAR_LEN, LOW_H, HIGH_BOTTOM, HIGH_TOP, SEG_LEN } = A.dims;

  // ---------------------------------------------------------------- tuning
  const LANE_X = [-LANE_W, 0, LANE_W];
  const GRAVITY = 62;
  const JUMP_V = 17.5; // apex ≈ 2.5: clears barriers, not trains
  const JUMP_V_HI = 23; // super sneakers, apex ≈ 4.3: clears trains
  const DROP_V = 32; // rolling in mid-air slams you down
  const ROLL_DUR = 0.62;
  const STEP = 0.8; // you can stand on a surface if your feet are no more than this below its top
  const HD = 0.3; // player half-depth along the track
  const JET_Y = 8.5;
  const SPAWN_AHEAD = 200;
  const ACT_DIST = 120; // a moving train starts rolling when the player is this close
  const TRAIN_V = 14;
  const SWEEP = 70; // track a moving train can cover before it meets the player, with margin
  const DUR = { magT: 11, jetT: 7.5, sneakT: 12, multT: 15, boardT: 30 };
  const POWER_KEY = { magnet: 'magT', jet: 'jetT', sneakers: 'sneakT', mult: 'multT' };
  const POWER_TABLE = ['magnet', 'magnet', 'magnet', 'jet', 'jet', 'sneakers', 'sneakers', 'mult', 'mult', 'board'];

  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const damp = (k, dt) => 1 - Math.exp(-k * dt);
  // Kid-friendly pace: 15 m/s at the start, easing toward 28 (about 20 after a minute, 23 after two).
  const START_SPEED = 15, TOP_SPEED = 28, RAMP_TIME = 120;
  const speedAt = (t) => START_SPEED + (TOP_SPEED - START_SPEED) * (1 - Math.exp(-t / RAMP_TIME));
  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem('metroSurfer.' + k);
        return v === null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try { localStorage.setItem('metroSurfer.' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ }
    },
  };

  // ---------------------------------------------------------------- physics
  // Pure functions of a player-state object and an obstacle list, so the autopilot can run them on copies.

  function newPlayer() {
    return { lane: 1, x: 0, y: 0, vy: 0, pd: 0, rollT: 0, grounded: true, jumpBuf: 0, invT: 0, jetT: 0, sneakT: 0, magT: 0, multT: 0, boardT: 0 };
  }

  // Would obstacle `o` hurt the player at their current height?
  function crashes(o, ps) {
    switch (o.type) {
      case 'train': return ps.y < TRAIN_TOP - STEP;
      case 'low': return ps.y < LOW_H - 0.1;
      case 'high': return ps.y < HIGH_TOP && !(ps.rollT > 0 && ps.y < HIGH_BOTTOM - 0.95);
      default: return false; // ramps are walkable
    }
  }

  // Height of the walkable surface under the player: ground, a ramp, or a train roof they're high enough to stand on.
  function surfaceAt(lane, pd, y, list) {
    let g = 0;
    for (const o of list) {
      if (o.dead || o.lane !== lane || pd < o.d0 - 0.3 || pd > o.d1 + 0.3) continue;
      let h;
      if (o.type === 'train') {
        if (y < TRAIN_TOP - STEP) continue;
        h = TRAIN_TOP;
      } else if (o.type === 'ramp') {
        h = TRAIN_TOP * clamp((pd - o.d0) / (o.d1 - o.d0), 0, 1);
      } else continue;
      if (h > g) g = h;
    }
    return g;
  }

  // Swept test along the track so nothing is skipped at high speed.
  function hitTest(ps, prev, list) {
    for (const o of list) {
      if (o.dead || o.lane !== ps.lane) continue;
      if (ps.pd + HD < o.d0 || prev - HD > o.d1) continue;
      if (crashes(o, ps)) return o;
    }
    return null;
  }

  function laneBlocked(l, ps, list) {
    for (const o of list) {
      if (o.dead || o.lane !== l) continue;
      if (ps.pd + HD + 0.2 < o.d0 || ps.pd - HD - 0.2 > o.d1) continue;
      if (crashes(o, ps)) return true;
    }
    return false;
  }

  // Returns what happened: 'switch' | 'stumble' | 'wall' | 'jump' | 'roll' | null.
  function applyAction(ps, a, list) {
    if (a === 'left' || a === 'right') {
      const l = ps.lane + (a === 'left' ? -1 : 1);
      if (l < 0 || l > 2) return 'wall';
      if (laneBlocked(l, ps, list)) return 'stumble';
      ps.lane = l;
      return 'switch';
    }
    if (ps.jetT > 0) return null;
    if (a === 'jump') {
      if (!ps.grounded) {
        ps.jumpBuf = 0.15; // pressed just before landing: jump as soon as we touch down
        return null;
      }
      ps.vy = ps.sneakT > 0 ? JUMP_V_HI : JUMP_V;
      ps.grounded = false;
      ps.rollT = 0;
      return 'jump';
    }
    if (a === 'roll') {
      ps.rollT = ROLL_DUR;
      if (!ps.grounded) ps.vy = Math.min(ps.vy, -DROP_V);
      return 'roll';
    }
    return null;
  }

  function stepPlayer(ps, dt, speed, list) {
    const prev = ps.pd;
    ps.pd += speed * dt;
    ps.x += (LANE_X[ps.lane] - ps.x) * Math.min(1, dt * 13);
    if (ps.rollT > 0) ps.rollT = Math.max(0, ps.rollT - dt);
    if (ps.jumpBuf > 0) ps.jumpBuf = Math.max(0, ps.jumpBuf - dt);
    if (ps.invT > 0) ps.invT = Math.max(0, ps.invT - dt);
    let landed = false;
    if (ps.jetT > 0) {
      ps.jetT -= dt;
      ps.y += (JET_Y - ps.y) * Math.min(1, dt * 3.5);
      ps.vy = 0;
      ps.grounded = false;
      if (ps.jetT <= 0) {
        ps.jetT = 0;
        ps.invT = Math.max(ps.invT, 1.2); // a moment of grace while falling back into traffic
      }
    } else {
      ps.vy -= GRAVITY * dt;
      ps.y += ps.vy * dt;
      const g = surfaceAt(ps.lane, ps.pd, ps.y, list);
      if (ps.y <= g) {
        landed = !ps.grounded;
        ps.y = g;
        ps.vy = 0;
        ps.grounded = true;
        if (ps.jumpBuf > 0) {
          ps.jumpBuf = 0;
          ps.vy = ps.sneakT > 0 ? JUMP_V_HI : JUMP_V;
          ps.grounded = false;
          ps.rollT = 0;
        }
      } else {
        ps.grounded = false;
      }
    }
    const hit = ps.invT > 0 || ps.jetT > 0 ? null : hitTest(ps, prev, list);
    return { hit, landed };
  }

  function moveTrains(list, pd, dt, onStart) {
    for (const o of list) {
      if (!o.moving || o.dead) continue;
      if (!o.active && o.d0 - pd < ACT_DIST) {
        o.active = true;
        if (onStart) onStart(o);
      }
      if (o.active) {
        o.d0 -= TRAIN_V * dt;
        o.d1 -= TRAIN_V * dt;
      }
    }
  }

  // ---------------------------------------------------------------- state

  const G = {
    state: 'boot', // title | playing | paused | dying | over
    attract: true, // the title screen: the autopilot plays in the background
    auto: false, // autopilot is driving
    userAuto: false, // the player switched autopilot on
    assisted: false, // autopilot drove at some point this run, so it can't set a best score
    t: 0, runT: 0, speed: START_SPEED, score: 0, coins: 0, boards: 2,
    stumbleT: 0, chaseT: 0, dyingT: 0, streak: 0, streakT: 0, surfT: 0, shake: 0,
    freezeT: 0, // > 0 while a zombie scare has the run frozen
    soak: null, // set while metro.soak() runs a headless test
  };
  const P = newPlayer();
  const obs = [], coins = [], items = [];
  const gen = { d: 0, safe: 1, rows: [], laneEnd: [-1e9, -1e9, -1e9], n: 0, sincePower: 0, sinceZombie: 6 };
  const chase = { dist: 18, x: 0, y: 0, ph: 0 };
  const cam = { x: 0, y: 0, fov: 60, pos: new T.Vector3(), look: new T.Vector3() };
  const segs = [];
  const ui = {};
  let renderer, scene, camera, sun, sky, clouds, particles, playerM, inspectorM, dogM, boardM, jetM;
  let runPhase = 0, last = 0, overAt = 0;

  const sfx = (name, ...args) => {
    if (G.attract || G.soak) return;
    S[name](...args);
  };

  // ---------------------------------------------------------------- level generation
  // Rows of obstacles are laid out ahead of the player. Each row has a "safe lane" that is always passable
  // (empty, a barrier, or a ramp up onto a train) and moves at most one lane per row, so there is always a way through.

  function addObstacle(type, lane, d0, d1, mesh, extra) {
    const o = Object.assign({ type, lane, d0, d1, mesh, dead: false, moving: false, active: false, ramp: null }, extra);
    scene.add(mesh);
    obs.push(o);
    gen.laneEnd[lane] = Math.max(gen.laneEnd[lane], d1);
    return o;
  }

  function addCoin(lane, d, y) {
    const mesh = new T.Mesh(A.coinGeo, A.coinMats);
    mesh.position.set(LANE_X[lane], y, -d);
    mesh.castShadow = true;
    scene.add(mesh);
    coins.push({ lane, d, y, mesh, taken: false, mag: false, rel: null });
  }

  function coinRun(lane, d, len) {
    for (let s = 0; s <= len; s += 2.4) addCoin(lane, d + s, 0.9);
  }

  function placeTrain(lane, d, cars, opt) {
    let d0 = d, ramp = null;
    if (opt.ramp) {
      const rm = A.buildRamp();
      rm.position.set(LANE_X[lane], 0, -d);
      ramp = addObstacle('ramp', lane, d, d + RAMP_LEN, rm);
      d0 = d + RAMP_LEN;
    }
    const len = cars * CAR_LEN - 0.5;
    const mesh = A.buildTrain(cars, !!opt.moving);
    mesh.position.set(LANE_X[lane], 0, -d0);
    addObstacle('train', lane, d0, d0 + len, mesh, { moving: !!opt.moving, ramp });
    if (opt.coins) {
      if (ramp) for (let s = 1.2; s < RAMP_LEN; s += 2.2) addCoin(lane, d + s, (TRAIN_TOP * s) / RAMP_LEN + 0.9);
      for (let s = d0 + 1.2; s < d0 + len - 0.8; s += 2.4) addCoin(lane, s, TRAIN_TOP + 0.9);
    }
  }

  function placeBarrier(lane, d, type, withCoins) {
    const mesh = type === 'low' ? A.buildLow() : A.buildHigh();
    mesh.position.set(LANE_X[lane], 0, -d);
    addObstacle(type, lane, d - 0.25, d + 0.25, mesh);
    if (!withCoins) return;
    if (type === 'low') {
      for (let i = -3; i <= 3; i++) addCoin(lane, d + i * 2, 0.9 + 2.2 * (1 - (i / 3) ** 2)); // an arc to jump through
    } else {
      for (let i = -2; i <= 2; i++) addCoin(lane, d + i * 2, 0.6); // a line to roll through
    }
  }

  function placePowerup(lane, d, type = pick(POWER_TABLE)) {
    const mesh = A.buildPowerup(type);
    mesh.position.set(LANE_X[lane], 1.3, -d);
    scene.add(mesh);
    items.push({ type, lane, d, y: 1.3, mesh, taken: false });
  }

  // Zombie cards: only in a real run, and not too often.
  const wantZombie = () => G.state === 'playing' && !G.soak && scareFrames.length > 0 && gen.sinceZombie >= 12;

  // A moving train sweeps toward the player, so its lane must stay clear (and never be the safe lane) for SWEEP behind it.
  function canMove(l, d) {
    if (gen.n < 5 || gen.laneEnd[l] > d - SWEEP) return false;
    for (const r of gen.rows) if (r.d > d - SWEEP - 5 && r.safe === l) return false;
    return true;
  }

  function genRow() {
    const d = gen.d, sp = G.speed, k = clamp(G.runT / 110, 0, 1);
    const early = gen.n < 4;
    const gap = 14 + sp * 0.75 + rand(0, 7);
    const room = Math.max(8, sp * 0.6); // track the player needs to change into the new safe lane
    const free = (l, r) => gen.laneEnd[l] <= d - r;

    const cands = [gen.safe - 1, gen.safe, gen.safe + 1].filter((l) => l >= 0 && l < 3 && free(l, room));
    const busy = cands.length === 0; // the safe lane is still a ramp-train the player is riding: stay on it
    let safe = gen.safe;
    if (!busy) safe = cands.includes(safe) && Math.random() < 0.45 ? safe : pick(cands);
    gen.safe = safe;
    gen.rows.push({ d, safe });

    if (!busy) {
      const r = Math.random();
      if (!early && wantLetter() && Math.random() < 0.45) placeLetter(safe, d + 2);
      else if (!early && wantZombie() && Math.random() < 0.35) {
        placePowerup(safe, d + 2, 'zombie');
        gen.sinceZombie = 0;
      } else if (!early && gen.sincePower >= 6 && Math.random() < 0.3) {
        placePowerup(safe, d + 2);
        gen.sincePower = 0;
      } else if (r < 0.18 + 0.1 * k) placeBarrier(safe, d, 'low', true);
      else if (r < 0.36 + 0.15 * k) placeBarrier(safe, d, 'high', true);
      else if (!early && r < 0.5 + 0.15 * k) placeTrain(safe, d, randi(1, 3), { ramp: true, coins: true });
      else coinRun(safe, d, Math.min(gap - 4, 18));
    }
    gen.sincePower++;
    gen.sinceZombie++;
    hunt.sinceRows++;

    for (let l = 0; l < 3; l++) {
      if (l === safe || !free(l, 3)) continue;
      const r = Math.random();
      if (canMove(l, d) && r < 0.1 + 0.2 * k) placeTrain(l, d, randi(1, 2), { moving: true });
      else if (r < (early ? 0.5 : 0.28)) continue;
      else if (r < 0.78) placeTrain(l, d, randi(1, 3), { ramp: Math.random() < 0.3, coins: Math.random() < 0.3 });
      else placeBarrier(l, d, Math.random() < 0.5 ? 'low' : 'high', false);
    }
    gen.n++;
    gen.d = d + gap;
  }

  // While the jetpack burns, lay a trail of coins in the sky.
  function skyCoins() {
    let lane = P.lane, n = 0;
    const end = P.pd + G.speed * DUR.jetT - 20;
    for (let d = P.pd + 18; d < end; d += 2.6) {
      if (++n % 9 === 0) lane = clamp(lane + pick([-1, 1]), 0, 2);
      addCoin(lane, d, JET_Y + 0.9);
    }
  }

  function cleanup() {
    const cut = P.pd - 25;
    for (let i = obs.length - 1; i >= 0; i--) {
      if (obs[i].d1 < cut) {
        scene.remove(obs[i].mesh);
        obs.splice(i, 1);
      }
    }
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      if (c.taken || (!c.mag && c.d < P.pd - 6)) {
        scene.remove(c.mesh);
        coins.splice(i, 1);
      }
    }
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.taken || it.d < P.pd - 6) {
        scene.remove(it.mesh);
        items.splice(i, 1);
      }
    }
    while (gen.rows.length && gen.rows[0].d < P.pd - 100) gen.rows.shift();
  }

  // ---------------------------------------------------------------- autopilot
  // Every ~0.1 s, simulate 75 short futures (a move now, maybe a second move a moment later) with the same
  // physics as the real player, score them, and make the first move of the best one. It looks ~1.2 s ahead.

  const ACTIONS = ['none', 'left', 'right', 'jump', 'roll'];
  const SECOND_AT = [0.2, 0.45, 0.75];
  const SIM_DT = 1 / 30, SIM_STEPS = 36;
  let apTimer = 0;

  function autopilot(dt) {
    apTimer -= dt;
    if (apTimer > 0) return;
    apTimer = 0.09;
    const near = obs.filter((o) => !o.dead && o.d1 > P.pd - 2 && o.d0 < P.pd + 75);
    const nearCoins = coins.filter((c) => !c.taken && c.d > P.pd - 1 && c.d < P.pd + 50)
      .concat(items.filter((it) => it.type === 'letter' && !it.taken && it.d > P.pd - 1 && it.d < P.pd + 50));
    let best = -Infinity, choice = 'none';
    for (const a1 of ACTIONS) {
      let s1 = -Infinity;
      for (const t2 of SECOND_AT) for (const a2 of ACTIONS) s1 = Math.max(s1, rollout(a1, t2, a2, near, nearCoins));
      if (a1 === 'none') s1 += 0.8; // don't fidget
      if (s1 > best) {
        best = s1;
        choice = a1;
      }
    }
    if (choice !== 'none') doAction(choice);
  }

  function rollout(a1, t2, a2, near, nearCoins) {
    const ps = Object.assign({}, P);
    const list = near.map((o) => (o.moving ? Object.assign({}, o) : o));
    // A stumble leaves you in your lane, so keep simulating and charge for it; a second one ends the run.
    const cost = (r) => (r === 'stumble' ? (G.stumbleT > 0 ? 9000 : 2500) : r === 'wall' ? 4 : 1);
    let score = a1 === 'none' ? 0 : -cost(applyAction(ps, a1, list));
    let t = 0, done2 = a2 === 'none';
    const got = new Uint8Array(nearCoins.length);
    for (let i = 0; i < SIM_STEPS; i++) {
      if (!done2 && t >= t2) {
        done2 = true;
        score -= cost(applyAction(ps, a2, list));
      }
      moveTrains(list, ps.pd, SIM_DT);
      const res = stepPlayer(ps, SIM_DT, G.speed, list);
      t += SIM_DT;
      if (res.hit) return -10000 + t * 1000; // a later crash is less bad than an early one
      for (let k = 0; k < nearCoins.length; k++) {
        const c = nearCoins[k];
        if (!got[k] && Math.abs(c.d - ps.pd) < 1 && Math.abs(LANE_X[c.lane] - ps.x) < 1 && Math.abs(c.y - ps.y - 0.9) < 1.3) {
          got[k] = 1;
          score += c.type === 'letter' ? 15 : 2.5;
        }
      }
    }
    return score + openRun(ps) * 0.12 + (ps.lane === 1 ? 0.5 : 0) + (ps.lane === nextSafe(ps.pd) ? 3 : 0);
  }

  // How much clear track the lane has ahead (a train without a ramp is a wall).
  function openRun(ps) {
    let run = 100;
    for (const o of obs) {
      if (o.dead || o.lane !== ps.lane || o.type !== 'train' || o.d1 < ps.pd) continue;
      if (o.ramp && !o.ramp.dead) continue;
      if (o.d0 <= ps.pd + 0.5 && ps.y >= TRAIN_TOP - STEP) continue; // riding it
      const dist = (o.d0 - ps.pd) * (o.moving ? 0.4 : 1);
      if (dist < run) run = Math.max(0, dist);
    }
    return run;
  }

  function nextSafe(pd) {
    for (const r of gen.rows) if (r.d > pd + 5) return r.safe;
    return 1;
  }

  // ---------------------------------------------------------------- gameplay events

  function doAction(a) {
    if (a === 'board') return useBoard();
    const r = applyAction(P, a, obs);
    if (r === 'stumble' && G.soak) {
      G.soak.log.push({
        a, lane: P.lane, y: +P.y.toFixed(2), grounded: P.grounded, safe: nextSafe(P.pd),
        near: obs.filter((o) => !o.dead && o.d1 > P.pd - 3 && o.d0 < P.pd + 45)
          .map((o) => `${o.type}${o.moving ? '(mv)' : ''}${o.ramp ? '(r)' : ''} L${o.lane} ${(o.d0 - P.pd).toFixed(1)}..${(o.d1 - P.pd).toFixed(1)}`),
      });
    }
    if (r === 'switch') sfx('swipe');
    else if (r === 'stumble') stumble();
    else if (r === 'wall') {
      G.shake = Math.max(G.shake, 0.12);
      sfx('bump');
    } else if (r === 'jump') sfx('jump');
    else if (r === 'roll') sfx('roll');
  }

  function useBoard() {
    if (G.state !== 'playing' || P.boardT > 0 || G.boards <= 0) return;
    G.boards--;
    P.boardT = DUR.boardT;
    sfx('board');
    toast('HOVERBOARD!');
  }

  function stumble() {
    G.shake = Math.max(G.shake, 0.35);
    if (tommyGuarding()) return sfx('bump'); // with Tommy along a bump is just a bump
    if (G.soak) G.soak.stumbles++;
    if (G.stumbleT > 0) return crash(null); // second bump while the inspector is on your heels
    sfx('stumble');
    G.stumbleT = 7;
    G.chaseT = 7;
    toast('WATCH OUT!', 'warn');
  }

  function onHit(o) {
    if (tommyGuarding()) {
      P.invT = 1.0;
      smash(o);
      sfx('boardBreak');
      toast(`${BUDDY.name} SAVED YOU!`);
      G.shake = 0.5;
      buddy.cheerT = 1.2;
      return;
    }
    if (P.boardT > 0) {
      P.boardT = 0;
      P.invT = 1.2;
      smash(o);
      sfx('boardBreak');
      toast('BOARD SAVED YOU!');
      G.shake = 0.6;
      return;
    }
    crash(o);
  }

  function smash(o) {
    o.dead = true;
    o.mesh.visible = false;
    if (o.ramp) {
      o.ramp.dead = true;
      o.ramp.mesh.visible = false;
    }
    const z = -Math.max(o.d0, P.pd + 1);
    particles.emit(LANE_X[o.lane], 1.6, z, 50, { color: '#ffd400', spread: 1, speed: 6, up: 9, life: 0.9 });
    particles.emit(LANE_X[o.lane], 1.6, z, 40, { color: '#18d4ff', spread: 1, speed: 6, up: 9, life: 0.9 });
  }

  function crash(o) {
    if (G.soak) {
      G.soak.crashes.push({ t: +G.runT.toFixed(1), type: o ? o.type : 'double-stumble', lane: o ? o.lane : P.lane, moving: !!(o && o.moving), speed: +G.speed.toFixed(1) });
      if (o) smash(o);
      P.invT = 0.6;
      G.stumbleT = 0;
      return;
    }
    G.state = 'dying';
    G.dyingT = 0;
    G.shake = 1;
    sfx('crash');
    particles.emit(P.x, P.y + 1.2, -P.pd - 0.5, 40, { color: '#ffffff', spread: 0.6, speed: 5, up: 6, life: 0.7 });
  }

  function onLand() {
    particles.emit(P.x, P.y + 0.05, -P.pd, 10, { color: '#c9b9a6', spread: 0.4, speed: 2.5, up: 2.5, life: 0.5, gravity: 6 });
    sfx('land');
    if (P.y >= TRAIN_TOP - 0.1 && G.surfT <= 0) {
      toast('TRAIN SURFER!');
      G.surfT = 25;
    }
  }

  function onTrainStart(o) {
    o.mesh.position.z = -o.d0;
    if (G.state === 'playing') sfx('horn', o.lane === P.lane ? 1 : 0.5);
  }

  function takeCoin(c) {
    c.taken = true;
    scene.remove(c.mesh);
    G.coins++;
    G.score += 10 * (P.multT > 0 ? 2 : 1);
    G.streak++;
    G.streakT = 0.7;
    sfx('coin', G.streak);
    const p = c.mesh.position;
    particles.emit(p.x, p.y, p.z, 6, { color: '#ffe066', spread: 0.3, speed: 2.5, up: 4, life: 0.45, gravity: 4, vz: -G.speed * 0.85 });
    if (ui.coinIcon && !G.attract && !G.soak) ui.coinIcon.animate([{ transform: 'scale(1.4)' }, { transform: 'scale(1)' }], { duration: 180 });
  }

  function takeItem(it) {
    it.taken = true;
    scene.remove(it.mesh);
    if (it.type === 'letter') return takeLetter(it);
    if (it.type === 'zombie') return zombieHit();
    sfx('powerup');
    const p = it.mesh.position;
    particles.emit(p.x, p.y, p.z, 30, { color: A.POWERUPS[it.type].color, spread: 0.5, speed: 4, up: 6, life: 0.7, vz: -G.speed * 0.8 });
    toast(A.POWERUPS[it.type].label);
    if (it.type === 'board') {
      G.boards++;
      return;
    }
    const key = POWER_KEY[it.type];
    P[key] = DUR[key];
    if (it.type === 'jet') {
      P.rollT = 0;
      skyCoins();
      sfx('jet');
    }
  }

  function collect(dt) {
    const px = P.x, py = P.y + 0.9, pz = -P.pd;
    for (const c of coins) {
      if (c.taken) continue;
      const ahead = c.d - P.pd;
      if (ahead > 14 || ahead < -4) continue;
      const m = c.mesh.position;
      if (P.magT > 0 && ahead > -1) c.mag = true;
      if (c.mag) {
        // fly to the player in player-relative space so the coin always arrives
        if (!c.rel) c.rel = new T.Vector3(m.x - px, m.y - py, m.z - pz);
        c.rel.multiplyScalar(1 - damp(9, dt));
        m.set(px + c.rel.x, py + c.rel.y, pz + c.rel.z);
        if (c.rel.lengthSq() < 0.6) takeCoin(c);
      } else if (Math.abs(ahead) < 0.9 && Math.abs(m.x - px) < 1.0 && Math.abs(c.y - py) < 1.3) {
        takeCoin(c);
      }
    }
    for (const it of items) {
      if (it.taken) continue;
      if (Math.abs(it.d - P.pd) < 1.1 && Math.abs(LANE_X[it.lane] - px) < 1.1 && Math.abs(it.y - py) < 1.6) takeItem(it);
    }
  }

  // ---------------------------------------------------------------- simulation tick

  function runTick(dt) {
    G.runT += dt;
    G.speed = speedAt(G.runT);
    for (const k of ['magT', 'sneakT', 'multT', 'boardT']) if (P[k] > 0) P[k] = Math.max(0, P[k] - dt);
    G.stumbleT = Math.max(0, G.stumbleT - dt);
    G.chaseT = Math.max(0, G.chaseT - dt);
    G.surfT -= dt;
    G.streakT -= dt;
    if (G.streakT <= 0) G.streak = 0;

    moveTrains(obs, P.pd, dt, onTrainStart);
    for (const o of obs) if (o.active) o.mesh.position.z = -o.d0;

    if (G.auto) autopilot(dt);

    const res = stepPlayer(P, dt, G.speed, obs);
    trail.push({ pd: P.pd, y: P.y, air: !P.grounded, roll: P.rollT > 0 });
    if (trail.length > 150) trail.shift();
    if (res.landed) onLand();
    if (res.hit) {
      onHit(res.hit);
      if (G.state === 'dying') return;
    }
    collect(dt);
    while (gen.d < P.pd + SPAWN_AHEAD) genRow();
    cleanup();
    G.score += G.speed * dt * 0.5 * (P.multT > 0 ? 2 : 1);
  }

  function dyingTick(dt) {
    G.dyingT += dt;
    if (G.dyingT < 0.3) P.pd -= (0.3 - G.dyingT) * 10 * dt; // knocked back a step
    P.vy -= GRAVITY * dt;
    P.y += P.vy * dt;
    const g = surfaceAt(P.lane, P.pd, P.y + 0.5, obs);
    if (P.y < g) {
      P.y = g;
      P.vy = 0;
    }
    if (G.dyingT > 1.5) {
      if (G.attract) startAttract();
      else gameOver();
    }
  }

  function tick(dt) {
    G.t += dt;
    if (G.state === 'playing' || G.state === 'title') runTick(dt);
    else if (G.state === 'dying') dyingTick(dt);
    particles.update(dt);
  }

  // ---------------------------------------------------------------- run lifecycle

  function resetRun() {
    for (const o of obs) scene.remove(o.mesh);
    for (const c of coins) scene.remove(c.mesh);
    for (const it of items) scene.remove(it.mesh);
    obs.length = coins.length = items.length = 0;
    Object.assign(P, newPlayer());
    Object.assign(gen, { d: 55, safe: 1, rows: [], laneEnd: [-1e9, -1e9, -1e9], n: 0, sincePower: 0, sinceZombie: 6 });
    G.freezeT = 0;
    Object.assign(G, { runT: 0, speed: speedAt(0), score: 0, coins: 0, boards: 2, stumbleT: 0, chaseT: 2.8, dyingT: 0, streak: 0, streakT: 0, surfT: 0, shake: 0 });
    Object.assign(chase, { dist: 4.2, x: 0, y: 0 });
    segs.forEach((s, i) => { s.position.z = SEG_LEN * 0.5 - i * SEG_LEN; });
    cam.x = 0;
    cam.y = 0;
    playerM.root.rotation.set(0, 0, 0);
    playerM.rig.rotation.set(0, 0, 0);
    trail.length = 0;
    if (buddy.on) dismissBuddy();
    dropTreat();
    while (gen.d < P.pd + SPAWN_AHEAD) genRow();
  }

  function startAttract() {
    G.attract = true;
    G.auto = true;
    resetRun();
    G.state = 'title';
  }

  function startGame() {
    if (G.state !== 'title' && G.state !== 'over') return;
    if (G.state === 'over' && performance.now() - overAt < 600) return; // don't restart from a mashed key
    S.init();
    S.music('play');
    G.attract = false;
    resetRun();
    G.state = 'playing';
    G.auto = G.userAuto;
    G.assisted = G.auto;
    show('title', false);
    show('over', false);
    show('hud', true);
    sfx('click');
    toast(`GO ${avatar.name}!`);
  }

  function gameOver() {
    G.state = 'over';
    overAt = performance.now();
    const score = Math.floor(G.score);
    const isBest = !G.assisted && score > bestOf(avatar.id);
    if (isBest) store.set('best.' + avatar.id, score);
    store.set('coinsTotal', store.get('coinsTotal', 0) + G.coins);
    $('ovScore').textContent = score.toLocaleString();
    $('ovCoins').textContent = G.coins.toLocaleString();
    refreshBests();
    $('newBest').classList.toggle('on', isBest);
    $('autoNote').classList.toggle('on', G.assisted);
    show('hud', false);
    show('over', true);
    S.music('over');
  }

  function togglePause() {
    if (G.state === 'playing') {
      G.state = 'paused';
      show('pause', true);
      S.music('pause');
    } else if (G.state === 'paused') {
      G.state = 'playing';
      show('pause', false);
      S.music('play');
      last = performance.now();
    }
  }

  function toggleAuto() {
    G.userAuto = !G.userAuto;
    ui.autoBtn.classList.toggle('on', G.userAuto);
    if (G.state !== 'playing' && G.state !== 'paused') return;
    G.auto = G.userAuto;
    if (G.auto) G.assisted = true;
    toast(G.auto ? 'CLAUDE IS DRIVING' : 'YOUR CONTROL');
  }

  function toggleMute() {
    const m = S.toggleMute();
    ui.muteBtn.textContent = m ? '🔇' : '🔊';
  }

  // A human move takes the wheel back from the autopilot.
  function humanAction(a) {
    if (G.state !== 'playing') return;
    if (G.auto && a !== 'board') {
      G.auto = G.userAuto = false;
      ui.autoBtn.classList.remove('on');
    }
    doAction(a);
  }

  // ---------------------------------------------------------------- avatars
  // Every runner is a "player" with its own best score. Picking one swaps the model live, even mid-attract-mode.

  const AVATARS = window.MetroAvatars;
  let avatar = AVATARS[0];
  const bestOf = (id) => store.get('best.' + id, 0);

  function setAvatar(id, picked) {
    avatar = AVATARS.find((a) => a.id === id) || AVATARS[0];
    store.set('avatar', avatar.id);
    const old = playerM;
    playerM = A.buildPerson(avatar.look);
    playerM.root.add(boardM); // re-parents the hoverboard and jetpack onto the new model
    playerM.hips.add(jetM);
    if (treat.holdT > 0) playerM.armR.add(treat.sprite);
    scene.add(playerM.root);
    if (old) {
      scene.remove(old.root);
      old.root.traverse((o) => {
        if (o.isMesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((mt) => mt.dispose());
        }
      });
    }
    if (picked) {
      S.init();
      if (avatar.scare) playScare();
      else S.click();
    }
    document.querySelectorAll('.avatar').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id === avatar.id)));
    refreshBests();
  }

  function refreshBests() {
    const best = bestOf(avatar.id).toLocaleString();
    $('bestName').textContent = avatar.name;
    $('bestTitle').textContent = best;
    $('ovBestLabel').textContent = `${avatar.name}'S BEST`;
    $('ovBest').textContent = best;
    document.querySelectorAll('.avatar').forEach((b) => { b.querySelector('.bs').textContent = bestOf(b.dataset.id).toLocaleString(); });
  }

  // Portrait thumbnails: render each runner from the front with a throwaway renderer, keep the PNGs.
  // A runner with `scare` also gets four full-body walk frames for the scare flipbook.
  let scareFrames = [], scareTimer = 0, scareEnd = 0;
  function avatarThumbs() {
    const size = 152;
    const r = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1);
    r.setSize(size, size, false);
    r.outputEncoding = T.sRGBEncoding;
    const sc = new T.Scene();
    sc.add(new T.HemisphereLight('#ffffff', '#8a6e58', 0.9));
    const key = new T.DirectionalLight('#fff4e0', 1.1);
    key.position.set(-1.5, 3, -3);
    sc.add(key);
    const cam = new T.PerspectiveCamera(30, 1, 0.1, 20);
    cam.position.set(0.8, 1.95, -2.6);
    cam.lookAt(0, 1.68, 0);
    const out = {};
    for (const av of AVATARS.concat([BUDDY])) {
      const p = A.buildPerson(av.look);
      A.posePerson(p, 0, av.pose || 'idle', 1);
      p.hips.rotation.x = 0;
      sc.add(p.root);
      if (av.pose) { // arms up: pull back so the hands fit
        cam.position.set(0.6, 1.95, -3.6);
        cam.lookAt(0, 1.8, 0);
      }
      r.render(sc, cam);
      cam.position.set(0.8, 1.95, -2.6);
      cam.lookAt(0, 1.68, 0);
      out[av.id] = r.domElement.toDataURL('image/png');
      if (av.scare) {
        r.setSize(300, 400, false);
        const full = new T.PerspectiveCamera(35, 300 / 400, 0.1, 20);
        full.position.set(0, 1.25, -4.4);
        full.lookAt(0, 1.05, 0);
        const ghoul = new T.HemisphereLight('#c8ffb0', '#20301a', 0.6);
        sc.add(ghoul);
        for (let i = 0; i < 4; i++) {
          A.posePerson(p, (i * Math.PI) / 2, 'walk', 1);
          p.root.rotation.y = Math.sin((i * Math.PI) / 2) * 0.15;
          r.render(sc, full);
          scareFrames.push(r.domElement.toDataURL('image/png'));
        }
        sc.remove(ghoul);
        r.setSize(size, size, false);
      }
      sc.remove(p.root);
    }
    r.dispose();
    r.forceContextLoss();
    return out;
  }

  function playScare() {
    if (!scareFrames.length) return;
    const el = $('scare'), img = el.querySelector('img'), boo = el.querySelector('.boo');
    clearInterval(scareTimer);
    clearTimeout(scareEnd);
    el.classList.remove('on');
    for (const n of [img, boo]) { // restart the CSS animations from the top
      n.style.animation = 'none';
      void n.offsetWidth;
      n.style.animation = '';
    }
    let f = 0;
    img.src = scareFrames[0];
    el.classList.add('on');
    scareTimer = setInterval(() => { img.src = scareFrames[++f % scareFrames.length]; }, 170);
    S.groan();
    scareEnd = setTimeout(() => {
      clearInterval(scareTimer);
      el.classList.remove('on');
    }, 3000);
  }

  // The zombie card on the track: time stops while he lurches at the screen, so it can never cost you the run.
  function zombieHit() {
    G.freezeT = 3.0;
    P.invT = Math.max(P.invT, 1.5);
    playScare();
  }

  function buildPicker() {
    const thumbs = avatarThumbs();
    const row = $('picker');
    for (const av of AVATARS) {
      const b = document.createElement('button');
      b.className = 'avatar';
      b.dataset.id = av.id;
      b.setAttribute('role', 'radio');
      b.innerHTML = `<img alt="" src="${thumbs[av.id]}"><span class="nm">${av.name}</span><span class="bs">0</span>`;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        setAvatar(av.id, true);
        b.blur();
      });
      row.appendChild(b);
    }
    const b = document.createElement('button');
    b.className = 'avatar buddy';
    b.id = 'buddyCard';
    b.innerHTML = `<img alt="" src="${thumbs[BUDDY.id]}"><span class="nm">${BUDDY.name}</span><span class="bs">TAP ME!</span>`;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      S.init();
      S.click();
      callBuddy();
      b.blur();
    });
    row.appendChild(b);
    $('buddyFace').src = thumbs[BUDDY.id];
    $('pwBuddyFace').src = thumbs[BUDDY.id];
  }

  // Every tap brings Tommy. Tapping again once he's handed over his treat makes him pose and give another one.
  function callBuddy() {
    if (G.state !== 'playing' && G.state !== 'title') return;
    if (!buddy.on) return summonBuddy();
    if (buddy.t > 4.8) {
      buddy.t = 1.0;
      buddy.given = false;
    }
  }

  // ---------------------------------------------------------------- Word Hunt
  // Letters of the current word appear on the track one at a time, in order. Spelling the word pays 100 coins plus
  // the word's reward, then the next word starts. Progress is saved between runs (not on the attract screen).

  const WORDS = window.MetroWords;
  const hunt = { i: store.get('word.i', 0) % WORDS.length, got: store.get('word.got', 0), done: store.get('word.done', 0), sinceRows: 0 };
  const REWARD = {
    board: '+1 HOVERBOARD', tommy: 'TOMMY JOINS YOU!', mult: '2× SCORE!', sneakers: 'SUPER SNEAKERS!',
    magnet: 'COIN MAGNET!', jet: 'JETPACK!', coins: '+100 MORE COINS',
  };
  const word = () => WORDS[hunt.i].word;

  function wantLetter() {
    return G.state === 'playing' && !G.soak && hunt.sinceRows >= 5 && !items.some((it) => it.type === 'letter');
  }

  function placeLetter(lane, d) {
    const letter = word()[hunt.got];
    const mesh = A.buildLetter(letter);
    mesh.position.set(LANE_X[lane], 1.4, -d);
    scene.add(mesh);
    items.push({ type: 'letter', letter, lane, d, y: 1.4, mesh, taken: false });
    hunt.sinceRows = 0;
  }

  function takeLetter(it) {
    hunt.got++;
    sfx('coin', 14);
    sfx('click');
    const p = it.mesh.position;
    particles.emit(p.x, p.y, p.z, 24, { color: '#ffd400', spread: 0.4, speed: 3, up: 5, life: 0.6, vz: -G.speed * 0.8 });
    particles.emit(p.x, p.y, p.z, 16, { color: '#ff3d7f', spread: 0.4, speed: 3, up: 5, life: 0.6, vz: -G.speed * 0.8 });
    if (hunt.got >= word().length) completeWord();
    else toast(`${it.letter}!`);
    saveHunt();
    renderWord(true);
  }

  function completeWord() {
    const w = WORDS[hunt.i];
    G.coins += 100;
    G.score += 1000 * (P.multT > 0 ? 2 : 1);
    if (w.reward === 'board') G.boards++;
    else if (w.reward === 'tommy') summonBuddy();
    else if (w.reward === 'coins') G.coins += 100;
    else if (POWER_KEY[w.reward]) {
      const key = POWER_KEY[w.reward];
      P[key] = DUR[key];
      if (w.reward === 'jet') skyCoins();
    }
    toast(`${w.word}! 🎉`);
    toast(`+100 COINS · ${REWARD[w.reward] || ''}`);
    sfx('powerup');
    for (const color of ['#ffd400', '#ff3d7f', '#18d4ff', '#7cff4f']) {
      particles.emit(P.x, P.y + 1.5, -P.pd - 1, 30, { color, spread: 1.2, speed: 6, up: 10, life: 1.1, vz: -G.speed * 0.9 });
    }
    hunt.done++;
    hunt.i = (hunt.i + 1) % WORDS.length;
    hunt.got = 0;
  }

  function saveHunt() {
    store.set('word.i', hunt.i);
    store.set('word.got', hunt.got);
    store.set('word.done', hunt.done);
  }

  // Letter cells for the HUD bar and the title screen: collected letters lit, the next one outlined.
  function renderWord(pop) {
    const w = word();
    const html = [...w].map((ch, k) => `<i class="${k < hunt.got ? 'got' : k === hunt.got ? 'next' : ''}${pop && k === hunt.got - 1 ? ' pop' : ''}">${ch}</i>`).join('');
    $('wordBar').innerHTML = html;
    $('huntTitle').innerHTML = html;
    $('huntDone').textContent = hunt.done ? `· ${hunt.done} spelled` : '';
  }

  // ---------------------------------------------------------------- Tommy, the buddy
  // Tap his card, his button or T and he runs along behind the runner for ~10 s, copying the runner's jumps and rolls
  // a beat later. He strikes his Y pose to say hi, sprints up to hand over a treat, poses again and drops back.
  // Purely visual: no effect on the run.

  const BUDDY = window.MetroBuddy;
  const TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE BOX'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];
  const buddy = { m: null, tag: null, on: false, t: 0, x: 0, y: 0, dz: 16, ph: 0, given: false, cheerT: 0 };
  const treat = { sprite: null, flyT: -1, holdT: 0, from: new T.Vector3() };
  const trail = []; // the runner's recent heights, so Tommy can copy them when he reaches the same spot

  function buildBuddy() {
    buddy.m = A.buildPerson(BUDDY.look);
    buddy.m.root.scale.setScalar(BUDDY.scale);
    buddy.tag = A.nameTag(BUDDY.name, '#ffb02e');
    buddy.tag.position.y = 2.75;
    buddy.m.root.add(buddy.tag);
    buddy.m.root.visible = false;
    treat.sprite = new T.Sprite(new T.SpriteMaterial({ depthWrite: false }));
    treat.sprite.visible = false;
    scene.add(buddy.m.root, treat.sprite);
  }

  const GUARD_UNTIL = 9.6; // seconds into his visit when he starts dropping back
  const tommyGuarding = () => buddy.on && buddy.t < GUARD_UNTIL;

  function summonBuddy() {
    if (buddy.on) return;
    Object.assign(buddy, { on: true, t: 0, dz: 16, x: P.x, given: false });
    buddy.m.root.visible = true;
    toast(`${BUDDY.name}'S HERE!`);
  }

  function dismissBuddy() {
    buddy.on = false;
    buddy.m.root.visible = false;
  }

  function giveTreat() {
    const [emoji, label] = pick(TREATS);
    treat.sprite.material.map = A.emojiTexture(emoji);
    treat.sprite.material.needsUpdate = true;
    buddy.m.armR.localToWorld(treat.from.set(0, -0.7, 0));
    scene.add(treat.sprite);
    treat.sprite.position.copy(treat.from);
    treat.sprite.scale.setScalar(0.6);
    treat.sprite.visible = true;
    treat.flyT = 0;
    toast(`${emoji} ${label} FROM ${BUDDY.name}!`);
    sfx('powerup');
  }

  const handPos = new T.Vector3();
  function updateTreat(dt) {
    if (treat.flyT >= 0) {
      // arc from Tommy's hand into the runner's hand
      treat.flyT += dt / 0.55;
      playerM.armR.localToWorld(handPos.set(0, -0.72, 0));
      const k = Math.min(1, treat.flyT);
      treat.sprite.position.lerpVectors(treat.from, handPos, k);
      treat.sprite.position.y += Math.sin(k * Math.PI) * 1.2;
      if (k >= 1) {
        treat.flyT = -1;
        treat.holdT = 9;
        playerM.armR.add(treat.sprite);
        treat.sprite.position.set(0.14, -0.8, 0.2); // camera side of the hand, so it isn't hidden behind the arm
        treat.sprite.scale.setScalar(0.62);
        particles.emit(handPos.x, handPos.y, handPos.z, 14, { color: '#ffffff', spread: 0.3, speed: 2, up: 3, life: 0.5, vz: -G.speed * 0.8 });
      }
    } else if (treat.holdT > 0) {
      treat.holdT -= dt;
      if (treat.holdT <= 0) dropTreat();
    }
  }

  function dropTreat() {
    treat.flyT = -1;
    treat.holdT = 0;
    treat.sprite.visible = false;
    scene.add(treat.sprite);
  }

  function updateBuddy(dt) {
    updateTreat(dt);
    if (!buddy.on) return;
    buddy.t += dt;
    const t = buddy.t;
    // how far behind the runner he wants to be: run in, keep pace, sprint up for the hand-off, keep pace, drop back
    const target = t < 3.3 ? 1.6 : t < 4.6 ? 0.35 : t < GUARD_UNTIL ? 1.6 : 20;
    buddy.dz += (target - buddy.dz) * damp(t >= GUARD_UNTIL ? 1.0 : 3, dt);
    const side = P.lane === 2 ? -1 : 1; // stay on the side toward the middle
    buddy.x += (P.x + side * 0.95 - buddy.x) * damp(5, dt);
    const bd = P.pd - buddy.dz;
    let y = 0, air = false, roll = false;
    for (let i = trail.length - 1; i >= 0; i--) {
      if (trail[i].pd <= bd) {
        ({ y, air, roll } = trail[i]);
        break;
      }
    }
    buddy.y += (y - buddy.y) * damp(25, dt);
    buddy.ph += dt * (G.state === 'playing' || G.state === 'title' ? G.speed * 0.5 : 4);
    const giving = t > 3.9 && t < 4.6;
    buddy.cheerT = Math.max(0, buddy.cheerT - dt);
    const posing = (t > 1.2 && t < 2.6) || t > 8.2 || buddy.cheerT > 0; // Y pose: hi, bye, and after saving you
    const mode = roll ? 'roll' : air ? 'jump' : giving ? 'give' : posing ? BUDDY.pose || 'wave' : 'run';
    A.posePerson(buddy.m, buddy.ph, mode, damp(20, dt));
    buddy.m.root.position.set(buddy.x, buddy.y, -bd);
    if (!buddy.given && t > 4.3) {
      buddy.given = true;
      giveTreat();
    }
    if (t > 12.5) dismissBuddy();
  }

  // ---------------------------------------------------------------- UI

  const $ = (id) => document.getElementById(id);
  const show = (id, on) => $(id).classList.toggle('hidden', !on);
  const hudCache = {};
  const setText = (el, key, v) => {
    if (hudCache[key] !== v) {
      hudCache[key] = v;
      el.textContent = v;
    }
  };

  function toast(text, cls) {
    if (G.attract || G.soak) return;
    const el = document.createElement('div');
    el.className = 'toast' + (cls ? ' ' + cls : '');
    el.textContent = text;
    ui.toasts.appendChild(el);
    setTimeout(() => el.remove(), 1300);
    while (ui.toasts.children.length > 3) ui.toasts.firstChild.remove();
  }

  function updateHud() {
    if (G.state !== 'playing' && G.state !== 'paused' && G.state !== 'dying') return;
    setText(ui.score, 'score', Math.floor(G.score).toLocaleString());
    setText(ui.coins, 'coins', String(G.coins));
    setText(ui.boards, 'boards', String(G.boards));
    ui.mult.classList.toggle('on', P.multT > 0);
    ui.boardBtn.classList.toggle('empty', G.boards <= 0 || P.boardT > 0);
    for (const [key, el] of Object.entries(ui.bars)) {
      const t = P[key];
      el.row.classList.toggle('on', t > 0);
      if (t > 0) el.fill.style.transform = `scaleX(${clamp(t / DUR[key], 0, 1)})`;
    }
    ui.autoBadge.classList.toggle('on', G.auto && G.state === 'playing');
    const guarding = tommyGuarding();
    ui.buddyRow.classList.toggle('on', guarding);
    ui.buddyBtn.classList.toggle('guarding', guarding);
    if (guarding) ui.buddyFill.style.transform = `scaleX(${clamp(1 - buddy.t / GUARD_UNTIL, 0, 1)})`;
  }

  // ---------------------------------------------------------------- particles

  function makeParticles(n) {
    const geo = new T.BufferGeometry();
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 4);
    const vel = new Float32Array(n * 3), life = new Float32Array(n), maxLife = new Float32Array(n), grav = new Float32Array(n);
    for (let i = 0; i < n; i++) pos[i * 3 + 1] = -999;
    geo.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage));
    geo.setAttribute('color', new T.BufferAttribute(col, 4).setUsage(T.DynamicDrawUsage));
    const mat = new T.PointsMaterial({ size: 0.32, map: A.dotTexture, vertexColors: true, transparent: true, depthWrite: false });
    const points = new T.Points(geo, mat);
    points.frustumCulled = false;
    const color = new T.Color();
    let next = 0, alive = 0;
    return {
      obj: points,
      emit(x, y, z, count, o) {
        color.set(o.color);
        for (let k = 0; k < count; k++) {
          const i = next;
          next = (next + 1) % n;
          pos[i * 3] = x + rand(-o.spread, o.spread);
          pos[i * 3 + 1] = y + rand(-o.spread, o.spread) * 0.5;
          pos[i * 3 + 2] = z + rand(-o.spread, o.spread);
          vel[i * 3] = rand(-o.speed, o.speed);
          vel[i * 3 + 1] = rand(o.up * 0.4, o.up);
          vel[i * 3 + 2] = rand(-o.speed, o.speed) + (o.vz || 0);
          life[i] = maxLife[i] = rand(o.life * 0.6, o.life);
          grav[i] = o.gravity !== undefined ? o.gravity : 12;
          col[i * 4] = color.r;
          col[i * 4 + 1] = color.g;
          col[i * 4 + 2] = color.b;
          col[i * 4 + 3] = 1;
        }
        alive = n;
      },
      update(dt) {
        if (!alive) return;
        let live = 0;
        for (let i = 0; i < n; i++) {
          if (life[i] <= 0) continue;
          life[i] -= dt;
          if (life[i] <= 0) {
            pos[i * 3 + 1] = -999;
            col[i * 4 + 3] = 0;
            continue;
          }
          live++;
          vel[i * 3 + 1] -= grav[i] * dt;
          pos[i * 3] += vel[i * 3] * dt;
          pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
          pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
          col[i * 4 + 3] = Math.min(1, (life[i] / maxLife[i]) * 1.6);
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.color.needsUpdate = true;
        if (!live) alive = 0;
      },
    };
  }

  // ---------------------------------------------------------------- rendering

  function render(dt) {
    const t = G.t;
    const running = G.state === 'playing' || G.state === 'title';
    const caught = G.state === 'dying' || G.state === 'over';

    // runner
    if (running) runPhase += dt * G.speed * 0.42;
    let mode = 'run';
    if (caught) mode = 'fall';
    else if (P.jetT > 0) mode = 'jet';
    else if (P.rollT > 0) mode = 'roll';
    else if (!P.grounded) mode = 'jump';
    A.posePerson(playerM, runPhase, mode, damp(20, dt));
    playerM.rig.rotation.x = mode === 'roll' ? -Math.PI * 2 * (1 - P.rollT / ROLL_DUR) : 0;
    const hover = P.boardT > 0 ? 0.3 + Math.sin(t * 7) * 0.05 : 0;
    playerM.root.position.set(P.x, P.y + hover, -P.pd);
    playerM.root.rotation.z = clamp((P.x - LANE_X[P.lane]) * 0.15, -0.4, 0.4);
    playerM.root.visible = !(P.invT > 0 && G.state === 'playing' && Math.floor(t * 14) % 2 === 0);
    boardM.visible = P.boardT > 0;
    jetM.visible = P.jetT > 0;
    if (P.jetT > 0) {
      for (const f of jetM.userData.flames) f.scale.set(1, 0.7 + Math.random() * 0.6, 1);
      if (running) particles.emit(P.x, P.y + 0.6, -P.pd + 0.35, 2, { color: '#ff9f1c', spread: 0.12, speed: 0.6, up: -3, life: 0.35, gravity: 0, vz: -G.speed * 0.4 });
    }

    // inspector and dog: close behind while chasing, off-screen otherwise
    const target = caught ? 1.7 : G.chaseT > 0 ? 4.2 : 18; // at 4.2 only his head and shoulders show, below the runner
    chase.dist += (target - chase.dist) * damp(target < chase.dist ? 2.2 : 0.7, dt);
    chase.x += (P.x - chase.x) * damp(3, dt);
    const chaseD = P.pd - chase.dist;
    const chaseLane = Math.round(chase.x / LANE_W) + 1;
    chase.y += (surfaceAt(clamp(chaseLane, 0, 2), chaseD, 99, obs) - chase.y) * damp(10, dt);
    const grabbing = caught && chase.dist < 2.3;
    chase.ph += dt * (grabbing ? 3 : G.speed * 0.42);
    inspectorM.root.visible = dogM.root.visible = chase.dist < 15;
    inspectorM.root.position.set(chase.x, chase.y, -chaseD);
    A.posePerson(inspectorM, chase.ph, grabbing ? 'grab' : 'run', damp(15, dt));
    dogM.root.position.set(chase.x + (chase.x > 0 ? -0.95 : 0.95), chase.y, -chaseD - 0.6);
    A.poseDog(dogM, grabbing ? chase.ph * 0.5 : chase.ph * 1.2);

    updateBuddy(dt);

    // pickups spin and bob
    const spin = t * 3.2;
    for (const c of coins) c.mesh.rotation.y = spin;
    for (const it of items) {
      it.mesh.position.y = it.y + Math.sin(t * 3 + it.d) * 0.15;
      if (it.mesh.userData.ring) it.mesh.userData.ring.rotation.set(Math.PI / 2 + Math.sin(t * 2) * 0.4, t * 2, 0);
      else it.mesh.userData.tile.scale.setScalar(1.15 + Math.sin(t * 5) * 0.07);
    }

    // camera: behind and above while running, swings round to the side when you're caught
    cam.x += (P.x - cam.x) * damp(7, dt);
    cam.y += (P.y - cam.y) * damp(P.jetT > 0 ? 2.5 : 5, dt);
    if (caught) {
      const k = damp(2.5, dt);
      cam.pos.lerp(new T.Vector3(P.x + 3.2, 2.9 + P.y, -P.pd + 5.8), k);
      cam.look.lerp(new T.Vector3(P.x, 1.1 + P.y, -P.pd + 1.2), k);
    } else {
      cam.pos.set(cam.x * 0.85, 5.3 + cam.y * 0.8, -P.pd + 8.5);
      cam.look.set(cam.x * 0.6, 1.5 + cam.y * 0.85, -P.pd - 12);
    }
    camera.position.copy(cam.pos);
    if (G.shake > 0) {
      camera.position.x += rand(-1, 1) * G.shake * 0.35;
      camera.position.y += rand(-1, 1) * G.shake * 0.25;
      G.shake = Math.max(0, G.shake - dt * 2.2);
    }
    camera.lookAt(cam.look);
    const aspect = camera.aspect;
    let fov = 60 + (G.speed - START_SPEED) * 0.6 + (P.jetT > 0 ? 5 : 0);
    fov = Math.max(fov, T.MathUtils.radToDeg(2 * Math.atan(Math.tan(T.MathUtils.degToRad(23)) / aspect))); // keep 3 lanes in view in portrait
    cam.fov += (fov - cam.fov) * damp(3, dt);
    camera.fov = cam.fov;
    camera.updateProjectionMatrix();

    // light, sky and scenery follow the player
    sun.position.set(P.x - 14, 32, -P.pd + 12);
    sun.target.position.set(P.x, 0, -P.pd - 18);
    sky.position.copy(camera.position);
    clouds.position.set(camera.position.x * 0.5, 0, camera.position.z);
    for (const s of segs) {
      if (s.position.z - SEG_LEN > camera.position.z + 10) {
        s.position.z -= SEG_LEN * segs.length;
        A.reskinSegment(s);
      }
    }

    updateHud();
    renderer.render(scene, camera);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    if (G.freezeT > 0) {
      G.freezeT -= dt; // frozen while the zombie scare plays
      return render(0);
    }
    if (G.state !== 'paused') {
      const n = Math.max(1, Math.ceil(dt * 60 - 0.01)); // fixed-ish 60 Hz substeps
      for (let i = 0; i < n; i++) tick(dt / n);
    }
    render(G.state === 'paused' ? 0 : dt);
  }

  // ---------------------------------------------------------------- input

  const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', ArrowDown: 'roll', KeyS: 'roll', KeyB: 'board' };

  function bindInput() {
    window.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === 'KeyM') return toggleMute();
      if (e.code === 'KeyC') return toggleAuto();
      if (e.code === 'KeyT') return callBuddy();
      if (e.code === 'KeyP' || e.code === 'Escape') return togglePause();
      if (G.state === 'title' || G.state === 'over') {
        if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp') {
          e.preventDefault();
          startGame();
        } else if (G.state === 'title' && /^(ArrowLeft|ArrowRight|KeyA|KeyD)$/.test(e.code)) {
          e.preventDefault();
          const i = AVATARS.indexOf(avatar) + (/Left|KeyA/.test(e.code) ? -1 : 1);
          setAvatar(AVATARS[(i + AVATARS.length) % AVATARS.length].id, true);
        }
        return;
      }
      if (G.state === 'paused') {
        if (e.code === 'Space' || e.code === 'Enter') togglePause();
        return;
      }
      const a = KEYS[e.code];
      if (a) {
        e.preventDefault();
        if (!e.repeat) humanAction(a);
      }
    });

    // touch: swipe to move, tap to start, double-tap for the hoverboard
    let touch = null, lastTap = 0;
    const onUi = (e) => e.target.closest && e.target.closest('button');
    window.addEventListener('touchstart', (e) => {
      if (onUi(e)) return;
      const p = e.changedTouches[0];
      touch = { x: p.clientX, y: p.clientY, fired: false };
      if (G.state === 'playing') e.preventDefault();
    }, { passive: false });
    window.addEventListener('touchmove', (e) => {
      if (G.state === 'playing') e.preventDefault();
      if (!touch || touch.fired) return;
      const p = e.changedTouches[0];
      const dx = p.clientX - touch.x, dy = p.clientY - touch.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
      touch.fired = true;
      humanAction(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'jump' : 'roll');
    }, { passive: false });
    window.addEventListener('touchend', (e) => {
      if (onUi(e) || !touch) return;
      const tapped = !touch.fired;
      touch = null;
      if (!tapped) return;
      if (G.state === 'title' || G.state === 'over') return startGame();
      const now = performance.now();
      if (now - lastTap < 300) humanAction('board');
      lastTap = now;
    });
    $('game').addEventListener('mousedown', () => {
      if (G.state === 'title' || G.state === 'over') startGame();
    });

    const tapBtn = (id, fn) => $(id).addEventListener('click', (e) => {
      e.stopPropagation();
      fn();
      e.currentTarget.blur();
    });
    tapBtn('playBtn', startGame);
    tapBtn('againBtn', startGame);
    tapBtn('resumeBtn', togglePause);
    tapBtn('pauseBtn', togglePause);
    tapBtn('muteBtn', toggleMute);
    tapBtn('autoBtn', toggleAuto);
    tapBtn('buddyBtn', callBuddy);
    tapBtn('boardBtn', () => humanAction('board'));
    $('title').addEventListener('click', (e) => { if (!onUi(e)) startGame(); });
    $('over').addEventListener('click', (e) => { if (!onUi(e)) startGame(); });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (G.state === 'playing') togglePause();
        S.suspend();
      } else S.resume();
    });
    window.addEventListener('resize', resize);
  }

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- boot

  async function boot() {
    try {
      await Promise.race([document.fonts.load('64px Bungee'), new Promise((r) => setTimeout(r, 1500))]);
    } catch (e) { /* fall back to system fonts */ }
    const canvas = $('game');
    try {
      renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      $('loading').textContent = 'This browser can’t run WebGL, so Metro Surfer can’t start.';
      return;
    }
    A.init();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;

    scene = new T.Scene();
    scene.fog = new T.Fog(A.SKY.horizon, 70, 250);
    camera = new T.PerspectiveCamera(60, 1, 0.1, 900);

    scene.add(new T.HemisphereLight('#d4ecff', '#8a6e58', 0.75));
    sun = new T.DirectionalLight('#fff1d6', 1.3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 42, bottom: -42, near: 1, far: 110 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);

    sky = A.buildSky();
    clouds = A.buildClouds();
    scene.add(sky, clouds);
    for (let i = 0; i < 6; i++) {
      const s = A.buildSegment();
      segs.push(s);
      scene.add(s);
    }

    boardM = A.buildBoard();
    boardM.position.y = -0.1;
    jetM = A.buildJetpack();
    inspectorM = A.buildPerson(window.MetroInspector);
    dogM = A.buildDog();
    scene.add(inspectorM.root, dogM.root);
    particles = makeParticles(700);
    scene.add(particles.obj);

    Object.assign(ui, {
      score: $('score'), coins: $('coins'), coinIcon: $('coinIcon'), boards: $('boards'), boardBtn: $('boardBtn'),
      mult: $('mult'), toasts: $('toasts'), autoBadge: $('autoBadge'), autoBtn: $('autoBtn'), muteBtn: $('muteBtn'), bars: {},
      buddyRow: $('pwBuddy'), buddyFill: document.querySelector('#pwBuddy b'), buddyBtn: $('buddyBtn'),
    });
    document.querySelectorAll('.pw').forEach((row) => { ui.bars[row.dataset.k] = { row, fill: row.querySelector('b') }; });
    ui.muteBtn.textContent = S.isMuted() ? '🔇' : '🔊';
    buildBuddy();
    buildPicker();
    renderWord(false);
    setAvatar(store.get('avatar', AVATARS[0].id));

    resize();
    bindInput();
    startAttract();
    $('loading').remove();
    last = performance.now();
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- console hooks for testing and showing off

  window.metro = {
    get state() { return G.state; },
    G, P,
    start: startGame,
    // Drop a barrier or a train 20 m ahead in the runner's lane (for testing hits).
    block(type = 'low') {
      if (type === 'train') placeTrain(P.lane, P.pd + 20, 1, {});
      else placeBarrier(P.lane, P.pd + 20, type, false);
      return type;
    },
    zombie() {
      placePowerup(P.lane, P.pd + 25, 'zombie');
      return items[items.length - 1].d;
    },
    tommy() {
      summonBuddy();
      const r = buddy.m.root.position;
      return { on: buddy.on, t: +buddy.t.toFixed(2), dz: +buddy.dz.toFixed(2), x: +r.x.toFixed(2), y: +r.y.toFixed(2), z: +r.z.toFixed(1), playerZ: +(-P.pd).toFixed(1), visible: buddy.m.root.visible, holding: treat.holdT > 0 };
    },
    avatar(id) {
      if (id) setAvatar(id, true);
      return avatar.id;
    },
    autopilot(on) {
      if (on !== G.userAuto) toggleAuto();
      return G.userAuto;
    },
    // Headless soak test: the autopilot plays `seconds` of game time with no rendering, crashes are logged
    // instead of ending the run. A fair level generator lets it survive with zero crashes.
    // Advance `seconds` of game time right now and draw one frame (handy when the tab's animation is throttled).
    step(seconds = 1) {
      for (let t = 0; t < seconds; t += 1 / 60) {
        tick(1 / 60);
        render(1 / 60);
      }
      return { state: G.state, score: Math.floor(G.score), coins: G.coins, speed: +G.speed.toFixed(1) };
    },
    // Pass { auto: false } to prove the test can fail: with nobody steering, it should log crashes.
    soak(seconds = 120, opts = {}) {
      const wasAttract = G.attract;
      G.soak = { crashes: [], stumbles: 0, log: [] };
      G.attract = false;
      resetRun();
      G.state = 'playing';
      G.auto = opts.auto !== false;
      const started = performance.now();
      for (let t = 0; t < seconds; t += 1 / 60) tick(1 / 60);
      const report = {
        seconds,
        wallMs: Math.round(performance.now() - started),
        distance: Math.round(P.pd),
        finalSpeed: +G.speed.toFixed(1),
        coins: G.coins,
        score: Math.floor(G.score),
        stumbles: G.soak.stumbles,
        crashes: G.soak.crashes,
        stumbleLog: G.soak.log,
      };
      G.soak = null;
      if (wasAttract) startAttract();
      else {
        resetRun();
        G.state = 'playing';
        G.auto = G.userAuto;
      }
      return report;
    },
  };

  boot();
})();
