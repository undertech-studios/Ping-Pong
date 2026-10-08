/* ═══════════════════════════════════════════════════════════════
   sound.js — Módulo de audio para Pong Arcade Vertical
   Motor: Web Audio API (sin archivos externos)
   Expone el objeto global SFX con los efectos del juego
   ═══════════════════════════════════════════════════════════════ */

const SFX = (() => {

  let audioCtx = null;

  /* Obtiene (o crea) el AudioContext de forma lazy.
     Se inicializa en el primer gesto del usuario para cumplir
     la política de autoplay de los navegadores modernos. */
  function ctx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
  }

  /**
   * Genera un tono sintético con envolvente de fade-out.
   *
   * @param {number} freq  Frecuencia en Hz
   * @param {number} dur   Duración total en segundos
   * @param {string} type  Forma de onda: 'sine' | 'square' | 'triangle' | 'sawtooth'
   * @param {number} vol   Volumen inicial  0 .. 1  (por defecto 0.18)
   */
  function beep(freq, dur, type = 'square', vol = 0.18) {
    try {
      const ac   = ctx();
      const osc  = ac.createOscillator();
      const gain = ac.createGain();

      osc.connect(gain);
      gain.connect(ac.destination);

      osc.type            = type;
      osc.frequency.value = freq;

      // Ataque instantáneo → fade-out exponencial
      gain.gain.setValueAtTime(vol, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);

      osc.start(ac.currentTime);
      osc.stop(ac.currentTime + dur);
    } catch (_) {
      // Silencio si el navegador bloquea la API o el contexto está suspendido
    }
  }

  /* ── Efectos de sonido ───────────────────────────────────────── */

  /** Rebote en paleta: pitido agudo y corto */
  function bounce() {
    beep(440, 0.06, 'square', 0.15);
  }

  /** Rebote en pared lateral: tono medio-grave */
  function wall() {
    beep(260, 0.07, 'square', 0.12);
  }

  /** Pierde una vida: bajada de tono con onda serrada */
  function loseLife() {
    beep(180, 0.25, 'sawtooth', 0.20);
  }

  /** Game Over: dos notas descendentes con pausa */
  function gameOver() {
    beep(220, 0.20, 'sawtooth', 0.20);
    setTimeout(() => beep(165, 0.35, 'sawtooth', 0.18), 200);
  }

  /** Inicio de partida: fanfarria ascendente de tres notas */
  function start() {
    beep(330, 0.07, 'square', 0.12);
    setTimeout(() => beep(440, 0.07, 'square', 0.12),  90);
    setTimeout(() => beep(550, 0.12, 'square', 0.15), 180);
  }

  /* ── API pública ─────────────────────────────────────────────── */
  return { bounce, wall, loseLife, gameOver, start };

})();