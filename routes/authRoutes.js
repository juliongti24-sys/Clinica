const express = require('express');
const router = express.Router();
const Usuario = require('../models/Usuario');
const { redirectIfLoggedIn } = require('../middleware/authMiddleware');


// Aplicar el middleware 'redirectIfLoggedIn'
router.get('/login', redirectIfLoggedIn, (req, res) => {
    res.render('login');
});

// Aplicar el middleware 'redirectIfLoggedIn'
router.get('/register', redirectIfLoggedIn, (req, res) => {
    res.render('register');
});

// Cerrar sesión
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        res.redirect('/');
    });
});


// --- LÓGICA (POST) ---

// 1. REGISTRO DE PACIENTE
router.post('/register', async (req, res) => {
    const { nombre, email, password, direccion, telefono, fechaNacimiento, numeroSeguro } = req.body;

    try {
        const usuario = new Usuario({
            email,
            password,
            nombre,
            direccion,
            telefono,
            fechaNacimiento,
            numeroSeguro,
            role: 'paciente' // <-- Rol asignado automáticamente
        });
        
        await usuario.save();
        
        // Iniciar sesión automáticamente
        req.session.userId = usuario._id;
        res.redirect('/dashboard/paciente'); // Redirigir al dashboard de paciente

    } catch (error) {
        console.error(error);
        res.status(400).send('Error al registrar usuario. El email ya puede estar en uso.');
    }
});

// 2. INICIO DE SESIÓN (Login)
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // 1. Buscar al usuario por email
        const usuario = await Usuario.findOne({ email });
        if (!usuario) {
            return res.status(400).send('Email o contraseña incorrectos.');
        }

        // 2. Comparar contraseña (usando el método del modelo)
        const esCorrecta = await usuario.compararPassword(password);
        if (!esCorrecta) {
            return res.status(400).send('Email o contraseña incorrectos.');
        }

        // 3. Crear la sesión
        req.session.userId = usuario._id;

        // 4. REDIRIGIR POR ROL (La lógica clave)
        switch (usuario.role) {
            case 'administrador':
                res.redirect('/admin/dashboard');
                break;
            case 'medico':
                res.redirect('/medico/dashboard');
                break;
            case 'recepcionista':
                res.redirect('/recepcionista/dashboard');
                break;
            case 'paciente':
                res.redirect('/dashboard/paciente');
                break;
            default:
                res.redirect('/');
        }

    } catch (error) {
        res.status(500).send('Error interno del servidor.');
    }
});

module.exports = router;