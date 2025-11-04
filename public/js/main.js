document.addEventListener('DOMContentLoaded', function() {

    // Lógica para el menú móvil
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mainNav = document.querySelector('.main-nav');

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            mainNav.classList.toggle('active');
        });
    }

    // Lógica para seleccionar hora en el formulario de agendamiento
    const timeSlots = document.querySelectorAll('.time-slot-btn:not(.disabled)');
    timeSlots.forEach(slot => {
        slot.addEventListener('click', () => {
            // Primero, deseleccionar cualquier otro slot activo
            timeSlots.forEach(s => s.classList.remove('active'));
            // Luego, activar el clickeado
            slot.classList.add('active');
        });
    });

});

// --- Funciones para el formulario por pasos ---
function showStep(stepNumber) {
    const steps = document.querySelectorAll('.form-step');
    steps.forEach(step => {
        step.classList.remove('active');
    });
    document.getElementById(`step${stepNumber}`).classList.add('active');
}

function nextStep(stepNumber) {
    // Aquí podrías añadir validaciones antes de pasar al siguiente paso
    showStep(stepNumber);
}

function prevStep(stepNumber) {
    showStep(stepNumber);
}