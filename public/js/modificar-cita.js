// ===============================================
// FUNCIONES DE PASOS (¡ESTO FALTABA!)
// ===============================================
let currentStep = 1;
const steps = document.querySelectorAll('.form-step');

function showStep(step) {
    steps.forEach((el, index) => {
        el.classList.toggle('active', index + 1 === step);
    });
    currentStep = step;
}

function nextStep(step) {
    if (step === 3) {
        // Llenar el resumen antes de ir al paso 3
        fillSummary();
    }
    showStep(step);
}

function prevStep(step) {
    showStep(step);
}

// Llenar el resumen (Paso 3)
function fillSummary() {
    // Obtener los TEXTOS seleccionados
    const specialtyText = document.getElementById('specialty').selectedOptions[0].text;
    const doctorText = document.getElementById('doctor').selectedOptions[0].text;
    const dateValue = document.getElementById('date').value;
    const timeText = document.getElementById('selectedTime').value;

    // Formatear la fecha (para evitar errores si está vacía)
    const dateText = dateValue ? new Date(dateValue).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : '...';

    // Ponerlos en el resumen
    document.getElementById('summary-specialty').textContent = specialtyText;
    document.getElementById('summary-doctor').textContent = doctorText;
    document.getElementById('summary-datetime').textContent = `${dateText} a las ${timeText}`;
}


// ===============================================
// LÓGICA DINÁMICA (MODIFICAR CITA)
// ===============================================
document.addEventListener('DOMContentLoaded', () => {
    
    // Selectores
    const specialtySelect = document.getElementById('specialty');
    const doctorSelect = document.getElementById('doctor');
    const dateInput = document.getElementById('date');
    const timeSlotsContainer = document.getElementById('timeSlotsContainer');
    const selectedTimeInput = document.getElementById('selectedTime');
    
    // Restricción de Fechas (no días pasados)
    const hoy = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', hoy);

    // Variables de datos pre-cargados (leídas del EJS)
    const medicoIdOriginal = doctorSelect.dataset.medicoId;
    const horaOriginal = selectedTimeInput.value;
    const fechaOriginal = dateInput.value; // Guardamos la fecha original

    // --- Funciones de Carga (API) ---

    // 1. Carga médicos
    const loadDoctors = async (specialty, idParaSeleccionar = null) => {
        doctorSelect.innerHTML = '<option value="">Cargando médicos...</option>';
        if (!specialty) {
            doctorSelect.innerHTML = '<option value="">Selecciona una especialidad...</option>';
            return;
        }
        try {
            const response = await fetch(`/api/medicos/${specialty}`);
            if (!response.ok) throw new Error('Error al cargar médicos');
            const medicos = await response.json();

            doctorSelect.innerHTML = '<option value="">Selecciona un médico...</option>';
            medicos.forEach(medico => {
                const option = document.createElement('option');
                option.value = medico._id;
                option.textContent = medico.nombre;
                if (medico._id === idParaSeleccionar) {
                    option.selected = true;
                }
                doctorSelect.appendChild(option);
            });
        } catch (error) {
            console.error(error);
            doctorSelect.innerHTML = '<option value="">Error al cargar médicos</option>';
        }
    };

    // 2. Carga horarios
    const updateHorarios = async (horaParaSeleccionar = null) => {
        const medicoId = doctorSelect.value;
        const fecha = dateInput.value;
        
        timeSlotsContainer.innerHTML = '<p>Cargando horarios...</p>';
        selectedTimeInput.value = ''; // Limpiar por defecto
        
        if (!medicoId || !fecha) {
            timeSlotsContainer.innerHTML = '<p>Selecciona médico y fecha.</p>';
            return;
        }

        // Restricción de Fines de Semana
        const fechaSeleccionada = new Date(fecha + 'T00:00:00');
        const diaDeSemana = fechaSeleccionada.getUTCDay();
        if (diaDeSemana === 6 || diaDeSemana === 0) {
            alert('No se pueden agendar citas en sábado o domingo.');
            dateInput.value = '';
            timeSlotsContainer.innerHTML = '<p>Por favor, selecciona un día de lunes a viernes.</p>';
            return;
        }

        try {
            const response = await fetch(`/api/horarios/${medicoId}/${fecha}`);
            if (!response.ok) throw new Error('Error al cargar horarios');
            const data = await response.json(); 

            const ahora = new Date();
            const esHoy = (new Date(fecha + 'T00:00:00').toDateString() === ahora.toDateString());
            let slotsParaMostrar = data.disponibles;

            // Lógica para no ocultar la hora original si la fecha es hoy
            const esFechaOriginal = (fecha === fechaOriginal);
            if (esFechaOriginal && !slotsParaMostrar.includes(horaOriginal)) {
                 slotsParaMostrar.push(horaOriginal);
                 slotsParaMostrar.sort();
            }

            if (esHoy) {
                const tiempoActual = ahora.getHours().toString().padStart(2, '0') + ":" + ahora.getMinutes().toString().padStart(2, '0');
                slotsParaMostrar = slotsParaMostrar.filter(slot => {
                    return slot > tiempoActual || (slot === horaOriginal && esFechaOriginal); // Permitir el slot original solo si es la fecha original
                });
            }

            timeSlotsContainer.innerHTML = '<p>Horas disponibles:</p>';
            if (slotsParaMostrar && slotsParaMostrar.length > 0) {
                slotsParaMostrar.forEach(hora => {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'time-slot-btn';
                    button.textContent = hora;
                    
                    button.addEventListener('click', () => {
                        document.querySelectorAll('.time-slot-btn.active').forEach(btn => btn.classList.remove('active'));
                        button.classList.add('active');
                        selectedTimeInput.value = hora;
                    });
                    
                    if (hora === horaParaSeleccionar && esFechaOriginal) {
                        button.click();
                    }
                    timeSlotsContainer.appendChild(button);
                });
            } else {
                timeSlotsContainer.innerHTML = '<p>No hay horarios disponibles.</p>';
            }
        } catch (error) {
            console.error(error);
            timeSlotsContainer.innerHTML = '<p>Error al cargar horarios.</p>';
        }
    };
    
    // --- Event Listeners ---
    specialtySelect.addEventListener('change', () => {
        // Al cambiar la especialidad, reseteamos la hora
        selectedTimeInput.value = '';
        loadDoctors(specialtySelect.value);
        updateHorarios();
    });
    
    doctorSelect.addEventListener('change', () => {
        selectedTimeInput.value = ''; // Resetear hora
        updateHorarios();
    });
    
    dateInput.addEventListener('change', () => {
        selectedTimeInput.value = ''; // Resetear hora
        updateHorarios();
    });

    // --- Lógica de PRE-CARGA ---
    const preCargarDatos = async () => {
        // 1. Carga los doctores y selecciona el original
        await loadDoctors(specialtySelect.value, medicoIdOriginal);
        // 2. Carga los horarios y selecciona el original
        await updateHorarios(horaOriginal);
    };

    preCargarDatos();
});