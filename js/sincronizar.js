// Habla con la PC cuando responde y decide qué motor usa cada entrevista pendiente.
import * as db from './db.js';
import { planSincro } from './lib/sincro.js';
import { transcribirOnline } from './online.js';
import { SOLO_ONLINE } from './modo.js';

export const estado = { pc: false, internet: navigator.onLine };
export const avisos = new EventTarget();
const avisar = () => avisos.dispatchEvent(new Event('estado'));

const CLAVE = 'clave-speechmatics';
export const clave = {
  leer: () => { try { return localStorage.getItem(CLAVE) || ''; } catch { return ''; } },
  guardar: v => { try { localStorage.setItem(CLAVE, v.trim()); } catch {} },
};

const api = (ruta, opciones = {}) => fetch('/api/' + ruta, { cache: 'no-store', ...opciones });

export async function pcDisponible() {
  if (SOLO_ONLINE) return false;
  try { return (await api('estado', { signal: AbortSignal.timeout(3000) })).ok; }
  catch { return false; }
}

async function subirAudio(e) {
  const blob = await db.leerAudio(e.id);
  if (!blob) return;
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const r = await api(`entrevistas/${e.id}/audio`, { method: 'PUT', headers: { 'content-type': blob.type || 'application/octet-stream' }, body: blob });
      if (r.ok) return db.guardar({ ...(await db.leer(e.id)), audioSubido: true });
    } catch {}
    await new Promise(r => setTimeout(r, 2000 * intento));
  }
}

// Grabaciones en curso y borradores todavía no se comparten.
const soloLocal = e => e.estado === 'grabando' || e.estado === 'borrador';

export async function sincronizar() {
  for (const e of await db.listar()) if (!e.deleted && !e.audioSubido && !soloLocal(e)) await subirAudio(e);
  const locales = (await db.listar()).filter(e => !soloLocal(e));
  const remotas = await (await api('entrevistas')).json();
  const { subir, bajar } = planSincro(locales, remotas);
  for (const id of subir) {
    const local = await db.leer(id);
    const r = await api(`entrevistas/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(local) });
    if (!r.ok) continue;
    const vigente = await r.json();
    if (vigente.actualizada > local.actualizada) await db.guardar(vigente, { tocar: false });
  }
  for (const id of bajar) {
    const antes = await db.leer(id);
    const nueva = remotas.find(r => r.id === id);
    await db.guardar(nueva, { tocar: false });
    if (antes && antes.estado !== nueva.estado) terminada(nueva);
  }
  // el audio de las borradas ya está en la papelera de la PC
  for (const e of await db.listar()) if (e.deleted && remotas.some(r => r.id === e.id && r.deleted)) await db.borrarAudio(e.id);
}

// La app avisa (sonido y cartel) cuando una entrevista termina bien o mal.
function terminada(e) {
  if (!e.deleted && (e.estado === 'listo' || e.estado === 'error')) avisos.dispatchEvent(new CustomEvent('terminada', { detail: e }));
}

const enCurso = new Set();
const resumenPedido = new Set();

async function correrOnline(e) {
  const blob = await db.leerAudio(e.id);
  if (!blob) return; // el audio está solo en la PC: lo hace la PC
  enCurso.add(e.id);
  // escrituras en fila: un aviso de progreso atrasado no puede pisar el resultado final
  let fila = Promise.resolve();
  const cambiar = cambios => (fila = fila.then(async () => db.guardar({ ...(await db.leer(e.id)), ...cambios })));
  try {
    await cambiar({ estado: 'transcribiendo', motorUsado: 'online', error: null, progreso: e.progreso || 5 });
    const { segmentos, resumen } = await transcribirOnline(e, blob, {
      clave: clave.leer(), jobId: e.onlineJob,
      alJob: onlineJob => cambiar({ onlineJob }),
      alProgreso: progreso => cambiar({ progreso }),
      resumen: SOLO_ONLINE,
    });
    const actual = await db.leer(e.id);
    const hablantes = { ...actual.hablantes };
    for (const s of segmentos) hablantes[s.hablante] ||= `Hablante ${s.hablante}`;
    terminada(await cambiar({ segmentos, hablantes, estado: 'listo', progreso: 100, onlineJob: null, ...(resumen ? { resumen } : {}),
      aviso: e.cantHablantes > 1 && new Set(segmentos.map(s => s.hablante)).size < 2 ? 'El servicio online no distinguió hablantes.' : null }));
  } catch (err) {
    await fila;
    const trabajo = (await db.leer(e.id)).onlineJob;
    if (err.reintentar) await cambiar({ estado: trabajo ? 'transcribiendo' : 'pendiente', error: err.message });
    else terminada(await cambiar({ estado: 'error', error: err.message, onlineJob: null }));
  } finally {
    enCurso.delete(e.id);
  }
}

export async function procesarPendientes() {
  for (const e of await db.listar()) {
    if (e.deleted || enCurso.has(e.id)) continue;
    const enOnline = e.estado === 'transcribiendo' && e.motorUsado === 'online' && e.onlineJob;
    if (estado.pc && e.estado === 'listo' && !e.resumen && e.segmentos?.length && !resumenPedido.has(e.id)) {
      resumenPedido.add(e.id);
      api(`entrevistas/${e.id}/resumir`, { method: 'POST' }).catch(() => {});
    }
    if (e.estado !== 'pendiente' && !enOnline) continue;
    if (estado.pc && e.motor !== 'online' && !enOnline) {
      if (e.audioSubido) await api(`entrevistas/${e.id}/transcribir`, { method: 'POST' }).catch(() => {});
      continue;
    }
    if ((e.motor !== 'pc' || enOnline) && clave.leer() && navigator.onLine) correrOnline(e);
  }
}

let corriendo = false, temporizador;
export async function ciclo() {
  clearTimeout(temporizador);
  if (corriendo) return;
  corriendo = true;
  try {
    estado.internet = navigator.onLine;
    estado.pc = await pcDisponible();
    avisar();
    if (estado.pc) await sincronizar();
    await procesarPendientes();
    if (estado.pc) await sincronizar();
  } catch (err) {
    console.error('sincronizar', err);
  } finally {
    corriendo = false;
    const ocupada = (await db.listar()).some(e => e.estado === 'transcribiendo' && !e.deleted);
    if (document.visibilityState === 'visible') temporizador = setTimeout(ciclo, ocupada ? 4000 : 20000);
  }
}

export function arrancar() {
  addEventListener('online', ciclo);
  addEventListener('offline', () => { estado.internet = false; estado.pc = false; avisar(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') ciclo(); });
  ciclo();
}
