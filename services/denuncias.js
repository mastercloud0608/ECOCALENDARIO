// ===========================
// 📣 Funcionalidades para Denuncias
// ===========================

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
    mostrarDenuncias();
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

  // ===== Mostrar denuncias aprobadas =====
  function mostrarDenuncias() {
    try {
      const todas = JSON.parse(localStorage.getItem('denuncias') || '[]');
      const aprobadas = todas.filter(d => d.aprobada === true);

      // Remover skeletons
      const skeletons = lista.querySelectorAll('.skeleton');
      skeletons.forEach(skeleton => skeleton.remove());

      if (aprobadas.length === 0) {
        mostrarEstadoVacio();
      } else {
        lista.innerHTML = '';
        aprobadas
          .sort((a, b) => new Date(b.fecha) - new Date(a.fecha)) // Más recientes primero
          .forEach((denuncia, index) => {
            crearElementoDenuncia(denuncia, index);
          });
      }
    } catch (error) {
      console.error('Error al cargar denuncias:', error);
      mostrarError('Error al cargar las denuncias');
    }
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
        return fechaStr; // Retornar string original si no se puede parsear
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
    // Validar tipo
    if (!archivo.type.startsWith('image/')) {
      mostrarError(`${archivo.name} no es una imagen válida`);
      return false;
    }
    
    // Validar tamaño
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

  // Función global para eliminar fotos (accesible desde onclick)
  window.eliminarFoto = function(index) {
    if (index >= 0 && index < fotosSeleccionadas.length) {
      fotosSeleccionadas.splice(index, 1);
      actualizarPreview();
      
      // Limpiar el input file para permitir re-seleccionar la misma imagen
      fotosInput.value = '';
    }
  };

  // Función global para abrir modal (accesible desde onclick)
  window.abrirModal = function(src) {
    modal.classList.add('active');
    modalImg.src = src;
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; // Prevenir scroll del body
    
    // Focus en el botón de cerrar para accesibilidad
    setTimeout(() => modalClose.focus(), 100);
  };

  function cerrarModal() {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = ''; // Restaurar scroll
    modalImg.src = '';
  }

  // ===== Drag and Drop =====
  function configurarDragAndDrop() {
    // Prevenir comportamiento por defecto en toda la página
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      document.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Efectos visuales para el área de drop
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

    // Manejar drop
    fileLabel.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
      const dt = e.dataTransfer;
      const files = Array.from(dt.files);
      procesarArchivos(files);
    }
  }

  // ===== Envío del formulario =====
  function manejarEnvioFormulario(e) {
    e.preventDefault();
    
    if (!validarFormulario()) {
      return;
    }
    
    // Mostrar estado de carga
    form.classList.add('loading');
    const submitBtn = form.querySelector('.btn-submit');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span>Enviando...</span>';
    submitBtn.disabled = true;

    try {
      // Crear nueva denuncia
      const nuevaDenuncia = {
        id: Date.now(),
        titulo: titulo.value.trim(),
        descripcion: descripcion.value.trim(),
        fotos: fotosSeleccionadas.map(foto => foto.data), // Solo guardar los datos base64
        aprobada: false,
        fecha: new Date().toISOString()
      };

      // Guardar en localStorage
      const denunciasActuales = JSON.parse(localStorage.getItem('denuncias') || '[]');
      denunciasActuales.push(nuevaDenuncia);
      localStorage.setItem('denuncias', JSON.stringify(denunciasActuales));

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
      // Restaurar estado del formulario
      form.classList.remove('loading');
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  }

  function validarFormulario() {
    let esValido = true;
    
    // Limpiar errores previos
    limpiarErrores();
    
    // Validar título
    if (!titulo.value.trim()) {
      mostrarErrorCampo(titulo, 'El título es obligatorio');
      esValido = false;
    } else if (titulo.value.trim().length < 5) {
      mostrarErrorCampo(titulo, 'El título debe tener al menos 5 caracteres');
      esValido = false;
    }
    
    // Validar descripción
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
    
    // Remover error al empezar a escribir
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
    
    // Ocultar mensaje después de 5 segundos
    setTimeout(() => {
      mensaje.style.display = 'none';
    }, 5000);
  }

  // ===== Utilidades =====
  function mostrarError(mensajeError) {
    // Crear toast de error temporal
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
    
    // Remover después de 4 segundos
    setTimeout(() => {
      toast.style.animation = 'slideOutToRight 0.3s ease-in forwards';
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 300);
    }, 4000);
  }

  // ===== Funciones de depuración (solo para desarrollo) =====
  function agregarFuncionesDevelopment() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      // Función para crear denuncias de prueba
      window.crearDenunciasPrueba = function() {
        const denunciasPrueba = [
          {
            id: Date.now() + 1,
            titulo: "Basura acumulada en la esquina de la calle principal",
            descripcion: "Hay una gran cantidad de basura acumulada que no ha sido recogida por varios días. Está generando malos olores y atrayendo insectos.",
            fotos: [],
            aprobada: true,
            fecha: new Date(Date.now() - 86400000).toISOString() // Ayer
          },
          {
            id: Date.now() + 2,
            titulo: "Contenedor de basura roto",
            descripcion: "El contenedor ubicado frente al parque está roto y la basura se esparce por toda la acera cuando hay viento.",
            fotos: [],
            aprobada: true,
            fecha: new Date(Date.now() - 172800000).toISOString() // Hace 2 días
          }
        ];
        
        const actuales = JSON.parse(localStorage.getItem('denuncias') || '[]');
        const nuevas = [...actuales, ...denunciasPrueba];
        localStorage.setItem('denuncias', JSON.stringify(nuevas));
        
        mostrarDenuncias();
        console.log('Denuncias de prueba creadas');
      };
      
      // Función para limpiar denuncias
      window.limpiarDenuncias = function() {
        localStorage.removeItem('denuncias');
        mostrarDenuncias();
        console.log('Denuncias eliminadas');
      };
    }
  }

  // Agregar funciones de desarrollo si estamos en localhost
  agregarFuncionesDevelopment();

  // ===== Manejo de errores globales =====
  window.addEventListener('error', (e) => {
    console.error('Error global capturado:', e.error);
    // No mostrar errores técnicos al usuario en producción
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      mostrarError(`Error técnico: ${e.message}`);
    }
  });

  // ===== Agregar estilos CSS para animaciones de toast =====
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