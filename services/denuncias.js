document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('formDenuncia');
  const titulo = document.getElementById('titulo');
  const descripcion = document.getElementById('descripcion');
  const mensaje = document.getElementById('mensajeExito');
  const lista = document.getElementById('lista-denuncias');

  // Mostrar denuncias aprobadas
  const todas = JSON.parse(localStorage.getItem('denuncias') || '[]');
  const aprobadas = todas.filter(d => d.aprobada === true);

  if (aprobadas.length === 0) {
    lista.innerHTML = "<p>No hay denuncias aprobadas aún.</p>";
  } else {
    aprobadas.forEach(d => {
      const div = document.createElement('div');
      div.classList.add('noticia');
      div.innerHTML = `<h3>${d.titulo}</h3><p>${d.descripcion}</p>`;
      lista.appendChild(div);
    });
  }

  // Guardar denuncia
  form.addEventListener('submit', e => {
    e.preventDefault();

    const nueva = {
      id: Date.now(),
      titulo: titulo.value.trim(),
      descripcion: descripcion.value.trim(),
      aprobada: false
    };

    const actuales = JSON.parse(localStorage.getItem('denuncias') || '[]');
    actuales.push(nueva);
    localStorage.setItem('denuncias', JSON.stringify(actuales));

    form.reset();
    mensaje.style.display = 'block';
    setTimeout(() => mensaje.style.display = 'none', 4000);
  });
});
