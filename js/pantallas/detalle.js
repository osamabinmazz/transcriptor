import * as db from '../db.js';
import { estado, avisos, ciclo, clave } from '../sincronizar.js';
import { aTexto, aSrt, nombreHablante, nombreArchivo } from '../lib/exportar.js';
import { crearDocx } from '../lib/docx.js';
import { esc, fecha, duracion, reloj, textoEstado, claseHablante, descargar, avisar } from '../ui.js';
import { icono } from '../iconos.js';
import { SOLO_ONLINE } from '../modo.js';

const TIPO_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function bloqueEstado(e) {
  if (e.estado === 'listo') return '';
  const acciones = [];
  if (e.estado === 'error') acciones.push('<button class="boton" data-accion="reintentar">Reintentar</button>');
  if (e.estado === 'pendiente' && e.motor !== 'online' && !estado.pc && clave.leer()) acciones.push('<button class="boton" data-accion="online">Usar el servicio online ahora</button>');
  if (e.estado === 'pendiente' && e.motor === 'online' && !SOLO_ONLINE) acciones.push('<button class="boton secundario" data-accion="pc">Mejor esperar a la PC</button>');
  return `<div class="estado-caja estado-${e.estado}">
    <p>${esc(textoEstado(e, estado))}</p>
    ${e.estado === 'transcribiendo' ? `<span class="barrita"><span style="width:${e.progreso || 0}%"></span></span>` : ''}
    ${acciones.length ? `<div class="botones">${acciones.join('')}</div>` : ''}
  </div>`;
}

function bloqueResumen(e, abierto) {
  if (e.estado !== 'listo' || !e.segmentos?.length) return '';
  const titulo = `<h2 class="resumen-titulo">${icono('resumen')}Resumen y puntos clave</h2>`;
  if (!e.resumen) return `<section class="resumen vacio-resumen">${titulo}${SOLO_ONLINE ? '<p>Este audio no tiene resumen.</p>' : estado.pc
    ? '<p>Todavía no tiene resumen.</p><button class="boton secundario" data-accion="resumir">Hacer resumen</button>'
    : '<p>El resumen se hace en la PC: va a aparecer cuando esté prendida.</p>'}</section>`;
  const largo = e.resumen.length > 420;
  return `<section class="resumen${largo && !abierto ? ' plegado' : ''}">${titulo}
    <div class="resumen-texto">${esc(e.resumen)}</div>
    ${largo ? `<button class="ver-mas" data-accion="ver-resumen" aria-expanded="${abierto}">${abierto ? 'Ver menos' : 'Ver todo el resumen'}</button>` : ''}
  </section>`;
}

function bloqueTexto(e) {
  if (!e.segmentos?.length) return e.estado === 'listo' ? '<p class="vacio">No se detectó voz en este audio.</p>' : '';
  const grupos = [];
  e.segmentos.forEach((s, i) => {
    const g = grupos.at(-1);
    if (g?.hablante === s.hablante) g.segs.push([s, i]);
    else grupos.push({ hablante: s.hablante, segs: [[s, i]] });
  });
  return grupos.map(g => {
    const ini = g.segs[0][0].ini;
    return `<section class="bloque ${claseHablante(g.hablante)}">
      <h3 class="quien">${esc(nombreHablante(e, g.hablante))}<button class="tiempo" data-ir="${ini}" aria-label="Escuchar desde ${reloj(ini)}">${reloj(ini)}</button></h3>
      <p>${g.segs.map(([s, i]) => `<span class="seg" data-i="${i}" data-ini="${s.ini}" data-fin="${s.fin}">${esc(s.texto.trim())}</span>`).join(' ')}</p>
    </section>`;
  }).join('');
}

export default async function detalle(raiz, id) {
  let e = await db.leer(id);
  if (!e || e.deleted) { location.hash = '#/'; return; }
  let corrigiendo = false, resumenAbierto = false, textoMostrado = !!e.segmentos?.length;

  raiz.innerHTML = `
    <article class="detalle">
      <a href="#/" class="volver">Todas las entrevistas</a>
      <input class="titulo" aria-label="Título" maxlength="120">
      <p class="meta"></p>
      <div id="contenido"></div>
    </article>
    <div class="barra-frase" hidden>
      <label>Esta frase la dice <select aria-label="Quién dice la frase elegida"></select></label>
    </div>
    <div class="reproductor" hidden>
      <button class="play" aria-label="Reproducir">${icono('play')}</button>
      <input type="range" min="0" step="0.1" value="0" aria-label="Posición del audio">
      <span class="pos">00:00</span>
      <button class="vel" aria-label="Velocidad">1×</button>
      <audio preload="metadata"></audio>
    </div>
    <p class="sin-audio" hidden>El audio está en la PC: se puede escuchar cuando esté conectada.</p>`;
  const $ = s => raiz.querySelector(s);
  const contenido = $('#contenido');
  const audio = $('audio');
  const titulo = $('.titulo');

  // audio: primero el guardado en este aparato, si no, desde la PC
  let urlLocal = null;
  async function cargarAudio() {
    if (audio.src) return;
    const blob = await db.leerAudio(id);
    if (blob) audio.src = urlLocal = URL.createObjectURL(blob);
    else if (estado.pc && e.audioSubido !== false) audio.src = `/api/entrevistas/${id}/audio`;
    $('.reproductor').hidden = !audio.src;
    $('.sin-audio').hidden = !!audio.src || e.estado !== 'listo';
  }

  function pintar() {
    titulo.value = e.titulo;
    const listo = e.estado === 'listo';
    $('.meta').textContent = [fecha(e.creada), duracion(e.audio?.duracion),
      listo && e.motorUsado === 'online' ? 'Transcripta online' : listo && e.motorUsado === 'pc' ? 'Transcripta en la PC' : ''].filter(Boolean).join('  /  ');
    const nums = [...new Set((e.segmentos || []).map(s => s.hablante))].sort((a, b) => a - b);
    const hay = !!e.segmentos?.length;
    // el texto aparece con una transición la primera vez que llega
    const aparece = hay && !textoMostrado;
    textoMostrado ||= hay;
    const menuMas = extra => `<details class="mas"><summary class="boton secundario" aria-label="Más opciones">${icono('mas')}</summary>
      <div class="menu">${extra}<button data-accion="borrar" class="peligro">${icono('basura')}Borrar entrevista</button></div></details>`;
    contenido.innerHTML = `
      ${bloqueEstado(e)}
      ${e.aviso ? `<p class="aviso-caja">${esc(e.aviso)}</p>` : ''}
      ${bloqueResumen(e, resumenAbierto)}
      ${nums.length ? `<fieldset class="hablantes"><legend>Quién habla <small>(tocá un nombre para cambiarlo)</small></legend>${nums.map(h => `
        <label class="hablante ${claseHablante(h)}"><span class="muestra" aria-hidden="true"></span>
          <input data-hablante="${h}" value="${esc(nombreHablante(e, h))}" aria-label="Nombre de ${esc(nombreHablante(e, h))}" maxlength="40">
        </label>`).join('')}</fieldset>` : ''}
      ${hay ? `<div class="herramientas">
        <button class="boton ${corrigiendo ? 'principal' : 'secundario'}" data-accion="corregir" aria-pressed="${corrigiendo}">${icono(corrigiendo ? 'listo' : 'lapiz')}${corrigiendo ? 'Terminé de corregir' : 'Corregir'}</button>
        <button class="boton secundario" data-accion="copiar">${icono('copiar')}Copiar</button>
        <button class="boton secundario" data-accion="word">${icono('word')}Word</button>
        ${navigator.share ? `<button class="boton secundario" data-accion="compartir">${icono('compartir')}Compartir</button>` : ''}
        ${menuMas(`<button data-accion="txt">${icono('descargar')}Descargar texto (.txt)</button><button data-accion="srt">${icono('descargar')}Descargar subtítulos (.srt)</button>`)}
      </div>
      <p class="ayuda">${corrigiendo ? 'Tocá una frase para escucharla desde ahí y corregila escribiendo encima. Se guarda sola.' : 'Tocá una frase para escuchar ese momento.'}</p>
      <div class="transcripcion${corrigiendo ? ' corrigiendo' : ''}${aparece ? ' aparece' : ''}">${bloqueTexto(e)}</div>`
      : `${listo ? bloqueTexto(e) : ''}<div class="herramientas">${menuMas('')}</div>`}`;
    if (corrigiendo) contenido.querySelectorAll('.seg').forEach(s => { s.contentEditable = 'plaintext-only'; s.spellcheck = true; });
    marcarActual();
    cargarAudio();
  }

  async function guardar(cambios) {
    e = await db.guardar({ ...(await db.leer(id)), ...cambios });
  }

  // cambios que llegan de la sincronización: no repintar mientras se escribe
  async function alCambiar() {
    const nueva = await db.leer(id);
    if (!nueva || nueva.deleted) { location.hash = '#/'; return; }
    if (nueva.actualizada === e.actualizada) return;
    e = nueva;
    if (corrigiendo || raiz.contains(document.activeElement) && document.activeElement.matches('input, [contenteditable]')) return;
    pintar();
  }

  function marcarActual() {
    const t = audio.currentTime;
    contenido.querySelectorAll('.seg.ahora').forEach(s => s.classList.remove('ahora'));
    if (audio.paused && t === 0) return;
    const actual = [...contenido.querySelectorAll('.seg')].find(s => t >= +s.dataset.ini && t < +s.dataset.fin);
    actual?.classList.add('ahora');
  }

  function ir(seg, reproducir) {
    if (!audio.src) { avisar('El audio no está disponible ahora.'); return; }
    audio.currentTime = seg;
    if (reproducir) audio.play().catch(() => {});
    marcarActual();
  }

  async function accion(nombre) {
    const nombreBase = nombreArchivo(e.titulo);
    switch (nombre) {
      case 'corregir':
        if (corrigiendo) { await guardarEdicion(); $('.barra-frase').hidden = true; }
        corrigiendo = !corrigiendo;
        pintar();
        break;
      case 'copiar':
        await navigator.clipboard.writeText(aTexto(e));
        avisar('Copiado. Ya lo podés pegar donde quieras.');
        break;
      case 'word':
        descargar(new Blob([crearDocx(e)], { type: TIPO_DOCX }), nombreBase + '.docx');
        avisar('Se descargó el Word.');
        break;
      case 'compartir': {
        const archivo = new File([crearDocx(e)], nombreBase + '.docx', { type: TIPO_DOCX });
        try {
          if (navigator.canShare?.({ files: [archivo] })) await navigator.share({ files: [archivo], title: e.titulo });
          else await navigator.share({ title: e.titulo, text: aTexto(e) });
        } catch (err) { if (err.name !== 'AbortError') avisar('No se pudo compartir.'); }
        break;
      }
      case 'txt': descargar(new Blob([aTexto(e)], { type: 'text/plain;charset=utf-8' }), nombreBase + '.txt'); break;
      case 'srt': descargar(new Blob([aSrt(e)], { type: 'application/x-subrip;charset=utf-8' }), nombreBase + '.srt'); break;
      case 'borrar':
        if (!confirm(SOLO_ONLINE ? `¿Borrar «${e.titulo}»? Se borra de este aparato y no se puede recuperar.` : `¿Borrar «${e.titulo}»? Se mueve a la papelera de la PC (Documentos\\Transcripciones\\_papelera).`)) return;
        if (SOLO_ONLINE) await db.borrarAudio(id);
        await guardar({ deleted: true });
        location.hash = '#/';
        ciclo();
        break;
      case 'reintentar': await guardar({ estado: 'pendiente', error: null, progreso: 0 }); ciclo(); pintar(); break;
      case 'online': await guardar({ motor: 'online' }); ciclo(); pintar(); break;
      case 'pc': await guardar({ motor: 'pc' }); ciclo(); pintar(); break;
      case 'ver-resumen': resumenAbierto = !resumenAbierto; pintar(); break;
      case 'resumir':
        await fetch(`/api/entrevistas/${id}/resumir`, { method: 'POST' }).catch(() => {});
        avisar('Haciendo el resumen en la PC. Tarda un minuto.');
        break;
    }
  }

  async function guardarEdicion() {
    const segmentos = structuredClone(e.segmentos);
    let cambio = false;
    contenido.querySelectorAll('.seg').forEach(s => {
      const t = s.textContent.replace(/\s+/g, ' ').trim();
      if (segmentos[s.dataset.i] && t !== segmentos[s.dataset.i].texto.trim()) { segmentos[s.dataset.i].texto = t; cambio = true; }
    });
    if (cambio) await guardar({ segmentos });
  }

  contenido.addEventListener('click', ev => {
    const boton = ev.target.closest('[data-accion]');
    if (boton) { boton.closest('details.mas')?.removeAttribute('open'); return accion(boton.dataset.accion); }
    const tiempo = ev.target.closest('[data-ir]');
    if (tiempo) return ir(+tiempo.dataset.ir, true);
    const seg = ev.target.closest('.seg');
    if (seg) { ir(+seg.dataset.ini, !corrigiendo); elegirFrase({ target: seg }); }
  });
  contenido.addEventListener('focusout', ev => { if (ev.target.matches('.seg')) guardarEdicion(); });

  // corregir quién dice cada frase (la separación de voces a veces se equivoca en frases cortas)
  const barraFrase = $('.barra-frase'), elegirHablante = $('.barra-frase select');
  let fraseElegida = null;
  const elegirFrase = ev => {
    if (!corrigiendo || !ev.target.matches?.('.seg')) return;
    fraseElegida = +ev.target.dataset.i;
    const nums = [...new Set([...e.segmentos.map(s => s.hablante), ...Object.keys(e.hablantes || {})])].sort((a, b) => a - b);
    const otra = String(Math.max(0, ...nums.map(Number)) + 1);
    elegirHablante.innerHTML = nums.map(h => `<option value="${h}">${esc(nombreHablante(e, h))}</option>`).join('')
      + `<option value="${otra}">Otra persona</option>`;
    elegirHablante.value = e.segmentos[fraseElegida].hablante;
    barraFrase.hidden = false;
  };
  contenido.addEventListener('focusin', elegirFrase);
  elegirHablante.addEventListener('change', async () => {
    await guardarEdicion();
    const segmentos = structuredClone(e.segmentos);
    const h = elegirHablante.value;
    segmentos[fraseElegida].hablante = h;
    await guardar({ segmentos, hablantes: { ...e.hablantes, [h]: e.hablantes?.[h] || `Hablante ${h}` } });
    barraFrase.hidden = true;
    pintar();
    avisar('Listo, cambié quién dice esa frase.');
  });
  contenido.addEventListener('change', async ev => {
    const h = ev.target.dataset.hablante;
    if (!h) return;
    await guardar({ hablantes: { ...e.hablantes, [h]: ev.target.value.trim() || `Hablante ${h}` } });
    pintar();
  });
  titulo.addEventListener('change', () => guardar({ titulo: titulo.value.trim() || 'Entrevista' }));

  // reproductor
  const play = $('.play'), barra = $('input[type=range]'), pos = $('.pos'), vel = $('.vel');
  play.onclick = () => audio.paused ? audio.play().catch(() => avisar('No se pudo reproducir el audio.')) : audio.pause();
  audio.onplay = () => { play.innerHTML = icono('pausa'); play.setAttribute('aria-label', 'Pausar'); };
  audio.onpause = () => { play.innerHTML = icono('play'); play.setAttribute('aria-label', 'Reproducir'); };
  audio.onloadedmetadata = () => { barra.max = Number.isFinite(audio.duration) ? audio.duration : (e.audio?.duracion || 0); };
  audio.ontimeupdate = () => { barra.value = audio.currentTime; pos.textContent = reloj(audio.currentTime); marcarActual(); };
  barra.oninput = () => { audio.currentTime = +barra.value; };
  const velocidades = [1, 1.25, 1.5, 2, 0.75];
  vel.onclick = () => {
    audio.playbackRate = velocidades[(velocidades.indexOf(audio.playbackRate) + 1) % velocidades.length];
    vel.textContent = String(audio.playbackRate).replace('.', ',') + '×';
  };

  db.cambios.addEventListener('cambio', alCambiar);
  const alEstado = () => { if (!corrigiendo) pintar(); };
  avisos.addEventListener('estado', alEstado);
  pintar();
  return async () => {
    if (corrigiendo) await guardarEdicion();
    db.cambios.removeEventListener('cambio', alCambiar);
    avisos.removeEventListener('estado', alEstado);
    audio.pause();
    if (urlLocal) URL.revokeObjectURL(urlLocal);
  };
}
