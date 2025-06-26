let usuarios = JSON.parse(localStorage.getItem('usuarios') || '[]');

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registro-form');
  form.addEventListener('submit', validarFormulario);
  validarEnTiempoReal();
});

function validarFormulario(event) {
  event.preventDefault();

  const nombre = document.getElementById('nombre').value.trim();
  const correo = document.getElementById('correo').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirm-password').value;

  limpiarErrores();
  let esValido = true;

  if (nombre.length < 2) {
    mostrarError('nombre', 'El nombre debe tener al menos 2 caracteres');
    esValido = false;
  }

  const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regexCorreo.test(correo)) {
    mostrarError('correo', 'Correo no válido');
    esValido = false;
  }

  if (usuarios.some(u => u.correo === correo)) {
    mostrarError('correo', 'Este correo ya está registrado');
    esValido = false;
  }

  if (password.length < 8) {
    mostrarError('password', 'La contraseña debe tener al menos 8 caracteres');
    esValido = false;
  }

  if (password !== confirmPassword) {
    mostrarError('confirm-password', 'Las contraseñas no coinciden');
    esValido = false;
  }

  if (esValido) {
    const nuevo = {
      id: Date.now(),
      nombre,
      correo,
      password,
      fecha: new Date().toLocaleString(),
      rol: correo === "admin@basurero.com" ? "admin" : "usuario"
    };

    usuarios.push(nuevo);
    localStorage.setItem('usuarios', JSON.stringify(usuarios));
    alert("✅ Registro exitoso. Bienvenido/a " + nombre);
    document.getElementById('registro-form').reset();
  }
}

function mostrarError(campo, mensaje) {
  const input = document.getElementById(campo);
  const formGroup = input.parentElement;
  let error = formGroup.querySelector('.error-message');
  if (!error) {
    error = document.createElement('span');
    error.className = 'error-message';
    error.style.color = 'red';
    formGroup.appendChild(error);
  }
  error.textContent = mensaje;
  input.style.borderColor = 'red';
}

function limpiarErrores() {
  document.querySelectorAll('.error-message').forEach(e => e.remove());
  document.querySelectorAll('input').forEach(i => i.style.borderColor = '');
}

function validarEnTiempoReal() {
  document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', () => {
      input.style.borderColor = '';
      const error = input.parentElement.querySelector('.error-message');
      if (error) error.remove();
    });
  });
}

function mostrarUsuariosRegistrados() {
  if (usuarios.length === 0) return alert("No hay usuarios registrados aún.");
  let texto = "Usuarios registrados:\n\n";
  usuarios.forEach((u, i) => {
    texto += `${i + 1}. ${u.nombre} (${u.rol}) - ${u.correo}\n`;
  });
  alert(texto);
}
