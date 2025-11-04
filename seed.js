const mongoose = require('mongoose');
const Usuario = require('./models/Usuario'); // Importamos tu modelo
require('dotenv').config(); // Para cargar tu MONGO_URI

/**
 * Script para "sembrar" (seed) el primer administrador en la base de datos.
 * Ejecutar UNA SOLA VEZ desde la terminal con: node seed.js
 */
const seedAdmin = async () => {
    try {
        // 1. Conectar a MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Conectado a MongoDB para la siembra...');

        // --- DEFINE LOS DATOS DE TU ADMIN AQUÍ ---
        const adminEmail = 'admin@clinica.com';
        const adminPassword = 'PasswordSeguro123!'; // ¡Cambia esto por una contraseña fuerte!
        
        // 2. Verificar si el admin ya existe
        const existingAdmin = await Usuario.findOne({ email: adminEmail });

        if (existingAdmin) {
            console.log('El administrador ya existe en la base de datos.');
            return; // Detiene el script si ya existe
        }

        // 3. Crear la instancia del nuevo administrador
        const admin = new Usuario({
            nombre: 'Administrador Principal',
            email: adminEmail,
            password: adminPassword, // Pasamos la contraseña en texto plano
            direccion: 'Oficina Central, Av. Siempre Viva 123',
            telefono: '5512345678',
            role: 'administrador'
            // Los campos de paciente/médico se omiten y quedan 'undefined'
        });

        // 4. Guardar el admin
        // ¡AQUÍ ES DONDE OCURRE LA MAGIA!
        // El 'usuarioSchema.pre('save', ...)' en tu modelo interceptará
        // esto, cifrará la contraseña (adminPassword) y luego la guardará.
        await admin.save();

        console.log('==============================================');
        console.log('✅ ¡Administrador creado con éxito!');
        console.log(`   Email: ${adminEmail}`);
        console.log(`   Password: ${adminPassword}`);
        console.log('==============================================');
        console.log('¡Inicia sesión con estas credenciales!');

    } catch (error) {
        console.error('❌ Error al sembrar el administrador:', error.message);
    } finally {
        // 5. Desconectar de la BD (muy importante)
        await mongoose.disconnect();
        console.log('Desconectado de MongoDB.');
    }
};

// 6. Ejecutar la función
seedAdmin();