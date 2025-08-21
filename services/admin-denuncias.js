// services/admin-denuncias.js
// Panel de administración con: vista previa (modal), filtro (pendientes/aprobadas/todas), búsqueda,
// aprobación y eliminación por ID. Compatible con Base64 y con fotos en IndexedDB por ID.

// ==== Utilidades DOM ====
const qs  = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function sanitize(text = "") {
  const div = document.createElement('div');
  div.textContent = String(text ?? "");
  return div.innerHTML;
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso || 'Fecha no disponible';
    return d.toLocaleString('es-ES', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return iso || 'Fecha no disponible';
  }
}

// ==== IndexedDB (opcional) ====
// Soporte de lectura cuando `fotos` son IDs en IndexedDB (store 'fotos')
function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('denunciasDB', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('fotos')) db.createObjectStore('fotos'); // key: fotoId, value: Blob
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function idbGet(key) {
  try {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction('fotos', 'readonly');
      const req = tx.objectStore('fotos').get(key);
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => rej(req.error);
    });
  } catch {
    return null;
  }
}

// Determinar cómo obtener el src de una "foto"
function getIdFromRef(ref) {
  if (!ref) return null;
  if (typeof ref === 'string') return ref;
  if (typeof ref === 'object' && ref.id) return ref.id;
  return null;
}
function isDataOrHttpUrl(str) {
  return typeof str === 'string' && (/^data:/i.test(str) || /^https?:\/\//i.test(str));
}

/**
 * Resuelve una referencia de foto:
 * - Si es dataURL/URL: { src, objectUrl:false }
 * - Si parece ID: busca Blob en IDB y devuelve { src:ObjectURL, objectUrl:true } o {src:""} si no existe
 */
async function resolveFotoSrc(ref) {
  // Caso 1: string data: o http(s):
  if (isDataOrHttpUrl(ref)) {
    return { src: ref, objectUrl: false };
  }
  // Caso 2: objeto/string que representa un ID en IDB
  const id = getIdFromRef(ref);
  if (id && !isDataOrHttpUrl(id)) {
    const blob = await idbGet(id);
    if (blob) {
      const url = URL.createObjectURL(blob);
      return { src: url, objectUrl: true };
    }
  }
  return { src: '', objectUrl: false };
}

// Revocar ObjectURLs de todas las imágenes dentro de un contenedor al limpiar
function revokeObjectURLs(container) {
  qsa('img[data-objecturl="1"]', container).forEach(img => {
    try { URL.revokeObjectURL(img.src); } catch {}
  });
}

// ==== Acceso a almacenamiento de denuncias ====
function getDenuncias() {
  try {
    const arr = JSON.parse(localStorage.getItem('denuncias') || '[]');
    return arr
      .map(d => ({
        id: d.id ?? Date.now() + Math.random(),
        titulo: d.titulo ?? '',
        descripcion: d.descripcion ?? '',
        fotos: Array.isArray(d.fotos) ? d.fotos : [],
        aprobada: !!d.aprobada,
        fecha: d.fecha ?? new Date().toISOString()
      }))
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  } catch {
    return [];
  }
}
function saveDenuncias(list) {
  localStorage.setItem('denuncias', JSON.stringify(list));
}

// ==== Estado global del panel ====
const state = {
  filtro: 'pendientes', // 'pendientes' | 'aprobadas' | 'todas'
  query: '',
  seleccionadoId: null,
};

// ==== Autorización y boot ====
document.addEventListener('DOMContentLoaded', () => {
  const usuario = JSON.parse(localStorage.getItem('usuarioActivo') || '{}');
  if (!usuario || usuario.rol !== 'admin') {
    alert('Acceso no autorizado.');
    window.location.href = 'login.html';
    return;
  }
  const adminNombre = qs('#admin-nombre');
  if (adminNombre) adminNombre.innerText += ` - ${usuario.nombre}`;

  bindUI();
  renderAll();
});

// ==== Enlaces UI ====
function bindUI() {
  const btnLogout = qs('#btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('loggedIn');
      localStorage.removeItem('usuarioActivo');
      window.location.href = 'login.html';
    });
  }

  const inputBuscar = qs('#buscar');
  if (inputBuscar) {
    inputBuscar.addEventListener('input', (e) => {
      state.query = e.target.value.trim().toLowerCase();
      renderList();
    });
  }

  qsa('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      qsa('.chip').forEach(c => {
        c.dataset.active = 'false';
        c.setAttribute('aria-selected', 'false');
      });
      chip.dataset.active = 'true';
      chip.setAttribute('aria-selected', 'true');
      state.filtro = chip.dataset.filter;
      renderList();
    });
  });

  // Cerrar modales con botones y ESC
  qsa('[data-close-modal]').forEach(el => el.addEventListener('click', closeDetailModal));
  qsa('[data-close-img]').forEach(el => el.addEventListener('click', closeImageModal));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDetailModal();
      closeImageModal();
    }
  });

  // Publicación de noticias
  const formNoticia = qs('#formNoticia');
  if (formNoticia) {
    formNoticia.addEventListener('submit', (e) => {
      e.preventDefault();
      const t = qs('#notiTitulo').value.trim();
      const c = qs('#notiContenido').value.trim();
      if (!t || !c) return;

      const noticias = JSON.parse(localStorage.getItem('noticias') || '[]');
      noticias.unshift({
        titulo: t,
        contenido: c,
        fecha: new Date().toLocaleDateString('es-ES'),
        timestamp: Date.now()
      });
      localStorage.setItem('noticias', JSON.stringify(noticias));

      const msg = qs('#mensajeNoticia');
      if (msg) {
        msg.style.display = 'block';
        setTimeout(() => { msg.style.display = 'none'; }, 3000);
      }
      formNoticia.reset();
    });
  }
}

// ==== Render principal ====
function renderAll() {
  updateCounts();
  renderList();
}

function updateCounts() {
  const all = getDenuncias();
  const pend = all.filter(d => !d.aprobada).length;
  const apr  = all.filter(d => d.aprobada).length;

  const elP = qs('#count-pendientes');
  const elA = qs('#count-aprobadas');
  const elT = qs('#count-todas');
  if (elP) elP.textContent = pend;
  if (elA) elA.textContent = apr;
  if (elT) elT.textContent = all.length;
}

function applyFilterAndSearch(list) {
  let filtered = list;
  if (state.filtro === 'pendientes') filtered = filtered.filter(d => !d.aprobada);
  else if (state.filtro === 'aprobadas') filtered = filtered.filter(d => d.aprobada);

  if (state.query) {
    filtered = filtered.filter(d =>
      (d.titulo || '').toLowerCase().includes(state.query) ||
      (d.descripcion || '').toLowerCase().includes(state.query)
    );
  }
  return filtered;
}

// Crea miniaturas asíncronas y las inserta en un contenedor
async function populateThumbs(fotosRefs, container) {
  // Revocar URLs anteriores (si re-render)
  revokeObjectURLs(container);
  container.innerHTML = '';

  for (let i = 0; i < fotosRefs.length; i++) {
    const ref = fotosRefs[i];
    const { src, objectUrl } = await resolveFotoSrc(ref);
    const img = document.createElement('img');
    img.alt = 'Miniatura de evidencia';
    if (src) img.src = src;
    if (objectUrl) img.setAttribute('data-objecturl', '1');
    img.addEventListener('click', () => {
      if (img.src) openImageModal(img.src);
    });
    container.appendChild(img);
  }
}

function renderList() {
  const grid = qs('#denuncias-grid');
  const empty = qs('#lista-vacia');
  if (!grid) return;

  const all = getDenuncias();
  const rows = applyFilterAndSearch(all);

  // Limpiar y revocar URLs previas
  revokeObjectURLs(grid);
  grid.innerHTML = '';
  if (empty) empty.style.display = rows.length ? 'none' : 'block';

  rows.forEach(d => {
    const card = document.createElement('article');
    card.className = 'card';
    card.setAttribute('data-id', d.id);

    const badge = d.aprobada ? '<span class="badge aprobada">Aprobada</span>' : '<span class="badge pendiente">Pendiente</span>';
    const fecha = `<div class="fecha">${formatDate(d.fecha)}</div>`;
    const titulo = `<h4>${sanitize(d.titulo)}</h4>`;
    const desc = `<p>${sanitize(d.descripcion).slice(0, 160)}${(d.descripcion || '').length > 160 ? '…' : ''}</p>`;

    // Contenedor de thumbs (máx 3)
    const thumbsWrap = document.createElement('div');
    thumbsWrap.className = 'thumbs';
    thumbsWrap.setAttribute('role', 'list');
    thumbsWrap.setAttribute('aria-label', 'Imágenes de evidencia');

    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.innerHTML = `
      <button class="btn btn-outline" data-action="ver">Vista previa</button>
      ${!d.aprobada ? `<button class="btn btn-primary" data-action="aprobar">Aprobar</button>` : ''}
      <button class="btn btn-danger" data-action="eliminar">Eliminar</button>
    `;

    card.innerHTML = `${badge}${fecha}${titulo}${desc}`;
    card.appendChild(thumbsWrap);
    card.appendChild(actions);
    grid.appendChild(card);

    // Cargar miniaturas asíncronamente
    if (Array.isArray(d.fotos) && d.fotos.length) {
      const first3 = d.fotos.slice(0, 3);
      populateThumbs(first3, thumbsWrap);
    }
  });

  // Delegación de eventos para acciones
  grid.onclick = (ev) => {
    const card = ev.target.closest('.card');
    if (!card) return;
    const id = card.getAttribute('data-id');

    if (ev.target.matches('[data-action="ver"]')) {
      openDetailModal(id);
    } else if (ev.target.matches('[data-action="aprobar"]')) {
      approveById(id);
    } else if (ev.target.matches('[data-action="eliminar"]')) {
      deleteById(id);
    }
  };
}

// ==== Acciones ====
function approveById(id) {
  const all = getDenuncias();
  const idx = all.findIndex(d => String(d.id) === String(id));
  if (idx === -1) return;

  if (all[idx].aprobada) {
    alert('Esta denuncia ya está aprobada.');
    return;
  }
  if (!confirm('¿Aprobar esta denuncia?')) return;

  all[idx].aprobada = true;
  saveDenuncias(all);
  updateCounts();
  renderList();
}

function deleteById(id) {
  const all = getDenuncias();
  const idx = all.findIndex(d => String(d.id) === String(id));
  if (idx === -1) return;

  if (!confirm('¿Eliminar esta denuncia? Esta acción no se puede deshacer.')) return;

  all.splice(idx, 1);
  saveDenuncias(all);
  updateCounts();
  renderList();
}

// ==== Modal de detalle ====
async function openDetailModal(id) {
  const all = getDenuncias();
  const den = all.find(d => String(d.id) === String(id));
  if (!den) return;

  state.seleccionadoId = den.id;

  qs('#md-fecha').textContent = formatDate(den.fecha);
  qs('#md-titulo').textContent = den.titulo || '(Sin título)';
  qs('#md-descripcion').textContent = den.descripcion || '(Sin descripción)';

  const fotosWrap = qs('#md-fotos');
  if (fotosWrap) {
    revokeObjectURLs(fotosWrap);
    fotosWrap.innerHTML = '';
    if (Array.isArray(den.fotos) && den.fotos.length) {
      for (let i = 0; i < den.fotos.length; i++) {
        const ref = den.fotos[i];
        const { src, objectUrl } = await resolveFotoSrc(ref);
        const img = document.createElement('img');
        img.alt = `Evidencia ${i + 1}`;
        if (src) img.src = src;
        if (objectUrl) img.setAttribute('data-objecturl', '1');
        img.addEventListener('click', () => {
          if (img.src) openImageModal(img.src);
        });
        fotosWrap.appendChild(img);
      }
    } else {
      fotosWrap.innerHTML = '<div class="meta">No hay fotos adjuntas.</div>';
    }
  }

  // Configurar botones
  const btnApr = qs('#md-aprobar');
  const btnDel = qs('#md-eliminar');
  if (btnApr) {
    btnApr.style.display = den.aprobada ? 'none' : 'inline-block';
    btnApr.onclick = () => {
      approveById(den.id);
      closeDetailModal();
    };
  }
  if (btnDel) {
    btnDel.onclick = () => {
      deleteById(den.id);
      closeDetailModal();
    };
  }

  const modal = qs('#modal-denuncia');
  if (modal) {
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => btnApr && btnApr.focus(), 50);
  }
}

function closeDetailModal() {
  const modal = qs('#modal-denuncia');
  if (!modal || !modal.classList.contains('active')) return;
  // Revocar URLs de imágenes del modal
  const fotosWrap = qs('#md-fotos');
  if (fotosWrap) revokeObjectURLs(fotosWrap);

  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  state.seleccionadoId = null;
}

// ==== Modal de imagen grande ====
function openImageModal(src) {
  const imgModal = qs('#modal-img');
  const img = qs('#img-grande');
  if (!imgModal || !img) return;
  img.src = src;
  imgModal.classList.add('active');
  imgModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeImageModal() {
  const imgModal = qs('#modal-img');
  const img = qs('#img-grande');
  if (!imgModal || !img || !imgModal.classList.contains('active')) return;
  imgModal.classList.remove('active');
  imgModal.setAttribute('aria-hidden', 'true');
  img.src = '';
  document.body.style.overflow = '';
}
