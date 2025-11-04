const express = require('express');
const router = express.Router();
const Usuario = require('../models/Usuario');
const { requireAdmin } = require('../middleware/authMiddleware'); // <-- Usamos requireAdmin

// ¡Proteger TODAS las rutas de este archivo!
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
router.post('/crear-usuario', async (req, res) => {
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
            cedula: (role === 'medico') ? cedula : undefined });
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
router.post('/editar-usuario/:id', async (req, res) => {
    const id = req.params.id;
    // 1. Extraemos TODOS los datos del formulario 
    const { nombre, email, direccion, telefono, role, especialidad, cedula, password } = req.body;

    try {
        // 2. Preparamos el objeto de actualización
        const updateData = {
            nombre,
            email,
            direccion,
            telefono,
            role,
            especialidad: (role === 'medico') ? especialidad : undefined,
            cedula: (role === 'medico') ? cedula : undefined
        };

        // 3. Lógica para manejar la contraseña 
        
        // Si el campo password NO está vacío, hay que hashearla
        if (password && password.trim() !== '') {
            // Para que el 'pre-save' hook (que cifra) funcione,
            // usamos .findById() y luego .save()
            
            const usuario = await Usuario.findById(id);
            if (!usuario) {
                return res.status(404).send("Usuario no encontrado.");
            }
            
            // Actualiza,os los campos en el objeto de Mongoose
            usuario.set(updateData);
            usuario.password = password; // Asigna la nueva contraseña (sin hashear)
            
            // Al guardar, el hook 'pre-save' se disparará y la cifrará
            await usuario.save(); 

        } else {
            // Si el campo password está VACÍO, no tocamos la contraseña.
            // Usamos 'findByIdAndUpdate' que es más directo.
            // Le pasamos { runValidators: true } para que falle si
            // los campos (como email) no son válidos.
            await Usuario.findByIdAndUpdate(id, updateData, { runValidators: true });
        }

        // 4. Si todo salió bien, redirigimos
        res.redirect('/admin/gestionar-usuarios');

    } catch (error) {
        // Si hay un error (ej: email duplicado), se mostrará
        console.error("Error al actualizar usuario:", error);
        res.status(500).send("Error al actualizar: " + error.message);
    }
});

// RUTA PARA ELIMINAR UN USUARIO (DELETE)
router.post('/eliminar-usuario/:id', async (req, res) => {
    if (req.params.id === req.session.userId) return res.status(403).send("No puedes eliminarte.");
    await Usuario.findByIdAndDelete(req.params.id);
    res.redirect('/admin/gestionar-usuarios');
});

module.exports = router;