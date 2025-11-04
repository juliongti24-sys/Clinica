// ===============================================
// LÓGICA DE PASOS (3 Pasos)
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
        fillSummary(); // Llenar resumen antes de ir al paso final
    }
    showStep(step);
}

function prevStep(step) {
    showStep(step);
}

// Llenar el resumen (Paso 3)
function fillSummary() {
    const patientText = document.getElementById('selectedPatientName').value;
    const specialtyText = document.getElementById('specialty').selectedOptions[0].text;
    const doctorText = document.getElementById('doctor').selectedOptions[0].text;
    const dateValue = document.getElementById('date').value;
    const timeText = document.getElementById('selectedTime').value;

    const dateText = new Date(dateValue).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

    document.getElementById('summary-patient').textContent = patientText;
    document.getElementById('summary-specialty').textContent = specialtyText;
    document.getElementById('summary-doctor').textContent = doctorText;
    document.getElementById('summary-datetime').textContent = `${dateText} a las ${timeText}`;
}

// Esto se carga cuando el DOM está listo (es decir, cuando la página ha cargado)
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
    
    // Restricciones de Fecha (no días pasados)
    const hoy = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', hoy);

    // --- Datos Originales (leídos de EJS) ---
    const medicoIdOriginal = doctorSelect.dataset.medicoId;
    const horaOriginal = selectedTimeInput.value;
    const fechaOriginal = dateInput.value;

    // --- PASO 1: LÓGICA DE BÚSQUEDA DE PACIENTE ---
    // Como ya hay un paciente cargado, el botón 'Siguiente' debe estar activo
    btnNextStep1.disabled = false;
    
    let searchTimeout;
    patientSearch.addEventListener('keyup', () => {
        clearTimeout(searchTimeout);
        const searchTerm = patientSearch.value;
        
        // Desactiva 'Siguiente' si el admin está buscando,
        // para forzarlo a seleccionar un paciente nuevo de la lista.
        btnNextStep1.disabled = true; 
        
        if (searchTerm.length < 3) {
            patientResults.innerHTML = '';
            return;
        }
        
        searchTimeout = setTimeout(async () => {
            try {
                const response = await fetch(`/manage/api/buscar-pacientes?search=${searchTerm}`);
                const pacientes = await response.json();
                
                patientResults.innerHTML = ''; 
                if (pacientes.length === 0) {
                    patientResults.innerHTML = '<p class="list-group-item">No se encontraron pacientes.</p>';
                    return;
                }
                
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
                        patientSearch.value = paciente.nombre;
                        btnNextStep1.disabled = false; // Activar botón 'Siguiente'
                        patientResults.innerHTML = ''; 
                    });
                    patientResults.appendChild(item);
                });

            } catch (error) { 
                console.error(error);
                patientResults.innerHTML = '<p class="list-group-item text-danger">Error al buscar.</p>';
            }
        }, 500);
    });


    // ===============================================
    // --- PASO 2: LÓGICA DE AGENDAMIENTO ---
    // (Copiada de modificar-cita.js, que ya tiene todas las restricciones)
    // ===============================================

    // 1. Carga médicos
    const loadDoctors = async (specialty, idParaSeleccionar = null) => {
        doctorSelect.innerHTML = '<option value="">Cargando...</option>';
        if (!specialty) {
            doctorSelect.innerHTML = '<option value="">Selecciona especialidad...</option>';
            return;
        }
        try {
            const response = await fetch(`/api/medicos/${specialty}`); // Usa la API pública
            const medicos = await response.json();
            doctorSelect.innerHTML = '<option value="">Selecciona médico...</option>';
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

    // 2. Carga horarios (con todas las restricciones)
    const updateHorarios = async (horaParaSeleccionar = null) => {
        const medicoId = doctorSelect.value;
        const fecha = dateInput.value;
        
        timeSlotsContainer.innerHTML = '<p>Cargando horarios...</p>';
        selectedTimeInput.value = ''; // Limpiar por defecto
        
        if (!medicoId || !fecha) {
            timeSlotsContainer.innerHTML = '<p>Selecciona médico y fecha.</p>';
            return;
        }

        // Restricción: No fines de semana
        const fechaSeleccionada = new Date(fecha + 'T00:00:00');
        const diaDeSemana = fechaSeleccionada.getUTCDay();
        if (diaDeSemana === 6 || diaDeSemana === 0) {
            alert('No se pueden agendar citas en sábado o domingo.');
            dateInput.value = fechaOriginal; // Revertir al valor original si es inválido
            timeSlotsContainer.innerHTML = '<p>Por favor, selecciona un día de lunes a viernes.</p>';
            return;
        }

        try {
            const response = await fetch(`/api/horarios/${medicoId}/${fecha}`); // Usa la API pública
            const data = await response.json(); 

            // Restricción: No horas pasadas (PERO mostrar la hora original)
            const ahora = new Date();
            const esHoy = (new Date(fecha + 'T00:00:00').toDateString() === ahora.toDateString());
            let slotsParaMostrar = data.disponibles;

            const esFechaOriginal = (fecha === fechaOriginal);
            
            // Si es la fecha/médico original, debemos asegurarnos de que la 'horaOriginal' aparezca
            if (esFechaOriginal && medicoId === medicoIdOriginal && !slotsParaMostrar.includes(horaOriginal)) {
                 slotsParaMostrar.push(horaOriginal);
                 slotsParaMostrar.sort();
            }

            if (esHoy) {
                const tiempoActual = ahora.getHours().toString().padStart(2, '0') + ":" + ahora.getMinutes().toString().padStart(2, '0');
                slotsParaMostrar = slotsParaMostrar.filter(slot => {
                    // Permitir slot si es futuro O si es el slot original en la fecha original
                    return slot > tiempoActual || (slot === horaOriginal && esFechaOriginal && medicoId === medicoIdOriginal);
                });
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
                        selectedTimeInput.value = hora;
                    });
                    
                    // Auto-seleccionar la hora
                    if (hora === horaParaSeleccionar && esFechaOriginal && medicoId === medicoIdOriginal) {
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
    
    // --- Event Listeners (Paso 2) ---
    specialtySelect.addEventListener('change', () => {
        selectedTimeInput.value = '';
        loadDoctors(specialtySelect.value); // Cargar nuevos doctores
        updateHorarios();
    });
    doctorSelect.addEventListener('change', () => {
        selectedTimeInput.value = '';
        updateHorarios();
    });
    dateInput.addEventListener('change', () => {
        selectedTimeInput.value = '';
        updateHorarios();
    });

    // --- PRE-CARGA INICIAL ---
    const preCargarDatos = async () => {
        // 1. Carga los doctores de la especialidad pre-seleccionada
        await loadDoctors(specialtySelect.value, medicoIdOriginal);
        // 2. Carga los horarios y auto-selecciona la hora original
        await updateHorarios(horaOriginal);
        // 3. Llena el resumen inicial
        fillSummary();
    };

    preCargarDatos();
});