import * as db from '../db.js';
import * as grabadora from '../grabadora.js';
import { estado, avisos } from '../sincronizar.js';
import { esc, fecha, duracion, textoEstado, normalizar, medirDuracion, nuevaEntrevista, avisar } from '../ui.js';
import { icono } from '../iconos.js';

export async function crearDesdeArchivo(archivo) {
  if (!/^(audio|video)\//.test(archivo.type) && !/\.(m4a|mp3|ogg|opus|oga|wav|aac|amr|flac|webm|mp4|3gp|mov|mkv)$/i.test(archivo.name)) {
    avisar('Ese archivo no parece de audio ni de video.');
    return;
  }
  const id = db.nuevoId();
  await db.guardarAudio(id, archivo);
  const titulo = archivo.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Entrevista';
  await db.guardar(nuevaEntrevista(id, titulo, { nombre: archivo.name, tipo: archivo.type, bytes: archivo.size, duracion: await medirDuracion(archivo) }));
  location.hash = '#/nueva/' + id;
}

const coincide = (e, q) => !q || normalizar([e.titulo, e.resumen, ...Object.values(e.hablantes || {}), ...(e.segmentos || []).map(s => s.texto)].join(' ')).includes(q);

function fragmento(e, q) {
  if (!q) return '';
  const s = (e.segmentos || []).find(s => normalizar(s.texto).includes(q));
  if (!s) return '';
  const i = normalizar(s.texto).indexOf(q);
  const ini = Math.max(0, i - 40);
  return `<p class="fragmento">${ini ? '…' : ''}${esc(s.texto.slice(ini, i))}<mark>${esc(s.texto.slice(i, i + q.length))}</mark>${esc(s.texto.slice(i + q.length, i + q.length + 60))}…</p>`;
}

function fila(e, q) {
  const nombres = Object.values(e.hablantes || {});
  const meta = e.estado === 'listo'
    ? [fecha(e.creada), duracion(e.audio?.duracion), nombres.length > 1 ? nombres.join(', ') : ''].filter(Boolean).join('  /  ')
    : textoEstado(e, estado);
  const destino = e.estado === 'borrador' ? '#/nueva/' + e.id : '#/e/' + e.id;
  return `<li class="item estado-${e.estado}">
    <a href="${destino}">
      <span class="item-titulo">${esc(e.titulo)}</span>
      <span class="item-meta">${esc(meta)}</span>
      ${e.estado === 'transcribiendo' ? `<span class="barrita"><span style="width:${e.progreso || 0}%"></span></span>` : ''}
      ${fragmento(e, q)}
    </a>
  </li>`;
}

export default async function lista(raiz) {
  raiz.innerHTML = `
    <section class="inicio">
      <div class="empezar">
        <a class="boton-grabar" href="#/grabar"><span class="punto" aria-hidden="true"></span>Grabar entrevista</a>
        <label class="boton secundario subir">${icono('subir')}Subir audio o video
          <input type="file" accept="audio/*,video/*,.m4a,.opus,.ogg,.amr,.mp3,.wav" hidden>
        </label>
      </div>
      <div id="recuperar"></div>
      <div class="buscar-caja">${icono('buscar')}<input type="search" class="buscar" placeholder="Buscar en todas las entrevistas" aria-label="Buscar en todas las entrevistas"></div>
      <ul class="lista" id="lista"></ul>
      <p class="soltar" hidden>Soltá el archivo para transcribirlo</p>
    </section>`;
  const ul = raiz.querySelector('#lista');
  const buscar = raiz.querySelector('.buscar');

  async function pintar() {
    const todas = (await db.listar()).filter(e => !e.deleted).sort((a, b) => b.creada - a.creada);
    if (!raiz.contains(ul)) return; // ya se cambió de pantalla
    const cortadas = todas.filter(e => e.estado === 'grabando' && e.id !== grabadora.enCurso());
    raiz.querySelector('#recuperar').innerHTML = cortadas.map(e => `
      <div class="recuperar">
        <p>Una grabación se cortó antes de terminar (${esc(fecha(e.creada))}).</p>
        <button class="boton" data-recuperar="${e.id}">Recuperar grabación</button>
      </div>`).join('');
    const q = normalizar(buscar.value.trim());
    const visibles = todas.filter(e => e.estado !== 'grabando' && coincide(e, q));
    ul.innerHTML = visibles.map(e => fila(e, q)).join('')
      || (q ? '<li class="vacio">No hay entrevistas con esa palabra.</li>'
        : '<li class="vacio">Todavía no hay entrevistas. Grabá una o subí un audio.</li>');
  }

  raiz.addEventListener('click', async ev => {
    const id = ev.target.closest('[data-recuperar]')?.dataset.recuperar;
    if (!id) return;
    const blob = await db.unirPedazos(id);
    if (!blob.size) { avisar('No quedó audio para recuperar.'); return; }
    await db.guardarAudio(id, blob);
    await db.borrarPedazos(id);
    const e = await db.leer(id);
    await db.guardar({ ...e, estado: 'borrador', audio: { ...e.audio, bytes: blob.size, tipo: blob.type } });
    location.hash = '#/nueva/' + id;
  });
  raiz.querySelector('input[type=file]').addEventListener('change', ev => ev.target.files[0] && crearDesdeArchivo(ev.target.files[0]));
  buscar.addEventListener('input', pintar);

  // en la PC: arrastrar un archivo sobre la ventana
  const soltar = raiz.querySelector('.soltar');
  const sobre = ev => { if ([...ev.dataTransfer.types].includes('Files')) { ev.preventDefault(); soltar.hidden = false; } };
  const fuera = ev => { if (!ev.relatedTarget) soltar.hidden = true; };
  const caer = ev => { ev.preventDefault(); soltar.hidden = true; const f = ev.dataTransfer.files[0]; if (f) crearDesdeArchivo(f); };
  addEventListener('dragover', sobre);
  addEventListener('dragleave', fuera);
  addEventListener('drop', caer);

  db.cambios.addEventListener('cambio', pintar);
  avisos.addEventListener('estado', pintar);
  await pintar();
  return () => {
    db.cambios.removeEventListener('cambio', pintar);
    avisos.removeEventListener('estado', pintar);
    removeEventListener('dragover', sobre);
    removeEventListener('dragleave', fuera);
    removeEventListener('drop', caer);
  };
}
