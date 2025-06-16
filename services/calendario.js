document.addEventListener("DOMContentLoaded", () => {
    const mensaje = document.getElementById('mensaje-recoleccion');

    const martes = document.querySelectorAll('.recolecta.martes');
    const jueves = document.querySelectorAll('.recolecta.jueves');

    martes.forEach(td => {
        td.addEventListener('click', () => {
            mensaje.innerHTML = "📌 La recolección será el <strong>martes</strong> a las <strong>10:00am</strong>.";
        });
    });

    jueves.forEach(td => {
        td.addEventListener('click', () => {
            mensaje.innerHTML = "📌 La recolección será el <strong>jueves</strong> a las <strong>04:00pm</strong>.";
        });
    });
});
