document.addEventListener("DOMContentLoaded", () => {
    const mensaje = document.getElementById('mensaje-recoleccion');

    const lunes = document.querySelectorAll('.recolecta.lunes');
    const miercoles = document.querySelectorAll('.recolecta.miercoles');
    const viernes = document.querySelectorAll('.recolecta.viernes');

    lunes.forEach(td => {
        td.addEventListener('click', () => {
            mensaje.innerHTML = "📌 La recolección será el <strong>lunes</strong> a las <strong>10:00am</strong>.";
        });
    });

    miercoles.forEach(td => {
        td.addEventListener('click', () => {
            mensaje.innerHTML = "📌 La recolección será el <strong>miércoles</strong> a las <strong>10:00am</strong>.";
        });
    });

    viernes.forEach(td => {
        td.addEventListener('click', () => {
            mensaje.innerHTML = "📌 La recolección será el <strong>viernes</strong> a las <strong>04:00pm</strong>.";
        });
    });
});
