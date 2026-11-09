const mongoose = require('mongoose');

const RestaurantSchema = new mongoose.Schema(
{
    name: {
        type: String,
        required: [true, 'Please add a restaurant name'],
        unique: true,
        trim: true,
        maxlength: [50, 'Name cannot be longer than 50 characters']
    },
    address: {
        type: String,
        required: [true, 'Please add an address']
    },
    tel: {
        type: String,
        required: [true, 'Please add a telephone number']
    },
    openCloseTime: {
        type: String,
        required: [true, 'Please add open-close time (e.g. 10:00 - 22:00)']
    },
    openTime: {
        type: String,
        default: '10:00'
    },
    closeTime: {
        type: String,
        default: '22:00'
    },
    tableCapacity: {
        type: Number,
        default: 20
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
},
{
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Alias virtual for telephone
RestaurantSchema.virtual('telephone')
    .get(function() { return this.tel; })
    .set(function(value) { this.tel = value; });

// Reverse populate with virtuals for reservations
RestaurantSchema.virtual('reservations', {
    ref: 'Reservation',
    localField: '_id',
    foreignField: 'restaurant',
    justOne: false
});

module.exports = mongoose.model('Restaurant', RestaurantSchema);

