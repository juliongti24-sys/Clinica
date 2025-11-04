// --- Variables de los Pasos ---
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

// --- Lógica Dinámica ---
document.addEventListener('DOMContentLoaded', () => {
    
    // Selectores
    const specialtySelect = document.getElementById('specialty');
    const doctorSelect = document.getElementById('doctor');
    const dateInput = document.getElementById('date');
    const timeSlotsContainer = document.getElementById('timeSlotsContainer');
    const selectedTimeInput = document.getElementById('selectedTime');
    
    // 1. Obtiene la fecha de HOY en el formato YYYY-MM-DD 
    const hoy = new Date().toISOString().split('T')[0];
    // 2. Establece el atributo 'min' en el input de fecha para que no se puedan elegir fechas pasadas
    dateInput.setAttribute('min', hoy);

    // 1. Cuando el usuario cambia la ESPECIALIDAD
    specialtySelect.addEventListener('change', async () => {
        const specialty = specialtySelect.value;
        
        // Limpiar opciones anteriores
        doctorSelect.innerHTML = '<option value="">Cargando médicos...</option>';
        timeSlotsContainer.innerHTML = '<p>Horas disponibles:</p>';
        
        if (!specialty) {
            doctorSelect.innerHTML = '<option value="">Selecciona una especialidad...</option>';
            return;
        }

        try {
            // Pedir médicos a nuestra API
            const response = await fetch(`/api/medicos/${specialty}`);
            if (!response.ok) throw new Error('Error al cargar médicos');
            const medicos = await response.json();

            // Llenar el <select> de doctores
            doctorSelect.innerHTML = '<option value="">Selecciona un médico...</option>';
            medicos.forEach(medico => {
                const option = document.createElement('option');
                option.value = medico._id; // Guardamos el ID
                option.textContent = medico.nombre; // Mostramos el nombre
                doctorSelect.appendChild(option);
            });
        } catch (error) {
            console.error(error);
            doctorSelect.innerHTML = '<option value="">Error al cargar médicos</option>';
        }
    });

    // 2. Cuando el usuario cambia el MÉDICO o la FECHA
    const updateHorarios = async () => {
        const medicoId = doctorSelect.value;
        const fecha = dateInput.value;
        
        timeSlotsContainer.innerHTML = '<p>Cargando horarios...</p>';
        selectedTimeInput.value = ''; 
        
        if (!medicoId || !fecha) {
            timeSlotsContainer.innerHTML = '<p>Selecciona un médico y una fecha.</p>';
            return;
        }

        //PREVENIR SÁBADOS Y DOMINGOS
        // 1. Creamos un objeto Date. La 'fecha' del input (YYYY-MM-DD)
        //    se trata como UTC para evitar problemas de zona horaria.
        const fechaSeleccionada = new Date(fecha + 'T00:00:00');
        
        // 2. getUTCDay() devuelve 0 para Domingo y 6 para Sábado.
        const diaDeSemana = fechaSeleccionada.getUTCDay(); 

        if (diaDeSemana === 6 || diaDeSemana === 0) {
            // 3. Si es Sábado o Domingo:
            alert('No se pueden agendar citas en sábado o domingo. Por favor, elige un día de lunes a viernes.');
            dateInput.value = ''; // Limpiamos la fecha inválida del input
            timeSlotsContainer.innerHTML = '<p>Por favor, selecciona un día de lunes a viernes.</p>';
            return; // Detenemos la función aquí
        }
        try {
            // Pedir horarios a nuestra API 
            const response = await fetch(`/api/horarios/${medicoId}/${fecha}`);
            if (!response.ok) throw new Error('Error al cargar horarios');
            const data = await response.json(); // ej: { disponibles: ["09:00", "09:30", "10:00", ...] }

            
            // 1. Obtener la fecha y hora actual del navegador
            const ahora = new Date();
            
            // 2. Comprobar si la fecha seleccionada en el input es HOY
            // (Comparamos las "cadenas" de fecha, es la forma más simple)
            const esHoy = (new Date(fecha + 'T00:00:00').toDateString() === ahora.toDateString());

            let slotsParaMostrar = data.disponibles;

            // 3. Si ES HOY, filtramos las horas que ya pasaron
            if (esHoy) {
                // Obtener hora actual en formato "HH:MM"
                const horaActual = ahora.getHours().toString().padStart(2, '0');
                const minActual = ahora.getMinutes().toString().padStart(2, '0');
                const tiempoActual = `${horaActual}:${minActual}`; // ej: "15:15"
                
                // Filtramos el array: solo nos quedamos con slots > tiempoActual
                slotsParaMostrar = data.disponibles.filter(slot => {
                    return slot > tiempoActual; // ej: "15:30" > "15:15" (true)
                });
            }
            
            // Mostrar los botones de hora (ahora usamos 'slotsParaMostrar')
            timeSlotsContainer.innerHTML = '<p>Horas disponibles:</p>';
            
            if (slotsParaMostrar && slotsParaMostrar.length > 0) {
                
                slotsParaMostrar.forEach(hora => { 
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'time-slot-btn';
                    button.textContent = hora;
                    button.dataset.hora = hora;
                    
                    button.addEventListener('click', () => {
                        const botonesActivos = document.querySelectorAll('.time-slot-btn.active');
                        botonesActivos.forEach(btn => btn.classList.remove('active'));
                        button.classList.add('active');
                        selectedTimeInput.value = hora;

                        alert(`Has seleccionado la hora: ${hora}`);
                    });
                    
                    timeSlotsContainer.appendChild(button);
                });
            } else {
                // Mensaje si no hay horarios disponibles
                if (esHoy) {
                    timeSlotsContainer.innerHTML = '<p>No hay más horarios disponibles para hoy.</p>';
                } else {
                    timeSlotsContainer.innerHTML = '<p>No hay horarios disponibles para este día.</a >';
                }
            }
        } catch (error) {
            console.error(error);
            timeSlotsContainer.innerHTML = '<p>Error al cargar horarios.</p>';
        }
    };
    
    // Añadir listeners 
    doctorSelect.addEventListener('change', updateHorarios);
    dateInput.addEventListener('change', updateHorarios);
});


// 3. Llenar el resumen (Paso 3)
function fillSummary() {
    // Obtener los TEXTOS seleccionados
    const specialtyText = document.getElementById('specialty').selectedOptions[0].text;
    const doctorText = document.getElementById('doctor').selectedOptions[0].text;
    const dateText = new Date(document.getElementById('date').value).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
    const timeText = document.getElementById('selectedTime').value;

    // Ponerlos en el resumen
    document.getElementById('summary-specialty').textContent = specialtyText;
    document.getElementById('summary-doctor').textContent = doctorText;
    document.getElementById('summary-datetime').textContent = `${dateText} a las ${timeText}`;
}