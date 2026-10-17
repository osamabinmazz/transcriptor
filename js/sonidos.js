// Sonidos cortos sintetizados (sin archivos) y vibración en el celular. Se apagan en Ajustes.
const CLAVE = 'sonidos';
export const activados = () => { try { return localStorage.getItem(CLAVE) !== 'no'; } catch { return true; } };
export const activar = si => { try { localStorage.setItem(CLAVE, si ? 'si' : 'no'); } catch {} };

// [frecuencia Hz, inicio s, duración s]
const MELODIAS = {
  grabar: [[660, 0, 0.09], [990, 0.1, 0.14]],
  terminar: [[990, 0, 0.09], [660, 0.1, 0.16]],
  pausa: [[740, 0, 0.08]],
  listo: [[784, 0, 0.12], [988, 0.11, 0.12], [1319, 0.22, 0.3]],
  error: [[330, 0, 0.18], [247, 0.17, 0.26]],
};
const VIBRACION = { grabar: [40], terminar: [30, 60, 30], pausa: [20], listo: [20, 40, 20], error: [80] };

let ctx;
export function sonar(nombre) {
  if (!activados()) return;
  navigator.vibrate?.(VIBRACION[nombre] || []);
  try {
    ctx ||= new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime + 0.02;
    for (const [f, ini, dur] of MELODIAS[nombre] || []) {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      vol.gain.setValueAtTime(0, t0 + ini);
      vol.gain.linearRampToValueAtTime(0.18, t0 + ini + 0.015);
      vol.gain.exponentialRampToValueAtTime(0.001, t0 + ini + dur);
      osc.connect(vol).connect(ctx.destination);
      osc.start(t0 + ini);
      osc.stop(t0 + ini + dur + 0.05);
    }
  } catch {}
}
