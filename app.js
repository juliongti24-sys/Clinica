const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const managementRoutes = require('./routes/managementRoutes'); 
require('dotenv').config();

// --- Importar Middlewares y Rutas ---
const { checkUser, requireLogin } = require('./middleware/authMiddleware');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const appRoutes = require('./routes/appRoutes'); // (Asumiendo que aquí están las rutas de paciente, medico, etc.)

const app = express();
const port = process.env.PORT || 3000;

// ... (Configuración de EJS, static, urlencoded) ...
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

app.use(express.json()); // Middleware para "entender" datos JSON

// ... (Configuración de Sesión) ...
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI, collectionName: 'sessions' }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// --- Middlewares Globales ---
app.use(checkUser); // Pone 'res.locals.usuario' disponible en todas las vistas

// --- MONTAJE DE RUTAS ---

// 1. Rutas Públicas (Autenticación)
// Estas rutas NO requieren login.
app.use('/', authRoutes);

// 2. Ruta Raíz ("El Portero")
// Esta es la primera página a la que todos llegan.
app.get('/', (req, res) => {
    // Si no hay sesión (no logueado)
    if (!req.session.userId) {
        // Envíalo a la única página pública que puede ver
        return res.redirect('/login');
    }

    // Si SÍ hay sesión, 'res.locals.usuario' ya fue cargado por 'checkUser'
    const usuario = res.locals.usuario;
    
    if (!usuario) {
        // Falla de seguridad (sesión existe pero usuario no) -> a login
        return res.redirect('/login');
    }

    // Redirigir según el rol (Esta lógica ya la tenías en POST /login,
    // ahora también vive en la ruta raíz para usuarios que ya tienen sesión)
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
            res.redirect('/login');
    }
});

// 3. Rutas Protegidas
// Todas las rutas de la aplicación (admin, agendar, dashboards)
// se montan aquí y están protegidas globalmente por 'requireLogin'.
app.use('/admin', requireLogin, adminRoutes); // SOLO ADMIN
app.use('/manage', requireLogin, managementRoutes); // <-- 2. Monta (Admin Y Recep)
app.use('/', requireLogin, appRoutes); // Paneles de Paciente, Médico, Recepcionista


// ... (Conexión a BD y app.listen) ...
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('✅ Conectado a MongoDB Atlas');
        app.listen(port, () => {
            console.log(`Servidor corriendo en http://localhost:${port}`);
        });
    })
    .catch(err => console.error('❌ Error al conectar a MongoDB:', err));