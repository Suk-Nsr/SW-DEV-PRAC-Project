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
        required: [true, 'Please add an address'],
        trim: true
    },
    tel: {
        type: String,
        required: [true, 'Please add a telephone number'],
        trim: true
    },
    openCloseTime: {
        type: String,
        required: [true, 'Please add open-close time (e.g. 10:00 - 22:00)'],
        trim: true
    },
    openTime: {
        type: String,
        default: '10:00',
        trim: true
    },
    closeTime: {
        type: String,
        default: '22:00',
        trim: true
    },
    tableCapacity: {
        type: Number,
        default: 20,
        min: [1, 'Table capacity must be at least 1']
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

// Pre-save hook to automatically parse openTime and closeTime from openCloseTime
RestaurantSchema.pre('save', function() {
    if (this.openCloseTime && (!this.openTime || !this.closeTime || this.isModified('openCloseTime'))) {
        const parts = this.openCloseTime.split(/[-–—]/);
        if (parts.length === 2) {
            this.openTime = parts[0].trim();
            this.closeTime = parts[1].trim();
        }
    }
});

// Reverse populate with virtuals for reservations
RestaurantSchema.virtual('reservations', {
    ref: 'Reservation',
    localField: '_id',
    foreignField: 'restaurant',
    justOne: false
});

module.exports = mongoose.model('Restaurant', RestaurantSchema);
