import * as db from '../db.js';
import { ciclo, clave } from '../sincronizar.js';
import { esc, duracion } from '../ui.js';
import { SOLO_ONLINE } from '../modo.js';

const MOTORES = [
  ['auto', 'Automático', 'La PC si está prendida; si no, el servicio online.'],
  ['pc', 'Mi PC', 'La mejor calidad. Si la PC está apagada, espera.'],
  ['online', 'Online', 'Funciona con la PC apagada. Usa tu crédito gratis.'],
];

export default async function nueva(raiz, id) {
  const e = await db.leer(id);
  if (!e || e.deleted) { location.hash = '#/'; return; }
  if (e.estado !== 'borrador') { location.hash = '#/e/' + id; return; }
  const blob = await db.leerAudio(id);
  const url = blob ? URL.createObjectURL(blob) : '';
  const hayClave = !!clave.leer();

  raiz.innerHTML = `
    <form class="nueva">
      <a href="#/" class="volver">Volver</a>
      <h1>Antes de transcribir</h1>
      ${url ? `<audio controls preload="metadata" src="${url}"></audio>` : ''}
      <p class="meta">${esc(duracion(e.audio?.duracion))}</p>
      <label class="campo">Título
        <input name="titulo" value="${esc(e.titulo)}" maxlength="120" required>
      </label>
      <fieldset class="campo">
        <legend>¿Cuántas personas hablan?</legend>
        <div class="contador">
          <button type="button" class="boton secundario" data-menos aria-label="Una persona menos">−</button>
          <output name="cant">${e.cantHablantes}</output>
          <button type="button" class="boton secundario" data-mas aria-label="Una persona más">+</button>
        </div>
      </fieldset>
      <fieldset class="campo opciones">
        <legend>Transcribir con</legend>
        ${SOLO_ONLINE ? `<label class="opcion">
            <input type="radio" name="motor" value="online" checked>
            <span><strong>Servicio online</strong><small>${hayClave ? 'En esta versión web se transcribe online, con tu crédito gratis.'
              : 'Falta tu clave: pegala en <a href="#/ajustes">Ajustes</a>. Mientras tanto queda en espera.'}</small></span>
          </label>`
        : MOTORES.map(([v, t, d]) => {
          const sinClave = v === 'online' && !hayClave;
          return `<label class="opcion${sinClave ? ' apagada' : ''}">
            <input type="radio" name="motor" value="${v}" ${e.motor === v ? 'checked' : ''} ${sinClave ? 'disabled' : ''}>
            <span><strong>${t}</strong><small>${sinClave ? 'Primero pegá tu clave en <a href="#/ajustes">Ajustes</a>.' : d}</small></span>
          </label>`;
        }).join('')}
      </fieldset>
      <fieldset class="campo opciones en-linea">
        <legend>Idioma</legend>
        <label class="opcion"><input type="radio" name="idioma" value="es" ${e.idioma !== 'auto' ? 'checked' : ''}><span><strong>Español</strong></span></label>
        <label class="opcion"><input type="radio" name="idioma" value="auto" ${e.idioma === 'auto' ? 'checked' : ''}><span><strong>Detectar</strong></span></label>
      </fieldset>
      <div class="botones">
        <button type="button" class="boton secundario" data-descartar>Descartar</button>
        <button class="boton principal">Transcribir</button>
      </div>
    </form>`;

  const form = raiz.querySelector('form');
  let cant = e.cantHablantes;
  const ponerCant = n => { cant = Math.min(6, Math.max(1, n)); form.cant.value = cant; };
  raiz.querySelector('[data-menos]').onclick = () => ponerCant(cant - 1);
  raiz.querySelector('[data-mas]').onclick = () => ponerCant(cant + 1);

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const actual = await db.leer(id);
    await db.guardar({ ...actual, titulo: form.titulo.value.trim() || 'Entrevista', cantHablantes: cant,
      motor: form.motor.value || 'auto', idioma: form.idioma.value, estado: 'pendiente' });
    location.hash = '#/e/' + id;
    ciclo();
  });
  raiz.querySelector('[data-descartar]').onclick = async () => {
    if (!confirm('¿Descartar este audio? Se borra de este aparato.')) return;
    await db.borrarAudio(id);
    await db.guardar({ ...(await db.leer(id)), deleted: true });
    location.hash = '#/';
  };
  return () => url && URL.revokeObjectURL(url);
}
