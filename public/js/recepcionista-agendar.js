
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
        fillSummary(); // Llenar resumen antes de ir al paso final
    }
    showStep(step);
}

function prevStep(step) {
    showStep(step);
}

// Llenar el resumen (Paso 3)
function fillSummary() {
    // Obtenemos los datos de los inputs y selects
    const patientText = document.getElementById('selectedPatientName').value;
    const specialtyText = document.getElementById('specialty').selectedOptions[0].text;
    const doctorText = document.getElementById('doctor').selectedOptions[0].text;
    const dateValue = document.getElementById('date').value;
    const timeText = document.getElementById('selectedTime').value;

    const dateText = new Date(dateValue).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

    // Ponerlos en el resumen
    document.getElementById('summary-patient').textContent = patientText;
    document.getElementById('summary-specialty').textContent = specialtyText;
    document.getElementById('summary-doctor').textContent = doctorText;
    document.getElementById('summary-datetime').textContent = `${dateText} a las ${timeText}`;
}


// ===============================================
// LÓGICA PRINCIPAL (DOMContentLoaded)
// ===============================================
document.addEventListener('DOMContentLoaded', () => {

    // --- Selectores (Paso 1) ---
    const patientSearch = document.getElementById('patientSearch');
    const patientResults = document.getElementById('patientResults');
    const selectedPatientId = document.getElementById('selectedPatientId');
    const selectedPatientName = document.getElementById('selectedPatientName');
    const btnNextStep1 = document.getElementById('btnNextStep1');

    // --- Selectores (Paso 2) ---
    const specialtySelect = document.getElementById('specialty');
    const doctorSelect = document.getElementById('doctor');
    const dateInput = document.getElementById('date');
    const timeSlotsContainer = document.getElementById('timeSlotsContainer');
    const selectedTimeInput = document.getElementById('selectedTime');
    
    // --- PASO 1: LÓGICA DE BÚSQUEDA DE PACIENTE ---
    
    let searchTimeout;
    patientSearch.addEventListener('keyup', () => {
        clearTimeout(searchTimeout);
        const searchTerm = patientSearch.value;
        
        if (searchTerm.length < 3) {
            patientResults.innerHTML = '';
            return;
        }
        
        // Espera 500ms antes de buscar
        searchTimeout = setTimeout(async () => {
            try {
                // Llama a nuestra nueva API de admin
                const response = await fetch(`/admin/api/buscar-pacientes?search=${searchTerm}`);
                const pacientes = await response.json();
                
                patientResults.innerHTML = ''; // Limpiar resultados
                if (pacientes.length === 0) {
                    patientResults.innerHTML = '<p class="list-group-item">No se encontraron pacientes.</p>';
                    return;
                }
                
                // Mostrar resultados
                pacientes.forEach(paciente => {
                    const item = document.createElement('a');
                    item.href = '#';
                    item.className = 'list-group-item list-group-item-action';
                    item.textContent = `${paciente.nombre} (${paciente.email})`;
                    
                    item.addEventListener('click', (e) => {
                        e.preventDefault();
                        
                        // Guardar selección
                        selectedPatientId.value = paciente._id;
                        selectedPatientName.value = paciente.nombre;
                        
                        // Marcar como seleccionado
                        patientSearch.value = paciente.nombre;
                        btnNextStep1.disabled = false; // Activar botón 'Siguiente'
                        patientResults.innerHTML = ''; // Ocultar lista
                    });
                    patientResults.appendChild(item);
                });

            } catch (error) {
                console.error(error);
                patientResults.innerHTML = '<p class="list-group-item text-danger">Error al buscar.</p>';
            }
        }, 500);
    });


    // --- PASO 2: LÓGICA DE AGENDAMIENTO (Copiada de agendar.js) ---

    // (Aplica restricción de "no días pasados")
    const hoy = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', hoy);

    // 1. Carga médicos
    const loadDoctors = async (specialty) => {
        doctorSelect.innerHTML = '<option value="">Cargando médicos...</option>';
        if (!specialty) {
            doctorSelect.innerHTML = '<option value="">Selecciona una especialidad...</option>';
            return;
        }
        try {
            // Llama a la API pública (el admin también puede usarla)
            const response = await fetch(`/api/medicos/${specialty}`); 
            const medicos = await response.json();
            doctorSelect.innerHTML = '<option value="">Selecciona un médico...</option>';
            medicos.forEach(medico => {
                const option = document.createElement('option');
                option.value = medico._id;
                option.textContent = medico.nombre;
                doctorSelect.appendChild(option);
            });
        } catch (error) {
            doctorSelect.innerHTML = '<option value="">Error al cargar médicos</option>';
        }
    };

    // 2. Carga horarios (REUTILIZANDO TODAS LAS RESTRICCIONES)
    const updateHorarios = async () => {
        const medicoId = doctorSelect.value;
        const fecha = dateInput.value;
        
        timeSlotsContainer.innerHTML = '<p>Cargando horarios...</p>';
        selectedTimeInput.value = ''; 
        
        if (!medicoId || !fecha) {
            timeSlotsContainer.innerHTML = '<p>Selecciona médico y fecha.</p>';
            return;
        }

        // Restricción: No fines de semana
        const fechaSeleccionada = new Date(fecha + 'T00:00:00');
        const diaDeSemana = fechaSeleccionada.getUTCDay();
        if (diaDeSemana === 6 || diaDeSemana === 0) {
            alert('No se pueden agendar citas en sábado o domingo.');
            dateInput.value = '';
            timeSlotsContainer.innerHTML = '<p>Por favor, selecciona un día de lunes a viernes.</p>';
            return;
        }

        try {
            // Llama a la API pública
            const response = await fetch(`/api/horarios/${medicoId}/${fecha}`); 
            const data = await response.json(); 

            // Restricción: No horas pasadas
            const ahora = new Date();
            const esHoy = (new Date(fecha + 'T00:00:00').toDateString() === ahora.toDateString());
            let slotsParaMostrar = data.disponibles;

            if (esHoy) {
                const horaActual = ahora.getHours().toString().padStart(2, '0');
                const minActual = ahora.getMinutes().toString().padStart(2, '0');
                const tiempoActual = `${horaActual}:${minActual}`;
                slotsParaMostrar = data.disponibles.filter(slot => slot > tiempoActual);
            }

            // Mostrar botones
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
                        selectedTimeInput.value = hora; // Guardar hora
                    });
                    timeSlotsContainer.appendChild(button);
                });
            } else {
                timeSlotsContainer.innerHTML = '<p>No hay horarios disponibles para este día.</p>';
            }
        } catch (error) {
            timeSlotsContainer.innerHTML = '<p>Error al cargar horarios.</p>';
        }
    };
    
    // Event Listeners para el Paso 2
    specialtySelect.addEventListener('change', () => loadDoctors(specialtySelect.value));
    doctorSelect.addEventListener('change', updateHorarios);
    dateInput.addEventListener('change', updateHorarios);
});