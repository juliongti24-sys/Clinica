const express = require('express');
const router = express.Router();
const Usuario = require('../models/Usuario');
const { requireAdmin } = require('../middleware/authMiddleware'); // <-- Usamos requireAdmin
const upload = require('../middleware/subirArchivo');
const fs = require('fs');
const path = require('path');
    

// Solo Admins pueden gestionar usuarios
router.use(requireAdmin);

// Ruta al dashboard de admin
router.get('/dashboard', (req, res) => {
    res.render('admin/dashboard'); 
});

// Mostrar formulario para crear usuarios
router.get('/crear-usuario', (req, res) => {
    res.render('admin/crear-usuario'); 
});

// Lógica para crear el usuario (POST)
router.post('/crear-usuario', upload.single('foto'),  async (req, res) => {
    // ... (Esta ruta se queda igual)
    try {
        const { nombre, email, password, direccion, telefono, role, especialidad, cedula } = req.body;
        // ... (resto de la lógica) ...
        const nuevoUsuario = new Usuario({ 
            nombre: nombre,
            email: email,
            password: password,
            direccion: direccion,
            telefono: telefono,
            role: role,
            especialidad: (role === 'medico') ? especialidad : undefined,
            cedula: (role === 'medico') ? cedula : undefined,
            fotoPerfil: req.file.filename
}       );
        await nuevoUsuario.save();
        res.redirect('/admin/dashboard');
    } catch (error) {
        res.status(400).send('Error al crear usuario: ' + error.message);
    }
});

// RUTA PARA VER TODOS LOS USUARIOS (READ)
router.get('/gestionar-usuarios', async (req, res) => {
    // ... (Esta ruta se queda igual)
    const usuarios = await Usuario.find().sort({ role: 1, nombre: 1 });
    res.render('admin/gestionar-usuarios', { usuarios: usuarios });
});

// RUTA PARA MOSTRAR EL FORMULARIO DE EDICIÓN (UPDATE - PARTE 1)
router.get('/editar-usuario/:id', async (req, res) => {
    // ... (Esta ruta se queda igual)
    const usuario = await Usuario.findById(req.params.id);
    res.render('admin/editar-usuario', { u: usuario });
});

// RUTA PARA PROCESAR LA ACTUALIZACIÓN (UPDATE - PARTE 2)
router.post('/editar-usuario/:id', upload.single('foto'), async (req, res) => {
    const id = req.params.id;
    // Extraemos datos
    const { nombre, email, direccion, telefono, role, especialidad, cedula, password } = req.body;

    try {
        const usuario = await Usuario.findById(id);
        if (!usuario) {
            return res.status(404).send("Usuario no encontrado.");
        }

        // ACTUALIZACIÓN SEGURA:
        // Solo actualizamos si el campo viene en el formulario.
        // Si 'role' llega undefined, mantenemos 'usuario.role' original.
        if (nombre) usuario.nombre = nombre;
        if (email) usuario.email = email;
        if (direccion) usuario.direccion = direccion;
        if (telefono) usuario.telefono = telefono;
        
        // Aquí estaba el error: Si role era undefined, la app fallaba.
        if (role) usuario.role = role; 

        if (role === 'medico') {
            if (especialidad) usuario.especialidad = especialidad;
            if (cedula) usuario.cedula = cedula;
        }

        // Lógica de Foto
        if (req.file) {
            if (usuario.fotoPerfil && usuario.fotoPerfil !== 'default.jpg') {
                const rutaImagenAnterior = path.join(__dirname, '../public/images', usuario.fotoPerfil);
                if (fs.existsSync(rutaImagenAnterior)) {
                    try { fs.unlinkSync(rutaImagenAnterior); } catch(e) { console.log(e); }
                }
            }
            usuario.fotoPerfil = req.file.filename;
        }

        // Lógica de Contraseña
        if (password && password.trim() !== '') {
            usuario.password = password;
        }

        await usuario.save();
        res.redirect('/admin/gestionar-usuarios');

    } catch (error) {
        console.error("Error al actualizar:", error);
        // Tip: Muestra el error en pantalla para que sepas qué pasó
        res.status(500).send("Error al actualizar: " + error.message);
    }
});

// RUTA PARA ELIMINAR UN USUARIO (DELETE)
// RUTA ACTUALIZADA: POST /eliminar-usuario/:id
router.post('/eliminar-usuario/:id', async (req, res) => {
    const id = req.params.id;
    const adminId = req.session.userId; // ID del admin que está haciendo la acción

    try {
        // Evitar que el admin se borre a sí mismo
        if (id === adminId) {
            return res.status(403).send("No puedes eliminar tu propia cuenta de administrador aquí.");
        }

        // 1. Primero buscamos al usuario para obtener el nombre de su foto
        const usuarioAEliminar = await Usuario.findById(id);

        if (usuarioAEliminar) {
            // --- LÓGICA DE BORRADO DE FOTO ---
            if (usuarioAEliminar.fotoPerfil && usuarioAEliminar.fotoPerfil !== 'default.jpg') {
                const rutaImagen = path.join(__dirname, '../public/images', usuarioAEliminar.fotoPerfil);
                
                // Verificar si el archivo existe físicamente y borrarlo
                if (fs.existsSync(rutaImagen)) {
                    fs.unlinkSync(rutaImagen);
                }
            }
            // ---------------------------------

            // 2. Ahora sí, borramos el registro de la Base de Datos
            await Usuario.findByIdAndDelete(id);
        }

        res.redirect('/admin/gestionar-usuarios');

    } catch (error) {
        console.error(error);
        res.status(500).send("Error al eliminar el usuario.");
    }
});

module.exports = router;