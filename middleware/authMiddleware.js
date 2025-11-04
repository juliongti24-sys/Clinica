const Usuario = require('../models/Usuario');

// Middleware para proteger rutas que requieren login
const requireLogin = (req, res, next) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    next();
};

// Middleware para verificar si el usuario es Administrador
const requireAdmin = (req, res, next) => {
    // Primero, debe estar logueado
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    // Segundo, su rol debe ser 'administrador'
    // (Obtenemos el rol desde res.locals, que es cargado por 'checkUser')
    if (res.locals.usuario && res.locals.usuario.role === 'administrador') {
        next();
    } else {
        res.status(403).send('Acceso denegado. No eres administrador.');
    }
};

// Middleware para cargar los datos del usuario en CADA petición
const checkUser = async (req, res, next) => {
    res.locals.usuario = null;
    if (req.session.userId) {
        try {
            const usuario = await Usuario.findById(req.session.userId).select('-password');
            res.locals.usuario = usuario;
        } catch (error) {
            console.error(error);
        }
    }
    next();
};


// Middleware para redirigir si el usuario YA está logueado
const redirectIfLoggedIn = (req, res, next) => {
    if (req.session.userId) {
        // Si hay sesión, redirige al dashboard principal
        // (La ruta '/' se encargará de enviarlo al dashboard correcto)
        return res.redirect('/');
    }
    // Si no hay sesión, continúa a la página de login/registro
    next();
};


// Middleware para verificar si el usuario es Admin O Recepcionista
const requireManagement = (req, res, next) => {
    // Primero, debe estar logueado
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    
    // Segundo, su rol debe ser 'administrador' O 'recepcionista'
    const role = res.locals.usuario.role;
    if (role === 'administrador' || role === 'recepcionista') {
        next(); // Permitir acceso
    } else {
        res.status(403).send('Acceso denegado. Se requiere rol de Administrador o Recepcionista.');
    }
};

module.exports = { 
    requireLogin, 
    requireAdmin, 
    checkUser, 
    redirectIfLoggedIn,
    requireManagement 
};