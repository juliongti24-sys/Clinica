// Importamos mongoose para definir el esquema de la cita
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const citaSchema = new Schema({
    paciente: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario', // Vinculado al paciente que la agendó
        required: true
    },
    medico: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario', // Vinculado al médico
        required: true
    },
    fecha: {
        type: Date,
        required: true
    },
    hora: {
        type: String, // ej: "09:30"
        required: true
    },
    motivo: {
        type: String,
        trim: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Cita', citaSchema);