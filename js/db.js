// Todo lo del aparato vive en IndexedDB: entrevistas, audios y pedazos de grabación en curso.
export const cambios = new EventTarget();
const avisar = () => cambios.dispatchEvent(new Event('cambio'));

let bd;
function base() {
  return bd ||= new Promise((ok, mal) => {
    const r = indexedDB.open('transcriptor', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('entrevistas', { keyPath: 'id' });
      d.createObjectStore('audios');
      d.createObjectStore('pedazos', { autoIncrement: true }).createIndex('id', 'id');
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}

async function tx(almacen, modo, fn) {
  const d = await base();
  return new Promise((ok, mal) => {
    const t = d.transaction(almacen, modo);
    const pedido = fn(t.objectStore(almacen));
    t.oncomplete = () => ok(pedido?.result);
    t.onerror = t.onabort = () => mal(t.error);
  });
}

export const nuevoId = () => crypto.randomUUID();
export const listar = () => tx('entrevistas', 'readonly', s => s.getAll());
export const leer = id => tx('entrevistas', 'readonly', s => s.get(id));

// tocar=false para guardar tal cual una versión que vino de la PC.
export async function guardar(e, { tocar = true } = {}) {
  if (tocar) e.actualizada = Math.max(Date.now(), (e.actualizada || 0) + 1);
  await tx('entrevistas', 'readwrite', s => s.put(e));
  avisar();
  return e;
}

export const guardarAudio = (id, blob) => tx('audios', 'readwrite', s => s.put(blob, id));
export const leerAudio = id => tx('audios', 'readonly', s => s.get(id));
export const borrarAudio = id => tx('audios', 'readwrite', s => s.delete(id));

export const agregarPedazo = (id, blob) => tx('pedazos', 'readwrite', s => s.add({ id, blob }));
export async function unirPedazos(id) {
  const pedazos = await tx('pedazos', 'readonly', s => s.index('id').getAll(id));
  return new Blob(pedazos.map(p => p.blob), { type: pedazos[0]?.blob.type || 'audio/webm' });
}
export const borrarPedazos = id => tx('pedazos', 'readwrite', s => {
  const c = s.index('id').openCursor(IDBKeyRange.only(id));
  c.onsuccess = () => { if (c.result) { c.result.delete(); c.result.continue(); } };
});
