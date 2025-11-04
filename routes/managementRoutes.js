const express = require('express');
const router = express.Router();
const Usuario = require('../models/Usuario');
const Cita = require('../models/Cita');
const { requireManagement } = require('../middleware/authMiddleware');

// Solo Admins y Recepcionistas pueden entrar
router.use(requireManagement);

// --- RUTA 1: MOSTRAR EL PANEL DE AGENDAR (ADMIN/RECEP) ---
router.get('/agendar', async (req, res) => {
    try {
        const especialidades = await Usuario.distinct('especialidad', { 
            role: 'medico',
            especialidad: { $ne: null } 
        });
        
        // Reutilizamos la vista del admin
        res.render('admin/agendar-cita-admin', {
            especialidades: especialidades
        });
    } catch (error) {
        res.status(500).send("Error al cargar el panel de agendamiento.");
    }
});

// --- RUTA 2: API PARA BUSCAR PACIENTES ---
router.get('/api/buscar-pacientes', async (req, res) => {
try {
        const searchTerm = req.query.search || '';
        
        // No buscar si el término es muy corto
        if (searchTerm.length < 3) {
            return res.json([]);
        }

        const pacientes = await Usuario.find({
            role: 'paciente',
            // Buscar por nombre O email (insensible a mayúsculas)
            $or: [
                { nombre: { $regex: searchTerm, $options: 'i' } },
                { email: { $regex: searchTerm, $options: 'i' } }
            ]
        }).select('nombre email _id').limit(10); // Limitar a 10 resultados
        
        res.json(pacientes);

    } catch (error) {
        res.status(500).json({ error: 'Error al buscar pacientes' });
    }
});

// --- RUTA 3: POST PARA CREAR LA CITA ---
router.post('/agendar', async (req, res) => {
    // ... (Copia la ruta 'POST /agendar' completa de adminRoutes.js aquí)
    try {
        const { pacienteId, doctor, date, time, reason } = req.body;
        if (!pacienteId) return res.status(400).send("No se seleccionó ningún paciente.");
        const citaExistente = await Cita.findOne({ medico: doctor, fecha: new Date(date), hora: time });
        if (citaExistente) return res.status(409).send("Error: Ese horario ya está reservado.");
        
        const nuevaCita = new Cita({ paciente: pacienteId, medico: doctor, fecha: new Date(date), hora: time, motivo: reason });
        await nuevaCita.save();
        
        // Redirigir al dashboard del rol correspondiente
        if (req.session.role === 'administrador') {
            res.redirect('/admin/dashboard'); 
        } else {
            res.redirect('/recepcionista/dashboard');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("Error al crear la cita.");
    }
});

// --- RUTA 4: MOSTRAR TODAS LAS CITAS (GESTIÓN) ---
router.get('/gestionar-citas', async (req, res) => {
    // ... (Copia la ruta 'GET /gestionar-citas' completa de adminRoutes.js aquí)
    try {
        const proximasCitas = await Cita.find({ fecha: { $gte: new Date().setHours(0,0,0,0) } })
            .populate('paciente', 'nombre')
            .populate('medico', 'nombre especialidad')
            .sort({ fecha: 1 });
        
        res.render('admin/gestionar-citas', { citas: proximasCitas });
    } catch (error) {
        res.status(500).send("Error al cargar las citas.");
    }
});

// --- RUTA 5: MOSTRAR FORMULARIO DE EDICIÓN ---
router.get('/editar-cita/:id', async (req, res) => {
    // ... (Copia la ruta 'GET /editar-cita/:id' completa de adminRoutes.js aquí)
    try {
        const cita = await Cita.findById(req.params.id).populate('paciente').populate('medico');
        if (!cita) return res.status(404).send("Cita no encontrada.");
        const especialidades = await Usuario.distinct('especialidad', { role: 'medico', especialidad: { $ne: null } });
        const fechaParaInput = new Date(cita.fecha).toISOString().split('T')[0];
        res.render('manage/editar-cita', { cita: cita, especialidades: especialidades, fechaParaInput: fechaParaInput });
    } catch (error) {
        res.status(500).send("Error al cargar la cita para editar.");
    }
});

// --- RUTA 6: PROCESAR ACTUALIZACIÓN DE CITA ---
router.post('/editar-cita/:id', async (req, res) => {
    // ... (Copia la ruta 'POST /editar-cita/:id' completa de adminRoutes.js aquí)
    try {
        const citaId = req.params.id;
        const { pacienteId, doctor, date, time, reason } = req.body; 
        const citaExistente = await Cita.findOne({ medico: doctor, fecha: new Date(date), hora: time, _id: { $ne: citaId } });
        if (citaExistente) return res.status(409).send("Error: Ese horario ya está reservado.");
        await Cita.findByIdAndUpdate(citaId, { paciente: pacienteId, medico: doctor, fecha: new Date(date), hora: time, motivo: reason });
        res.redirect('/manage/gestionar-citas'); // Redirige a la lista de gestión
    } catch (error) {
        res.status(500).send("Error al actualizar la cita.");
    }
});

// --- RUTA 7: CANCELAR CITA ---
router.post('/cancelar-cita/:id', async (req, res) => {
    // ... (Copia la ruta 'POST /cancelar-cita/:id' completa de adminRoutes.js aquí)
    try {
        await Cita.findByIdAndDelete(req.params.id);
        res.redirect('/manage/gestionar-citas');
    } catch (error) {
        res.status(500).send("Error al cancelar la cita.");
    }
});

module.exports = router;