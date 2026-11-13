const mongoose = require('mongoose');

const ReservationSchema = new mongoose.Schema(
    {
        reservationDate: {
            type: Date,
            required: [true, 'Please add a reservation date and time']
        },
        timeSlot: {
            type: String,
            trim: true,
            match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please add a valid time slot in HH:mm format (e.g. 18:30)']
        },
        tablesCount: {
            type: Number,
            required: [true, 'Please add number of tables to reserve'],
            default: 1,
            min: [1, 'Must reserve at least 1 table']
        },
        partySize: {
            type: Number,
            min: [1, 'Party size must be at least 1']
        },
        specialRequests: {
            type: String,
            trim: true,
            maxlength: [500, 'Special requests cannot exceed 500 characters']
        },
        user: {
            type: mongoose.Schema.ObjectId,
            ref: 'User',
            required: true
        },
        restaurant: {
            type: mongoose.Schema.ObjectId,
            ref: 'Restaurant',
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

module.exports = mongoose.model('Reservation', ReservationSchema);
