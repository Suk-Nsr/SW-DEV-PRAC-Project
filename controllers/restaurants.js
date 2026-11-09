const Restaurant = require('../models/Restaurant');
let Reservation;
try {
    Reservation = require('../models/Reservation');
} catch (e) {
    try {
        Reservation = require('../models/Appointment');
    } catch (err) {
        Reservation = null;
    }
}

//@desc     Get all restaurants
//@route    GET /api/v1/restaurants
//@access   Public
exports.getRestaurants = async (req, res, next) => {
    try {
        // Copy req.query
        const reqQuery = { ...req.query };

        // Fields to exclude from filtering
        const removeFields = ['select', 'sort', 'page', 'limit'];
        removeFields.forEach(param => delete reqQuery[param]);

        // Create query string with operators ($gt, $gte, etc)
        let queryStr = JSON.stringify(reqQuery);
        queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);
        const parsedQuery = JSON.parse(queryStr);

        // Finding resource
        let query = Restaurant.find(parsedQuery);

        // Try populating reservations if registered
        try {
            query = query.populate('reservations');
        } catch (e) {
            // Fallback without populate
        }

        // Select Fields
        if (req.query.select) {
            const fields = req.query.select.split(',').join(' ');
            query = query.select(fields);
        }

        // Sort
        if (req.query.sort) {
            const sortBy = req.query.sort.split(',').join(' ');
            query = query.sort(sortBy);
        } else {
            query = query.sort('-createdAt');
        }

        // Pagination with non-negative guard
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.max(1, parseInt(req.query.limit, 10) || 25);
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;

        // Accurate count matching the filter
        const total = await Restaurant.countDocuments(parsedQuery);
        query = query.skip(startIndex).limit(limit);

        const restaurants = await query;

        // Pagination result
        const pagination = {};
        if (endIndex < total) {
            pagination.next = { page: page + 1, limit };
        }
        if (startIndex > 0) {
            pagination.prev = { page: page - 1, limit };
        }

        res.status(200).json({
            success: true,
            count: restaurants.length,
            pagination,
            data: restaurants
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

//@desc     Get single restaurant
//@route    GET /api/v1/restaurants/:id
//@access   Public
exports.getRestaurant = async (req, res, next) => {
    try {
        let query = Restaurant.findById(req.params.id);
        try {
            query = query.populate('reservations');
        } catch (e) {}

        const restaurant = await query;

        if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: `Restaurant not found with id of ${req.params.id}`
            });
        }

        res.status(200).json({ success: true, data: restaurant });
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: `Restaurant not found with invalid id format: ${req.params.id}`
            });
        }
        res.status(400).json({ success: false, message: err.message });
    }
};

//@desc     Create new restaurant
//@route    POST /api/v1/restaurants
//@access   Private (Admin)
exports.createRestaurant = async (req, res, next) => {
    try {
        const restaurantData = { ...req.body };
        if (restaurantData.telephone && !restaurantData.tel) {
            restaurantData.tel = restaurantData.telephone;
        }

        // Auto-extract openTime and closeTime if openCloseTime is provided
        if (restaurantData.openCloseTime && (!restaurantData.openTime || !restaurantData.closeTime)) {
            const parts = restaurantData.openCloseTime.split(/[-–—]/);
            if (parts.length === 2) {
                restaurantData.openTime = parts[0].trim();
                restaurantData.closeTime = parts[1].trim();
            }
        }

        const restaurant = await Restaurant.create(restaurantData);
        res.status(201).json({ success: true, data: restaurant });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

//@desc     Update restaurant
//@route    PUT /api/v1/restaurants/:id
//@access   Private (Admin)
exports.updateRestaurant = async (req, res, next) => {
    try {
        const updateData = { ...req.body };
        if (updateData.telephone && !updateData.tel) {
            updateData.tel = updateData.telephone;
        }

        if (updateData.openCloseTime && (!updateData.openTime || !updateData.closeTime)) {
            const parts = updateData.openCloseTime.split(/[-–—]/);
            if (parts.length === 2) {
                updateData.openTime = parts[0].trim();
                updateData.closeTime = parts[1].trim();
            }
        }

        const restaurant = await Restaurant.findByIdAndUpdate(req.params.id, updateData, {
            new: true,
            runValidators: true
        });

        if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: `Restaurant not found with id of ${req.params.id}`
            });
        }

        res.status(200).json({ success: true, data: restaurant });
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: `Restaurant not found with invalid id format: ${req.params.id}`
            });
        }
        res.status(400).json({ success: false, message: err.message });
    }
};

//@desc     Delete restaurant
//@route    DELETE /api/v1/restaurants/:id
//@access   Private (Admin)
exports.deleteRestaurant = async (req, res, next) => {
    try {
        const restaurant = await Restaurant.findById(req.params.id);

        if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: `Restaurant not found with id of ${req.params.id}`
            });
        }

        // Cascade delete reservations associated with this restaurant
        if (Reservation) {
            await Reservation.deleteMany({
                $or: [{ restaurant: req.params.id }, { hospital: req.params.id }]
            });
        }

        // Also check Appointment model if separate
        try {
            const Appointment = require('../models/Appointment');
            if (Appointment && Appointment !== Reservation) {
                await Appointment.deleteMany({
                    $or: [{ restaurant: req.params.id }, { hospital: req.params.id }]
                });
            }
        } catch (e) {}

        await Restaurant.deleteOne({ _id: req.params.id });

        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: `Restaurant not found with invalid id format: ${req.params.id}`
            });
        }
        res.status(400).json({ success: false, message: err.message });
    }
};
