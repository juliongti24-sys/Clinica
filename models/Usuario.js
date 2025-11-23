const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Schema = mongoose.Schema;

const usuarioSchema = new Schema({
    // --- Campos Comunes (Todos los roles) ---
    email: {
        type: String,
        required: [true, 'El email es obligatorio'],
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: [true, 'La contraseña es obligatoria'],
        trim: true
    },
    nombre: {
        type: String,
        required: [true, 'El nombre es obligatorio'],
        trim: true
    },
    direccion: {
        type: String,
        required: [true, 'La dirección es obligatoria'], 
        trim: true
    },
    telefono: {
        type: String,
        required: [true, 'El teléfono es obligatorio'],
        trim: true
    },
    role: {
        type: String,
        required: true,
        enum: ['paciente', 'medico', 'recepcionista', 'administrador'],
        default: 'paciente'
    },
    // FOTO DE PERFIL   
    fotoPerfil: { 
        type: String, 
    },

    // --- Campos Específicos (Opcionales) ---
    
    // Paciente
    fechaNacimiento: { type: Date },
    numeroSeguro: { type: String },

    // Medico
    especialidad: { type: String },
    cedula: { type: String },

    // Definimos el horario laboral del médico
    horario: {
        type: Map,
        of: {
            inicio: { type: String }, // ej: "09:00"
            fin: { type: String }     // ej: "17:00"
        },
        // horario por defecto
        default: {
            // 0=Domingo, 1=Lunes, ..., 6=Sábado
            "1": { inicio: "09:00", fin: "17:00" }, // Lunes
            "2": { inicio: "09:00", fin: "17:00" }, // Martes
            "3": { inicio: "09:00", fin: "17:00" }, // Miércoles
            "4": { inicio: "09:00", fin: "17:00" }, // Jueves
            "5": { inicio: "09:00", fin: "13:00" }  // Viernes
            // Sábado y Domingo no trabaja
        }
    }

    // Recepcionista y Administrador no tienen campos extra

}, { timestamps: true });

// --- Cifrado de Contraseña (Hashing) ---
// Esto se ejecuta automáticamente ANTES de guardar un usuario (nuevo o modificado)
usuarioSchema.pre('save', async function(next) {
    // Si la contraseña no se ha modificado, sigue adelante
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// --- Método para comparar contraseñas en el Login ---
usuarioSchema.methods.compararPassword = async function(passwordFormulario) {
    try {
        return await bcrypt.compare(passwordFormulario, this.password);
    } catch (error) {
        throw new Error(error);
    }
};

module.exports = mongoose.model('Usuario', usuarioSchema);