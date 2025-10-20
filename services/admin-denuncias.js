// services/admin-denuncias.js - Con Firebase
import { 
  getDatabase, 
  ref, 
  onValue, 
  update,
  remove,
  get
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAh5BW3Yg6pFNfDVynYXcHOiA96G5ZPr2w",
  authDomain: "ecocalendario-51a84.firebaseapp.com",
  projectId: "ecocalendario-51a84",
  storageBucket: "ecocalendario-51a84.firebasestorage.app",
  messagingSenderId: "276857323066",
  appId: "1:276857323066:web:99b3f8f2e9d0d471d97f03",
  measurementId: "G-VXCZYN6WNC",
  databaseURL: "https://ecocalendario-51a84-default-rtdb.firebaseio.com/"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const denunciasRef = ref(db, 'denuncias');

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

// ==== Estado global del panel ====
const state = {
  filtro: 'pendientes',
  query: '',
  seleccionadoId: null,
  denuncias: [] // Cache local de denuncias
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
  escucharDenuncias();
});

// ==== Escuchar denuncias en tiempo real ====
function escucharDenuncias() {
  onValue(denunciasRef, (snapshot) => {
    const denunciasObj = snapshot.val();
    
    if (!denunciasObj) {
      state.denuncias = [];
    } else {
      // Convertir objeto a array
      state.denuncias = Object.entries(denunciasObj)
        .map(([id, data]) => ({
          id,
          titulo: data.titulo || '',
          descripcion: data.descripcion || '',
          fotos: Array.isArray(data.fotos) ? data.fotos : [],
          aprobada: !!data.aprobada,
          timestamp: data.timestamp || Date.now(),
          fecha: data.fecha || new Date().toISOString()
        }))
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }
    
    updateCounts();
    renderList();
  }, (error) => {
    console.error('Error al cargar denuncias:', error);
    mostrarError('Error al cargar las denuncias desde Firebase');
  });
}

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

  // Cerrar modales
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

// ==== Actualizar contadores ====
function updateCounts() {
  const all = state.denuncias;
  const pend = all.filter(d => !d.aprobada).length;
  const apr  = all.filter(d => d.aprobada).length;

  const elP = qs('#count-pendientes');
  const elA = qs('#count-aprobadas');
  const elT = qs('#count-todas');
  if (elP) elP.textContent = pend;
  if (elA) elA.textContent = apr;
  if (elT) elT.textContent = all.length;
}

// ==== Aplicar filtros ====
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

// ==== Renderizar lista ====
function renderList() {
  const grid = qs('#denuncias-grid');
  const empty = qs('#lista-vacia');
  if (!grid) return;

  const rows = applyFilterAndSearch(state.denuncias);

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

    // Miniaturas de fotos
    const thumbsWrap = document.createElement('div');
    thumbsWrap.className = 'thumbs';
    thumbsWrap.setAttribute('role', 'list');
    if (Array.isArray(d.fotos) && d.fotos.length > 0) {
      const first3 = d.fotos.slice(0, 3);
      first3.forEach(foto => {
        const img = document.createElement('img');
        img.src = foto;
        img.alt = 'Evidencia';
        img.addEventListener('click', () => openImageModal(foto));
        thumbsWrap.appendChild(img);
      });
    }

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
  });

  // Delegación de eventos
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

// ==== Acciones sobre denuncias ====
async function approveById(id) {
  const den = state.denuncias.find(d => d.id === id);
  if (!den) return;

  if (den.aprobada) {
    alert('Esta denuncia ya está aprobada.');
    return;
  }
  
  if (!confirm('¿Aprobar esta denuncia?')) return;

  try {
    const denunciaRef = ref(db, `denuncias/${id}`);
    await update(denunciaRef, { aprobada: true });
    mostrarExito('Denuncia aprobada correctamente');
  } catch (error) {
    console.error('Error al aprobar:', error);
    mostrarError('Error al aprobar la denuncia');
  }
}

async function deleteById(id) {
  if (!confirm('¿Eliminar esta denuncia? Esta acción no se puede deshacer.')) return;

  try {
    const denunciaRef = ref(db, `denuncias/${id}`);
    await remove(denunciaRef);
    mostrarExito('Denuncia eliminada correctamente');
  } catch (error) {
    console.error('Error al eliminar:', error);
    mostrarError('Error al eliminar la denuncia');
  }
}

// ==== Modal de detalle ====
function openDetailModal(id) {
  const den = state.denuncias.find(d => d.id === id);
  if (!den) return;

  state.seleccionadoId = den.id;

  qs('#md-fecha').textContent = formatDate(den.fecha);
  qs('#md-titulo').textContent = den.titulo || '(Sin título)';
  qs('#md-descripcion').textContent = den.descripcion || '(Sin descripción)';

  const fotosWrap = qs('#md-fotos');
  if (fotosWrap) {
    fotosWrap.innerHTML = '';
    if (Array.isArray(den.fotos) && den.fotos.length) {
      den.fotos.forEach((foto, i) => {
        const img = document.createElement('img');
        img.src = foto;
        img.alt = `Evidencia ${i + 1}`;
        img.addEventListener('click', () => openImageModal(foto));
        fotosWrap.appendChild(img);
      });
    } else {
      fotosWrap.innerHTML = '<div class="meta">No hay fotos adjuntas.</div>';
    }
  }

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

// ==== Notificaciones ====
function mostrarError(mensaje) {
  mostrarToast(mensaje, 'error');
}

function mostrarExito(mensaje) {
  mostrarToast(mensaje, 'success');
}

function mostrarToast(mensaje, tipo = 'info') {
  const toast = document.createElement('div');
  const bgColor = tipo === 'error' ? '#f44336' : tipo === 'success' ? '#4CAF50' : '#2196F3';
  
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${bgColor};
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10001;
    font-weight: 600;
    max-width: 350px;
    word-wrap: break-word;
    animation: slideInFromRight 0.3s ease-out;
  `;
  toast.textContent = mensaje;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOutToRight 0.3s ease-in forwards';
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 300);
  }, 4000);
}

// ==== Estilos CSS ====
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInFromRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOutToRight {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);