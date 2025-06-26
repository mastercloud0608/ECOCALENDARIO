document.addEventListener('DOMContentLoaded', () => {
  const usuario = JSON.parse(localStorage.getItem('usuarioActivo') || '{}');

  if (!usuario || usuario.rol !== 'admin') {
    alert('Acceso no autorizado.');
    window.location.href = 'login.html';
    return;
  }

  document.getElementById('admin-nombre').innerText += ` - ${usuario.nombre}`;
  cargarDenuncias();
});

function verUsuarios() {
  const usuarios = JSON.parse(localStorage.getItem('usuarios') || '[]');
  if (usuarios.length === 0) return alert("No hay usuarios registrados.");

  let listado = "Usuarios registrados:\n\n";
  usuarios.forEach((u, i) => {
    listado += `${i + 1}. ${u.nombre} (${u.rol}) - ${u.correo}\n`;
  });

  alert(listado);
}

function logout() {
  localStorage.removeItem('loggedIn');
  localStorage.removeItem('usuarioActivo');
  window.location.href = 'login.html';
}

function cargarDenuncias() {
  const contenedor = document.getElementById('denuncias-pendientes');
  contenedor.innerHTML = '';
  const denuncias = JSON.parse(localStorage.getItem('denuncias') || '[]');

  const pendientes = denuncias.filter(d => !d.aprobada);
  if (pendientes.length === 0) {
    contenedor.innerHTML = '<p>No hay denuncias pendientes.</p>';
    return;
  }

  pendientes.forEach((denuncia, index) => {
    const div = document.createElement('div');
    div.className = 'evento';
    div.innerHTML = `
      <h4>${denuncia.titulo}</h4>
      <p>${denuncia.descripcion}</p>
      <button onclick="aprobarDenuncia(${index})" class="btn-submit">Aprobar</button>
      <button onclick="eliminarDenuncia(${index})" class="btn-debug">Eliminar</button>
    `;
    contenedor.appendChild(div);
  });
}

function aprobarDenuncia(index) {
  const denuncias = JSON.parse(localStorage.getItem('denuncias') || '[]');
  const pendientes = denuncias.filter(d => !d.aprobada);
  const denuncia = pendientes[index];
  const originalIndex = denuncias.findIndex(d => d.titulo === denuncia.titulo && d.descripcion === denuncia.descripcion);

  if (originalIndex !== -1) {
    denuncias[originalIndex].aprobada = true;
    localStorage.setItem('denuncias', JSON.stringify(denuncias));
    cargarDenuncias();
  }
}

function eliminarDenuncia(index) {
  let denuncias = JSON.parse(localStorage.getItem('denuncias') || '[]');
  const pendientes = denuncias.filter(d => !d.aprobada);
  const denunciaEliminada = pendientes[index];

  denuncias = denuncias.filter(d => !(d.titulo === denunciaEliminada.titulo && d.descripcion === denunciaEliminada.descripcion));
  localStorage.setItem('denuncias', JSON.stringify(denuncias));
  cargarDenuncias();
}
