const express = require('express');
const router = express.Router();

//Importamos los modelos necesarios
const Cita = require('../models/Cita'); 
const Usuario = require('../models/Usuario'); 

//Importamos la funciión que nos permite subir los archivos
const upload = require('../middleware/subirArchivo');

const fs = require('fs');
const path = require('path');
// --- RUTAS DE PACIENTE ---

// Dashboard del Paciente
router.get('/dashboard/paciente', (req, res) => {
    
    res.render('dashboard-paciente');

});

// Página para Agendar Cita
// --- 1. RUTA PARA CARGAR LA PÁGINA DE AGENDAR ---
router.get('/agendar', async (req, res) => {
    try {
        // Busca en la BD todas las especialidades ÚNICAS de los médicos
        const especialidades = await Usuario.distinct('especialidad', { 
            role: 'medico',
            especialidad: { $ne: null } // Asegura que no traiga médicos sin especialidad
        });

        // Renderiza el EJS, pasándole la lista de especialidades
        res.render('agendar', {
            especialidades: especialidades // Esta variable estará disponible en agendar.ejs
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error al cargar la página de agendamiento.");
    }
});

// --- 2. RUTAS API (PARA EL JAVASCRIPT DEL FRONTEND) ---

// API para obtener médicos por especialidad
router.get('/api/medicos/:especialidad', async (req, res) => {
    try {
        const especialidad = req.params.especialidad;
        const medicos = await Usuario.find({ 
            role: 'medico', 
            especialidad: especialidad 
        }).select('nombre _id'); // Solo devuelve nombre e ID

        res.json(medicos); // Envía los datos como JSON

    } catch (error) {
        res.status(500).json({ error: 'Error al buscar médicos' });
    }
});

// API para obtener horarios disponibles
router.get('/api/horarios/:medicoId/:fecha', async (req, res) => {
    try {
        const { medicoId, fecha } = req.params;
        const diaSemana = new Date(fecha).getUTCDay().toString(); // ej: "1" (Lunes)

        // 1. Encontrar el horario laboral del médico
        const medico = await Usuario.findById(medicoId);
        if (!medico || !medico.horario.has(diaSemana)) {
            return res.json({ disponibles: [] }); // No trabaja ese día
        }
        const horarioLaboral = medico.horario.get(diaSemana); // ej: { inicio: "09:00", fin: "17:00" }

        // 2. Encontrar citas ya tomadas para ESE día y ESE médico
        const citasTomadas = await Cita.find({ 
            medico: medicoId,
            fecha: new Date(fecha) 
        });
        const horasOcupadas = citasTomadas.map(cita => cita.hora); // ej: ["09:30", "11:00"]

        // 3. Generar todos los slots cada 30 min
        const slotsDisponibles = [];
        let [hora, min] = horarioLaboral.inicio.split(':').map(Number);
        const [horaFin, minFin] = horarioLaboral.fin.split(':').map(Number);
        
        while (hora < horaFin || (hora === horaFin && min < minFin)) {
            const slotActual = `${hora.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
            
            // 4. Filtrar slots (que no estén ya ocupados)
            if (!horasOcupadas.includes(slotActual)) {
                slotsDisponibles.push(slotActual);
            }
            
            min += 30; // Siguiente slot en 30 min
            if (min >= 60) {
                hora++;
                min = 0;
            }
        }
        
        res.json({ disponibles: slotsDisponibles });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al buscar horarios' });
    }
});

// --- 3. RUTA PARA GUARDAR LA CITA (DEL FORMULARIO) ---
router.post('/agendar', async (req, res) => {
    try {
        // Obtenemos los datos del formulario
        const { doctor, date, time, reason } = req.body;
        
        // Obtenemos al paciente de la sesión
        const pacienteId = req.session.userId; 

        // Validación final: Asegurarse de que el slot no se ocupó
        const citaExistente = await Cita.findOne({
            medico: doctor,
            fecha: new Date(date),
            hora: time
        });

        if (citaExistente) {
            return res.status(409).send("Error: Esa hora acaba de ser reservada. Por favor, elige otro horario.");
        }

        //Validación para que un paciente no pueda agendar dos citas al mismo tiempo
        const citaPaciente = await Cita.findOne({
            paciente: pacienteId,
            fecha: new Date(date),
            hora: time
        });
        if (citaPaciente) {
            return res.status(409).send("Error: Usted ya tiene una cita agendada para esa fecha y hora.");
        }
        
        // Crear y guardar la nueva cita
        const nuevaCita = new Cita({
            paciente: pacienteId,
            medico: doctor,
            fecha: new Date(date),
            hora: time,
            motivo: reason
        });

        await nuevaCita.save();
        
        // Redireccionar al dashboard del paciente 
        res.render('dashboard-paciente');

    } catch (error) {
        console.error(error);
        res.status(500).send("Error al confirmar la cita.");
    }
});

// Dashboard del Paciente (¡ACTUALIZADO!)
router.get('/citas/paciente', async (req, res) => {
    try {
        const pacienteId = req.session.userId;
        const ahora = new Date();

        // 1. Buscamos todas las citas del paciente
        const todasLasCitas = await Cita.find({ paciente: pacienteId })
            .populate('medico', 'nombre especialidad') // <-- ¡IMPORTANTE! Trae los datos del médico
            .sort({ fecha: 1 }); // Ordena por fecha (ascendente)

        // 2. Filtramos en "próximas" y "anteriores"
        const proximasCitas = todasLasCitas.filter(cita => {
            // Compara la fecha de la cita (ej: 2025-11-04) con la fecha de hoy
            // (Se ajusta la hora a medianoche para una comparación justa)
            const fechaCita = new Date(cita.fecha);
            fechaCita.setUTCHours(0,0,0,0);
            const hoy = new Date();
            hoy.setHours(0,0,0,0);
            
            return fechaCita >= hoy;
        });

        const citasAnteriores = todasLasCitas.filter(cita => {
            const fechaCita = new Date(cita.fecha);
            fechaCita.setUTCHours(0,0,0,0);
            const hoy = new Date();
            hoy.setHours(0,0,0,0);
            
            return fechaCita < hoy;
        });

        // 3. Renderizamos el dashboard, pasándole los dos arrays
        res.render('citas-paciente', {
            proximasCitas: proximasCitas,
            citasAnteriores: citasAnteriores
            // 'usuario' ya está disponible globalmente
        });

    } catch (error) {
        console.error("Error al cargar el dashboard:", error);
        res.status(500).send("Error al cargar sus citas.");
    }
});

// RUTA para Cancelar Citas
router.post('/citas/cancelar/:id', async (req, res) => {
    try {
        const citaId = req.params.id;
        const pacienteId = req.session.userId;

        // Verificamos que la cita pertenezca al usuario logueado
        const cita = await Cita.findOne({ _id: citaId, paciente: pacienteId });

        if (!cita) {
            return res.status(404).send("Cita no encontrada o no tiene permiso para cancelarla.");
        }

        // Si la encontramos, la borramos
        await Cita.findByIdAndDelete(citaId);
        
        // Redirigimos de vuelta al dashboard
        res.redirect('/citas/paciente');

    } catch (error) {
        console.error("Error al cancelar la cita:", error);
        res.status(500).send("Error al cancelar la cita.");
    }
});

//Modificar Citas
// --- 1. RUTA GET PARA MOSTRAR EL FORMULARIO DE MODIFICAR ---
router.get('/citas/modificar/:id', async (req, res) => {
    try {
        const citaId = req.params.id;
        const pacienteId = req.session.userId;

        // 1. Busca la cita y verifica que pertenezca al paciente
        const cita = await Cita.findOne({ _id: citaId, paciente: pacienteId })
                             .populate('medico'); // Trae los datos del médico
        
        if (!cita) {
            return res.status(404).send("Cita no encontrada.");
        }

        // 2. Busca todas las especialidades (igual que en /agendar)
        const especialidades = await Usuario.distinct('especialidad', { 
            role: 'medico',
            especialidad: { $ne: null } 
        });

        // 3. Formatea la fecha para el input (YYYY-MM-DD)
        const fechaParaInput = new Date(cita.fecha).toISOString().split('T')[0];

        // 4. Renderiza la nueva vista, pasándole los datos
        res.render('modificar-cita', {
            cita: cita,
            especialidades: especialidades,
            fechaParaInput: fechaParaInput
        });

    } catch (error) {
        console.error("Error al cargar la cita para modificar:", error);
        res.status(500).send("Error al cargar la página.");
    }
});
// --- 2. RUTA POST PARA GUARDAR LOS CAMBIOS ---
router.post('/citas/modificar/:id', async (req, res) => {
    try {
        const citaId = req.params.id;
        const pacienteId = req.session.userId;
        const { doctor, date, time, reason } = req.body; // Datos nuevos del form

        // 1. Validar que la cita exista y pertenezca al usuario
        const citaOriginal = await Cita.findOne({ _id: citaId, paciente: pacienteId });
        if (!citaOriginal) {
            return res.status(404).send("Cita no encontrada.");
        }

        // 2. Validar que el nuevo slot esté disponible
        // (Evita que el usuario mueva su cita a un horario ya ocupado)
        const citaExistente = await Cita.findOne({
            medico: doctor,
            fecha: new Date(date),
            hora: time,
            _id: { $ne: citaId } // Busca otra cita (!= a la actual) en el mismo slot
        });

        if (citaExistente) {
            return res.status(409).send("Error: Ese horario ya está reservado. Por favor, elige otro.");
        }

        // 3. Actualizar la cita en la BD
        await Cita.findByIdAndUpdate(citaId, {
            medico: doctor,
            fecha: new Date(date),
            hora: time,
            motivo: reason
        });

        // 4. Redirigir al dashboard
        res.redirect('/citas/paciente');

    } catch (error) {
        console.error("Error al modificar la cita:", error);
        res.status(500).send("Error al guardar los cambios.");
    }
});


// ... (Tus otras rutas existentes) ...

// --- PERFIL DE USUARIO (Cualquier rol) ---

// VER PERFIL (GET)
router.get('/perfil', async (req, res) => {
    // El usuario ya está en res.locals gracias al middleware 'checkUser'
    // pero para editar, es mejor traer una copia fresca de la base de datos
    try {
        const usuario = await Usuario.findById(req.session.userId);
        res.render('perfil', { usuario });
    } catch (error) {
        res.status(500).send("Error al cargar el perfil");
    }
});

//ACTUALIZAR PERFIL (POST)
router.post('/perfil', upload.single('foto'), async (req, res) => {
    try {
        const userId = req.session.userId;
        const { nombre, email, telefono, direccion, password } = req.body;

        // Buscamos al usuario
        const usuario = await Usuario.findById(userId);

        // Actualizamos los campos básicos
        usuario.nombre = nombre;
        usuario.email = email;
        usuario.telefono = telefono;
        usuario.direccion = direccion;

        // Actualizamos la foto SOLO si se subió una nueva
        if (req.file) {
            // 1. Verificamos si tiene una foto anterior y que NO sea la default
            if (usuario.fotoPerfil && usuario.fotoPerfil !== 'default.jpg') {
                
                // 2. Construimos la ruta física al archivo antiguo
                const rutaImagenAnterior = path.join(__dirname, '../public/images', usuario.fotoPerfil);
                
                // 3. Verificamos si el archivo existe y lo borramos
                if (fs.existsSync(rutaImagenAnterior)) {
                    fs.unlinkSync(rutaImagenAnterior); // Borrado físico
                }
            }

            // 4. Asignamos la nueva foto
            usuario.fotoPerfil = req.file.filename;
        }

        // Actualizamos la contraseña SOLO si el campo no está vacío
        if (password && password.trim() !== "") {
            usuario.password = password; 
            // Al hacer .save(), el 'pre-save hook' de tu modelo hasheará la password automáticamente
        }

        // Guardamos los cambios
        await usuario.save();

        // Actualizamos la sesión o redirigimos
        // (Dependiendo de cómo manejes el rol, redirige al dashboard correspondiente)
        if (usuario.role === 'paciente') {
            res.redirect('/dashboard/paciente');
        } else if (usuario.role === 'medico') {
            res.redirect('/medico/dashboard');
        } else if (usuario.role === 'recepcionista') {
            res.redirect('/recepcionista/dashboard');
        } else {
            res.redirect('/admin/dashboard');
        }

    } catch (error) {
        console.error(error);
        res.status(500).send("Error al actualizar el perfil.");
    }
});

// --- RUTAS DE MÉDICO ---

/// Dashboard del Médico 
router.get('/medico/dashboard', async (req, res) => {
    try {
        // Obtenemos el ID del médico de la sesión
        const medicoId = req.session.userId;

        // --- 1. Buscar citas para HOY ---
        const hoyInicio = new Date();
        hoyInicio.setHours(0, 0, 0, 0); // Desde las 00:00 de hoy
        const hoyFin = new Date();
        hoyFin.setHours(23, 59, 59, 999); // Hasta las 23:59 de hoy

        const citasHoy = await Cita.find({
            medico: medicoId,
            fecha: { $gte: hoyInicio, $lte: hoyFin }
        })
        .populate('paciente', 'nombre telefono') // Traemos nombre y tel. del paciente
        .sort({ hora: 1 }); // Ordenar por la hora

        // --- 2. Buscar citas FUTURAS ---
        const mananaInicio = new Date(hoyFin.getTime() + 1); // Desde mañana

        const citasFuturas = await Cita.find({
            medico: medicoId,
            fecha: { $gte: mananaInicio }
        })
        .populate('paciente', 'nombre') // Solo el nombre
        .sort({ fecha: 1, hora: 1 }); // Ordenar por fecha, luego por hora

        // --- 3. Renderizar la vista ---
        res.render('medico/dashboard', {
            citasHoy: citasHoy,
            citasFuturas: citasFuturas
            // 'usuario' (el médico) ya está disponible globalmente
        });

    } catch (error) {
        console.error("Error al cargar dashboard del médico:", error);
        res.status(500).send("Error al cargar su agenda.");
    }
});


// RUTA: Historial de Citas Completadas con Buscador
router.get('/medico/citas-completadas', async (req, res) => {
    try {
        const medicoId = req.session.userId;
        const busqueda = req.query.search || ''; // Lo que escribe el doctor

        // 1. Definimos la condición base: Citas de ESTE médico y que ya PASARON
        let filtroCitas = {
            medico: medicoId,
            fecha: { $lt: new Date() } // $lt = Less Than (Menor que hoy)
        };

        // 2. Si hay búsqueda, filtramos por paciente
        if (busqueda) {
            // Buscamos usuarios (pacientes) que coincidan con el nombre
            const pacientesEncontrados = await Usuario.find({
                role: 'paciente',
                nombre: { $regex: busqueda, $options: 'i' } // 'i' ignora mayúsculas/minúsculas
            }).select('_id');

            // Extraemos solo los IDs
            const idsPacientes = pacientesEncontrados.map(p => p._id);

            // Agregamos al filtro: la cita debe ser de uno de estos pacientes
            filtroCitas.paciente = { $in: idsPacientes };
        }

        // 3. Buscamos las citas con el filtro final
        const citas = await Cita.find(filtroCitas)
            .populate('paciente', 'nombre email telefono fotoPerfil')
            .sort({ fecha: -1, hora: -1 }); // Ordenar: las más recientes primero

        // 4. Renderizamos la vista
        res.render('medico/citas-completadas', {
            citas: citas,
            busqueda: busqueda // Para mantener el texto en el input
        });

    } catch (error) {
        console.error(error);
        res.status(500).send("Error al cargar el historial.");
    }
});

// --- RUTAS DE RECEPCIONISTA ---

// Dashboard del Recepcionista
router.get('/recepcionista/dashboard', (req, res) => {
    res.render('recepcionista/dashboard');
});


module.exports = router;