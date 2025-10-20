// ===========================
// 📣 Funcionalidades para Denuncias con Firebase
// ===========================

import { 
  getDatabase, 
  ref, 
  onValue, 
  push, 
  set,
  remove 
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";

// Configuración de Firebase (la misma que usas para ubicaciones)
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

document.addEventListener('DOMContentLoaded', () => {
  // Elementos del DOM
  const form = document.getElementById('formDenuncia');
  const titulo = document.getElementById('titulo');
  const descripcion = document.getElementById('descripcion');
  const fotosInput = document.getElementById('fotos');
  const mensaje = document.getElementById('mensajeExito');
  const lista = document.getElementById('lista-denuncias');
  const previewContainer = document.getElementById('preview-container');
  const modal = document.getElementById('modal');
  const modalImg = document.getElementById('modal-img');
  const modalClose = document.querySelector('.modal-close');
  const modalBackdrop = document.querySelector('.modal-backdrop');
  const fileLabel = document.querySelector('.file-input-label');

  // Estado de la aplicación
  let fotosSeleccionadas = [];
  const MAX_FOTOS = 5;
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  // ===== Inicialización =====
  init();

  function init() {
    escucharDenuncias(); // Escuchar cambios en Firebase en tiempo real
    configurarEventListeners();
    configurarDragAndDrop();
  }

  // ===== Configurar Event Listeners =====
  function configurarEventListeners() {
    // Formulario
    form.addEventListener('submit', manejarEnvioFormulario);
    
    // Input de fotos
    fotosInput.addEventListener('change', manejarSeleccionFotos);
    
    // Modal
    modalClose.addEventListener('click', cerrarModal);
    modalBackdrop.addEventListener('click', cerrarModal);
    
    // Teclado para modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        cerrarModal();
      }
    });

    // Prevenir envío accidental del formulario con Enter en inputs
    titulo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        descripcion.focus();
      }
    });
  }

  // ===== Escuchar denuncias en tiempo real desde Firebase =====
  function escucharDenuncias() {
    onValue(denunciasRef, (snapshot) => {
      const denunciasObj = snapshot.val();
      
      // Remover skeletons
      const skeletons = lista.querySelectorAll('.skeleton');
      skeletons.forEach(skeleton => skeleton.remove());

      if (!denunciasObj) {
        mostrarEstadoVacio();
        return;
      }

      // Convertir objeto a array y filtrar aprobadas
      const denunciasArray = Object.entries(denunciasObj)
        .map(([id, data]) => ({ id, ...data }))
        .filter(d => d.aprobada === true)
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

      if (denunciasArray.length === 0) {
        mostrarEstadoVacio();
      } else {
        lista.innerHTML = '';
        denunciasArray.forEach((denuncia, index) => {
          crearElementoDenuncia(denuncia, index);
        });
      }
    }, (error) => {
      console.error('Error al cargar denuncias:', error);
      mostrarError('Error al cargar las denuncias');
    });
  }

  function mostrarEstadoVacio() {
    lista.innerHTML = `
      <div class="empty-state">
        <div class="icon">📭</div>
        <h4>No hay denuncias reportadas</h4>
        <p>Sé el primero en reportar un problema en tu comunidad</p>
      </div>
    `;
  }

  function crearElementoDenuncia(denuncia, index) {
    const div = document.createElement('div');
    div.classList.add('denuncia-item');
    div.style.animationDelay = `${index * 0.1}s`;
    
    let fotosHtml = '';
    if (denuncia.fotos && denuncia.fotos.length > 0) {
      fotosHtml = `
        <div class="denuncia-fotos">
          ${denuncia.fotos.map(foto => 
            `<img src="${foto}" alt="Evidencia de la denuncia" onclick="abrirModal('${foto}')">`
          ).join('')}
        </div>
      `;
    }
    
    const fecha = denuncia.fecha ? formatearFecha(denuncia.fecha) : 'Fecha no disponible';
    
    div.innerHTML = `
      <div class="denuncia-fecha">${fecha}</div>
      <h4>${sanitizarHTML(denuncia.titulo)}</h4>
      <p>${sanitizarHTML(denuncia.descripcion)}</p>
      ${fotosHtml}
    `;
    
    lista.appendChild(div);
  }

  function formatearFecha(fechaStr) {
    try {
      const fecha = new Date(fechaStr);
      if (isNaN(fecha.getTime())) {
        return fechaStr;
      }
      return fecha.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return fechaStr;
    }
  }

  function sanitizarHTML(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
  }

  // ===== Manejo de archivos =====
  function manejarSeleccionFotos(e) {
    const archivos = Array.from(e.target.files);
    procesarArchivos(archivos);
  }

  function procesarArchivos(archivos) {
    archivos.forEach(archivo => {
      if (validarArchivo(archivo)) {
        if (fotosSeleccionadas.length < MAX_FOTOS) {
          convertirArchivoABase64(archivo);
        } else {
          mostrarError(`Máximo ${MAX_FOTOS} fotos permitidas`);
        }
      }
    });
  }

  function validarArchivo(archivo) {
    if (!archivo.type.startsWith('image/')) {
      mostrarError(`${archivo.name} no es una imagen válida`);
      return false;
    }
    
    if (archivo.size > MAX_FILE_SIZE) {
      mostrarError(`${archivo.name} es muy grande (máximo 5MB)`);
      return false;
    }
    
    return true;
  }

  function convertirArchivoABase64(archivo) {
    const reader = new FileReader();
    reader.onload = function(e) {
      fotosSeleccionadas.push({
        data: e.target.result,
        name: archivo.name,
        size: archivo.size
      });
      actualizarPreview();
    };
    reader.onerror = function() {
      mostrarError(`Error al procesar ${archivo.name}`);
    };
    reader.readAsDataURL(archivo);
  }

  // ===== Preview de fotos =====
  function actualizarPreview() {
    previewContainer.innerHTML = '';
    fotosSeleccionadas.forEach((foto, index) => {
      const previewItem = document.createElement('div');
      previewItem.classList.add('preview-item');
      previewItem.innerHTML = `
        <img src="${foto.data}" alt="Preview de ${foto.name}">
        <button type="button" class="remove-btn" onclick="eliminarFoto(${index})" aria-label="Eliminar foto ${index + 1}">
          ×
        </button>
      `;
      previewContainer.appendChild(previewItem);
    });
  }

  window.eliminarFoto = function(index) {
    if (index >= 0 && index < fotosSeleccionadas.length) {
      fotosSeleccionadas.splice(index, 1);
      actualizarPreview();
      fotosInput.value = '';
    }
  };

  window.abrirModal = function(src) {
    modal.classList.add('active');
    modalImg.src = src;
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => modalClose.focus(), 100);
  };

  function cerrarModal() {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    modalImg.src = '';
  }

  // ===== Drag and Drop =====
  function configurarDragAndDrop() {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      document.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
      fileLabel.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      fileLabel.addEventListener(eventName, unhighlight, false);
    });

    function highlight() {
      fileLabel.classList.add('dragover');
    }

    function unhighlight() {
      fileLabel.classList.remove('dragover');
    }

    fileLabel.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
      const dt = e.dataTransfer;
      const files = Array.from(dt.files);
      procesarArchivos(files);
    }
  }

  // ===== Envío del formulario =====
  async function manejarEnvioFormulario(e) {
    e.preventDefault();
    
    if (!validarFormulario()) {
      return;
    }
    
    form.classList.add('loading');
    const submitBtn = form.querySelector('.btn-submit');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span>Enviando...</span>';
    submitBtn.disabled = true;

    try {
      // Crear nueva denuncia
const nuevaDenuncia = {
  titulo: titulo.value.trim(),
  descripcion: descripcion.value.trim(),
  fotos: fotosSeleccionadas.map(foto => foto.data),
  aprobada: false,
  timestamp: Date.now(),
  fecha: new Date().toISOString() // Mantener para mostrar
};

      // Guardar en Firebase usando push (genera ID automático)
      await push(denunciasRef, nuevaDenuncia);

      // Limpiar formulario
      limpiarFormulario();
      
      // Mostrar mensaje de éxito
      mostrarMensajeExito();
      
      // Scroll suave al mensaje
      mensaje.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
    } catch (error) {
      console.error('Error al guardar denuncia:', error);
      mostrarError('Error al enviar la denuncia. Por favor, inténtalo de nuevo.');
    } finally {
      form.classList.remove('loading');
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  }

  function validarFormulario() {
    let esValido = true;
    
    limpiarErrores();
    
    if (!titulo.value.trim()) {
      mostrarErrorCampo(titulo, 'El título es obligatorio');
      esValido = false;
    } else if (titulo.value.trim().length < 5) {
      mostrarErrorCampo(titulo, 'El título debe tener al menos 5 caracteres');
      esValido = false;
    }
    
    if (!descripcion.value.trim()) {
      mostrarErrorCampo(descripcion, 'La descripción es obligatoria');
      esValido = false;
    } else if (descripcion.value.trim().length < 10) {
      mostrarErrorCampo(descripcion, 'La descripción debe tener al menos 10 caracteres');
      esValido = false;
    }
    
    return esValido;
  }

  function mostrarErrorCampo(campo, mensaje) {
    campo.classList.add('error');
    
    const errorDiv = document.createElement('div');
    errorDiv.classList.add('error-message');
    errorDiv.textContent = mensaje;
    
    campo.parentNode.appendChild(errorDiv);
    
    campo.addEventListener('input', function removerError() {
      campo.classList.remove('error');
      const errorMsg = campo.parentNode.querySelector('.error-message');
      if (errorMsg) {
        errorMsg.remove();
      }
      campo.removeEventListener('input', removerError);
    });
  }

  function limpiarErrores() {
    const campos = [titulo, descripcion];
    campos.forEach(campo => {
      campo.classList.remove('error');
      const errorMsg = campo.parentNode.querySelector('.error-message');
      if (errorMsg) {
        errorMsg.remove();
      }
    });
  }

  function limpiarFormulario() {
    form.reset();
    fotosSeleccionadas = [];
    actualizarPreview();
    limpiarErrores();
  }

  function mostrarMensajeExito() {
    mensaje.style.display = 'flex';
    mensaje.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    setTimeout(() => {
      mensaje.style.display = 'none';
    }, 5000);
  }

  function mostrarError(mensajeError) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--danger);
      color: white;
      padding: 1rem 1.5rem;
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow-md);
      z-index: 10001;
      font-weight: 600;
      max-width: 350px;
      word-wrap: break-word;
      animation: slideInFromRight 0.3s ease-out;
    `;
    toast.textContent = mensajeError;
    
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

  // ===== Agregar estilos CSS para animaciones =====
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
});