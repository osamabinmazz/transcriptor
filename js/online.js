// Motor online: Speechmatics batch v2, llamado directo desde el aparato (sirve con la PC apagada).
import { desdeSpeechmatics } from './lib/segmentos.js';

const API = 'https://asr.api.speechmatics.com/v2';

const fallo = (mensaje, reintentar = false) => Object.assign(new Error(mensaje), { reintentar });

async function pedir(f, url, opciones) {
  let r;
  try { r = await f(url, opciones); }
  catch { throw fallo('No hay conexión a internet. Se va a reintentar.', true); }
  if (r.ok) return r.json();
  if (r.status === 401) throw fallo('La clave de Speechmatics no es válida. Revisala en Ajustes.');
  if (r.status === 402 || r.status === 403) throw fallo('Speechmatics rechazó el pedido: puede que se haya terminado el crédito gratis.');
  if (r.status === 429 || r.status >= 500) throw fallo('Speechmatics está ocupado. Se va a reintentar.', true);
  throw fallo(`Speechmatics respondió con un error (${r.status}).`);
}

// Devuelve { segmentos, resumen }. resumen:true le pide también el resumen a Speechmatics (versión web, sin PC).
export async function transcribirOnline(e, blob, opciones = {}) {
  const { clave, fetch: f = globalThis.fetch.bind(globalThis), alJob = () => {}, alProgreso = () => {},
    esperar = ms => new Promise(r => setTimeout(r, ms)), resumen = false } = opciones;
  let { jobId } = opciones;
  const headers = { authorization: 'Bearer ' + clave };
  if (!jobId) {
    const transcription_config = { language: e.idioma === 'auto' ? 'auto' : 'es', operating_point: 'enhanced' };
    // el batch de Speechmatics no acepta cantidad de hablantes: solo se activa la separación
    if (e.cantHablantes > 1) transcription_config.diarization = 'speaker';
    const config = { type: 'transcription', transcription_config };
    if (resumen) config.summarization_config = { content_type: 'conversational', summary_length: 'detailed', summary_type: 'bullets' };
    const form = new FormData();
    form.append('config', JSON.stringify(config));
    form.append('data_file', blob, e.audio?.nombre || 'audio');
    jobId = (await pedir(f, `${API}/jobs/`, { method: 'POST', headers, body: form })).id;
    alJob(jobId);
  }
  for (let vuelta = 1; ; vuelta++) {
    alProgreso(Math.min(90, 10 + vuelta * 3));
    const { job } = await pedir(f, `${API}/jobs/${jobId}/`, { headers });
    if (job.status === 'done') break;
    if (job.status === 'rejected') {
      const motivo = job.errors?.[0]?.message || 'motivo desconocido';
      if (resumen && /summar/i.test(motivo)) return transcribirOnline(e, blob, { ...opciones, jobId: null, resumen: false });
      throw fallo('Speechmatics no pudo transcribir: ' + motivo);
    }
    await esperar(5000);
  }
  const json = await pedir(f, `${API}/jobs/${jobId}/transcript?format=json-v2`, { headers });
  return { segmentos: desdeSpeechmatics(json), resumen: json.summary?.content?.trim() || null };
}
