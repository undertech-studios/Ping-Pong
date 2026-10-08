/* ═══════════════════════════════════════════════════════════════
   script.js — Pong Arcade Vertical (v2.1)
   Modificaciones: Límite de velocidad + Saque lento + Dirección aleatoria
   ═══════════════════════════════════════════════════════════════ */

const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');
const W = 480, H = 640;
canvas.width  = W;
canvas.height = H;

// ── Constantes de Equilibrio ──────────────────────────────────────────────
const BG            = '#c8f5e4';
const DARK          = '#1a2744';
const COL_J1        = '#1a4a32';
const COL_J2        = '#4a2a0a';
const PAD_W         = 108;
const PAD_H         = 14;
const PAD_RAD       = 7;
const BALL_R        = 9;
const MAX_LIVES      = 3;

// --- AJUSTES SOLICITADOS ---
const INITIAL_SPEED = 4.5;   // Velocidad al reaparecer (saque)
const SPEED_INC     = 0.4;   // Aceleración por cada rebote
const MAX_SPEED     = 12.0;  // LÍMITE: No pasará de aquí para ser jugable
const WIN_SCORE     = 5;
const PAD_SPEED_2P  = 8;     

// ── Estado ────────────────────────────────────────────────────────────────
let mode  = null;
let state = {};
let raf   = null;

const keys = {};
window.addEventListener('keydown', e => { keys[e.key] = true; });
window.addEventListener('keyup',   e => { keys[e.key] = false; });

// ── Persistencia (1P) ─────────────────────────────────────────────────────
function dayKey() { return 'pong_day_' + new Date().toDateString(); }
function loadStorage() {
  return {
    gmax: parseInt(localStorage.getItem('pong_gmax') || '0', 10),
    dmax: parseInt(localStorage.getItem(dayKey())    || '0', 10)
  };
}
function saveStorage(score) {
  let { gmax, dmax } = loadStorage();
  if (score > gmax) { gmax = score; localStorage.setItem('pong_gmax', gmax); }
  if (score > dmax) { dmax = score; localStorage.setItem(dayKey(), dmax); }
  return { gmax, dmax };
}

// ── UI Helpers ────────────────────────────────────────────────────────────
const el = id => document.getElementById(id);

function showOnly(...ids) {
  ['panel1P','panel2P','overlayMode','overlayGame','overlayWin','livesRow','controlsHint'].forEach(id => el(id).classList.add('hidden'));
  ids.forEach(id => el(id).classList.remove('hidden'));
}

function update1PScoreUI(cur, gmax, dmax) {
  el('sCur').textContent = cur;
  el('sMax').textContent = gmax;
  el('sDay').textContent = dmax;
}

function update2PScoreUI() {
  el('sJ1').textContent = state.scoreJ1;
  el('sJ2').textContent = state.scoreJ2;
}

function renderLives(lives) {
  const row = el('livesRow');
  row.innerHTML = '';
  for (let i = 0; i < MAX_LIVES; i++) {
    const d = document.createElement('div');
    d.className = 'heart' + (i >= lives ? ' lost' : '');
    row.appendChild(d);
  }
}

// ── Overlays ──────────────────────────────────────────────────────────────
function showModeSelect() {
  mode = null;
  cancelAnimationFrame(raf);
  showOnly('overlayMode');
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
}

function showGameOverlay(title, sub, score, label) {
  el('ovTitle').textContent = title;
  el('ovSub').textContent   = sub;
  if (score !== null) {
    el('ovScore').textContent = score;
    el('ovLabel').textContent = label;
    el('ovScore').style.display = 'block';
    el('ovLabel').style.display = 'block';
  } else {
    el('ovScore').style.display = 'none';
    el('ovLabel').style.display = 'none';
  }
  el('overlayGame').classList.remove('hidden');
}

function showWinOverlay(winner) {
  const isJ1 = winner === 1;
  const badge = el('winBadge');
  badge.textContent = isJ1 ? 'J1' : 'J2';
  badge.className = 'winBadge ' + (isJ1 ? 'j1win' : 'j2win');
  el('winTitle').textContent = isJ1 ? '¡JUGADOR 1 GANA!' : '¡JUGADOR 2 GANA!';
  el('winScores').innerHTML = `
    <div class="winScoreItem j1item"><div class="wLabel">▲ Jugador 1</div><div class="wVal">${state.scoreJ1}</div></div>
    <div class="winSep">–</div>
    <div class="winScoreItem j2item"><div class="wLabel">▼ Jugador 2</div><div class="wVal">${state.scoreJ2}</div></div>`;
  el('overlayWin').classList.remove('hidden');
}

// ── Renderizado ──────────────────────────────────────────────────────────
function drawRoundRect(x, y, w, h, r, color) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function draw() {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(26,39,68,0.13)';
  ctx.setLineDash([6, 11]);
  ctx.beginPath();
  ctx.moveTo(W / 2, 30); ctx.lineTo(W / 2, H - 30);
  ctx.stroke();
  ctx.setLineDash([]);

  const topColor = mode === '2p' ? COL_J1 : DARK;
  const botColor = mode === '2p' ? COL_J2 : DARK;

  drawRoundRect(state.padTopX - PAD_W / 2, 22, PAD_W, PAD_H, PAD_RAD, topColor);
  drawRoundRect(state.padBotX - PAD_W / 2, H - 22 - PAD_H, PAD_W, PAD_H, PAD_RAD, botColor);

  if (mode === '2p') {
    ctx.font = '600 11px Segoe UI, sans-serif';
    ctx.fillStyle = '#4cddaa'; ctx.textAlign = 'center'; ctx.fillText('J1', state.padTopX, 20);
    ctx.fillStyle = '#ffaa55'; ctx.fillText('J2', state.padBotX, H - 8);
  }

  ctx.beginPath();
  ctx.arc(state.ball.x, state.ball.y, BALL_R, 0, Math.PI * 2);
  ctx.fillStyle = DARK;
  ctx.fill();
}

// ── Lógica y Física ──────────────────────────────────────────────────────
function resetBall() {
  // Siempre reinicia a la velocidad base (Saque Lento)
  state.speed = INITIAL_SPEED;
  
  // Dirección aleatoria (arriba/abajo e izquierda/derecha)
  const dirX = (Math.random() > 0.5 ? 1 : -1);
  const dirY = (Math.random() > 0.5 ? 1 : -1);

  state.ball = {
    x: W / 2,
    y: H / 2,
    vx: dirX * state.speed * 0.6,
    vy: dirY * state.speed
  };
}

function onBounce(padX) {
  const b = state.ball;
  const offset = (b.x - padX) / (PAD_W / 2);
  const angle = offset * 0.9;
  
  // Aumento progresivo con LÍMITE (MAX_SPEED)
  const curSpd = Math.hypot(b.vx, b.vy);
  const newSpd = Math.min(curSpd + SPEED_INC, MAX_SPEED);
  
  const dirY = b.vy < 0 ? 1 : -1;
  b.vx = Math.sin(angle) * newSpd;
  b.vy = dirY * Math.cos(angle) * newSpd;
  state.speed = newSpd;

  if (mode === '1p') {
    state.bounces++;
    state.score += 10 + Math.floor(state.bounces / 5) * 5;
    const { gmax, dmax } = loadStorage();
    update1PScoreUI(state.score, Math.max(gmax, state.score), Math.max(dmax, state.score));
  }
  SFX.bounce();
}

function loseLife1P() {
  state.lives--;
  renderLives(state.lives);
  if (state.lives <= 0) { SFX.gameOver(); gameOver1P(); }
  else { SFX.loseLife(); resetBall(); }
}

function gameOver1P() {
  state.running = false;
  cancelAnimationFrame(raf);
  const saved = saveStorage(state.score);
  update1PScoreUI(state.score, saved.gmax, saved.dmax);
  draw();
  showOnly('panel1P', 'livesRow', 'overlayGame');
  showGameOverlay('GAME OVER', '¡Buen intento!', state.score, 'PUNTOS');
}

function scorePoint2P(scorer) {
  SFX.loseLife();
  if (scorer === 1) state.scoreJ1++; else state.scoreJ2++;
  update2PScoreUI();

  if (state.scoreJ1 >= WIN_SCORE || state.scoreJ2 >= WIN_SCORE) {
    state.running = false;
    cancelAnimationFrame(raf);
    SFX.gameOver();
    draw();
    showOnly('panel2P', 'overlayWin');
    showWinOverlay(state.scoreJ1 >= WIN_SCORE ? 1 : 2);
    return;
  }
  resetBall();
}

function movePads2P() {
  if (keys['a'] || keys['A']) state.padTopX -= PAD_SPEED_2P;
  if (keys['d'] || keys['D']) state.padTopX += PAD_SPEED_2P;
  if (keys['ArrowLeft'])  state.padBotX -= PAD_SPEED_2P;
  if (keys['ArrowRight']) state.padBotX += PAD_SPEED_2P;

  state.padTopX = Math.max(PAD_W/2, Math.min(W - PAD_W/2, state.padTopX));
  state.padBotX = Math.max(PAD_W/2, Math.min(W - PAD_W/2, state.padBotX));
}

function update() {
  if (mode === '2p') movePads2P();
  const b = state.ball;
  b.x += b.vx; b.y += b.vy;

  if (b.x - BALL_R < 0 || b.x + BALL_R > W) {
    b.vx *= -1;
    SFX.wall();
  }

  // Colisión Paleta Superior
  const topCenter = 22 + PAD_H/2;
  if (b.vy < 0 && b.y - BALL_R <= topCenter + PAD_H/2 && b.x >= state.padTopX - PAD_W/2 && b.x <= state.padTopX + PAD_W/2) {
    b.y = topCenter + PAD_H/2 + BALL_R;
    onBounce(state.padTopX);
  }

  // Colisión Paleta Inferior
  const botCenter = H - 22 - PAD_H/2;
  if (b.vy > 0 && b.y + BALL_R >= botCenter - PAD_H/2 && b.x >= state.padBotX - PAD_W/2 && b.x <= state.padBotX + PAD_W/2) {
    b.y = botCenter - PAD_H/2 - BALL_R;
    onBounce(state.padBotX);
  }

  if (b.y - BALL_R < 0) { if (mode === '1p') loseLife1P(); else scorePoint2P(2); }
  if (b.y + BALL_R > H) { if (mode === '1p') loseLife1P(); else scorePoint2P(1); }
}

function loop() {
  if (!state.running) return;
  update();
  draw();
  raf = requestAnimationFrame(loop);
}

function start1P() {
  mode = '1p';
  const { gmax, dmax } = loadStorage();
  state = { running: true, score: 0, lives: MAX_LIVES, bounces: 0, padTopX: W/2, padBotX: W/2 };
  resetBall();
  update1PScoreUI(0, gmax, dmax);
  renderLives(MAX_LIVES);
  showOnly('panel1P', 'livesRow');
  SFX.start();
  loop();
}

function start2P() {
  mode = '2p';
  state = { running: true, scoreJ1: 0, scoreJ2: 0, padTopX: W/2, padBotX: W/2 };
  resetBall();
  update2PScoreUI();
  showOnly('panel2P', 'controlsHint');
  SFX.start();
  loop();
}

canvas.addEventListener('mousemove', e => {
  if (state.running && mode === '1p') {
    const r = canvas.getBoundingClientRect();
    state.padTopX = (e.clientX - r.left) * (W / r.width);
    state.padBotX = state.padTopX;
  }
});

el('btn1P').addEventListener('click', start1P);
el('btn2P').addEventListener('click', start2P);
el('playBtn').addEventListener('click', start1P);
el('rematchBtn').addEventListener('click', start2P);
el('menuBtn').addEventListener('click', showModeSelect);
el('menuBtn2').addEventListener('click', showModeSelect);

showModeSelect();