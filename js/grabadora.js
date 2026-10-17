// Graba con MediaRecorder y guarda un pedazo cada 5 s: si algo se corta, se pierde como mucho eso.
import * as db from './db.js';

let activa = null;

async function pedirPantalla() {
  try { if (activa) activa.lock = await navigator.wakeLock?.request('screen'); } catch {}
}
const alVolver = () => { if (document.visibilityState === 'visible') pedirPantalla(); };

export async function iniciar(id, alNivel = () => {}) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
  const tipo = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(t => MediaRecorder.isTypeSupported?.(t)) || '';
  const rec = new MediaRecorder(stream, tipo ? { mimeType: tipo, audioBitsPerSecond: 64000 } : {});
  const escrituras = [];
  rec.ondataavailable = ev => { if (ev.data.size) escrituras.push(db.agregarPedazo(id, ev.data)); };
  rec.start(5000);

  // medidor de nivel para que se vea que el micrófono anda
  const ctx = new AudioContext();
  const analizador = ctx.createAnalyser();
  analizador.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analizador);
  const datos = new Float32Array(analizador.fftSize);
  let cuadro;
  const medir = () => {
    analizador.getFloatTimeDomainData(datos);
    alNivel(Math.min(1, Math.sqrt(datos.reduce((a, v) => a + v * v, 0) / datos.length) * 4));
    cuadro = requestAnimationFrame(medir);
  };
  medir();

  activa = { id, rec, stream, ctx, escrituras, inicio: Date.now(), pausado: 0, pausaDesde: null, lock: null, parar: () => cancelAnimationFrame(cuadro) };
  await pedirPantalla();
  document.addEventListener('visibilitychange', alVolver);
}

export const enCurso = () => activa?.id || null;
export const pausada = () => !!activa?.pausaDesde;
export const segundos = () => activa ? ((activa.pausaDesde ?? Date.now()) - activa.inicio - activa.pausado) / 1000 : 0;

export function pausar() {
  if (!activa || activa.pausaDesde) return;
  activa.rec.pause();
  activa.pausaDesde = Date.now();
}

export function seguir() {
  if (!activa?.pausaDesde) return;
  activa.rec.resume();
  activa.pausado += Date.now() - activa.pausaDesde;
  activa.pausaDesde = null;
}

export async function terminar() {
  const a = activa;
  if (!a) return null;
  const total = segundos();
  activa = null;
  document.removeEventListener('visibilitychange', alVolver);
  await new Promise(ok => { a.rec.onstop = ok; a.rec.stop(); });
  await Promise.all(a.escrituras);
  a.parar();
  a.stream.getTracks().forEach(t => t.stop());
  a.ctx.close().catch(() => {});
  a.lock?.release?.().catch(() => {});
  const blob = await db.unirPedazos(a.id);
  return { blob, segundos: total };
}
