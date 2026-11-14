const Reservation = require('../models/Reservation');
const Restaurant = require('../models/Restaurant');
const User = require('../models/Users');
const { sendReservationNotification } = require('../utils/sendEmail');

/**
 * Helper to parse "HH:mm" string into minutes from midnight (0 - 1439)
 */
const timeToMinutes = (timeStr) => {
    if (!timeStr) return null;
    const parts = timeStr.trim().split(':');
    if (parts.length < 2) return null;
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return null;
    return hours * 60 + minutes;
};

//@desc     Get all reservations
//@route    GET /api/v1/reservations
//@route    GET /api/v1/restaurants/:restaurantId/reservations
//@access   Private
exports.getReservations = async (req, res, next) => {
    try {
        let query;
        const restaurantId = req.params.restaurantId;

        // General users can see only their reservations
        if (req.user.role !== 'admin') {
            const filter = { user: req.user.id };
            if (restaurantId) {
                filter.restaurant = restaurantId;
            }
            query = Reservation.find(filter)
                .populate({ path: 'restaurant', select: 'name address tel openCloseTime openTime closeTime tableCapacity' });
        } else {
            // Admin can see all
            const filter = {};
            if (restaurantId) {
                filter.restaurant = restaurantId;
            }
            query = Reservation.find(filter)
                .populate({ path: 'user', select: 'name email tel telephone' })
                .populate({ path: 'restaurant', select: 'name address tel openCloseTime openTime closeTime tableCapacity' });
        }

        const reservations = await query;
        res.status(200).json({
            success: true,
            count: reservations.length,
            data: reservations
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Cannot find Reservation' });
    }
};

//@desc     Get single reservation
//@route    GET /api/v1/reservations/:id
//@access   Private
exports.getReservation = async (req, res, next) => {
    try {
        const reservation = await Reservation.findById(req.params.id)
            .populate({ path: 'user', select: 'name email tel telephone' })
            .populate({ path: 'restaurant', select: 'name address tel openCloseTime openTime closeTime tableCapacity' });

        if (!reservation) {
            return res.status(404).json({
                success: false,
                message: `No reservation with the id of ${req.params.id}`
            });
        }

        // Make sure user is reservation owner or admin
        if (reservation.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({
                success: false,
                message: `User ${req.user.id} is not authorized to view this reservation`
            });
        }

        res.status(200).json({ success: true, data: reservation });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: `No reservation with the id of ${req.params.id}`
            });
        }
        console.error(error);
        return res.status(500).json({ success: false, message: 'Cannot find Reservation' });
    }
};

//@desc     Create new reservation
//@route    POST /api/v1/restaurants/:restaurantId/reservations
//@route    POST /api/v1/reservations
//@access   Private
exports.addReservation = async (req, res, next) => {
    try {
        const targetRestaurantId = req.params.restaurantId || req.body.restaurant;

        if (!targetRestaurantId) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a restaurant ID'
            });
        }

        // Check if restaurant exists
        const restaurant = await Restaurant.findById(targetRestaurantId);
        if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: `No restaurant with the id of ${targetRestaurantId}`
            });
        }

        req.body.restaurant = targetRestaurantId;
        req.body.user = req.user.id;

        const rawDate = req.body.reservationDate;
        if (!rawDate) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a reservation date'
            });
        }

        const reservationDate = new Date(rawDate);
        if (isNaN(reservationDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid reservation date format'
            });
        }
        req.body.reservationDate = reservationDate;

        const tablesToBook = parseInt(req.body.tablesCount || 1, 10);
        if (isNaN(tablesToBook) || tablesToBook < 1) {
            return res.status(400).json({
                success: false,
                message: 'tablesCount must be at least 1'
            });
        }
        req.body.tablesCount = tablesToBook;

        // Quota check: registered user can reserve up to 3 tables in total
        const existedReservations = await Reservation.find({ user: req.user.id });
        const totalBookedTables = existedReservations.reduce((sum, r) => sum + (r.tablesCount || 1), 0);

        if ((totalBookedTables + tablesToBook > 3 || existedReservations.length >= 3) && req.user.role !== 'admin') {
            return res.status(400).json({
                success: false,
                message: `The user with ID ${req.user.id} has already made 3 reservations or exceeded the 3-table quota (currently booked: ${totalBookedTables}, requested: ${tablesToBook})`
            });
        }

        // Time slot derivation: take from req.body.timeSlot or extract from reservationDate
        let slot = req.body.timeSlot;
        if (!slot) {
            const hours = String(reservationDate.getHours()).padStart(2, '0');
            const minutes = String(reservationDate.getMinutes()).padStart(2, '0');
            slot = `${hours}:${minutes}`;
            req.body.timeSlot = slot;
        }

        // Extra Credit: Validate restaurant opening hours
        if (restaurant.openTime && restaurant.closeTime) {
            const slotMin = timeToMinutes(slot);
            const openMin = timeToMinutes(restaurant.openTime);
            const closeMin = timeToMinutes(restaurant.closeTime);

            if (slotMin !== null && openMin !== null && closeMin !== null) {
                let isWithinHours = false;
                if (openMin <= closeMin) {
                    isWithinHours = slotMin >= openMin && slotMin <= closeMin;
                } else {
                    // overnight handling e.g. 18:00 - 02:00
                    isWithinHours = slotMin >= openMin || slotMin <= closeMin;
                }

                if (!isWithinHours) {
                    return res.status(400).json({
                        success: false,
                        message: `Selected time slot ${slot} is outside the restaurant opening hours (${restaurant.openTime} - ${restaurant.closeTime})`
                    });
                }
            }
        }

        // Extra Credit: Table capacity limit per time slot on that date
        const startOfDay = new Date(reservationDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(reservationDate);
        endOfDay.setHours(23, 59, 59, 999);

        const currentSlotBookings = await Reservation.find({
            restaurant: targetRestaurantId,
            reservationDate: { $gte: startOfDay, $lte: endOfDay },
            timeSlot: slot
        });

        const bookedTablesInSlot = currentSlotBookings.reduce((sum, r) => sum + (r.tablesCount || 1), 0);
        const capacity = restaurant.tableCapacity || 20;

        if (bookedTablesInSlot + tablesToBook > capacity) {
            return res.status(400).json({
                success: false,
                message: `Restaurant capacity exceeded for slot ${slot}. Available: ${Math.max(0, capacity - bookedTablesInSlot)}, Requested: ${tablesToBook}`
            });
        }

        const reservation = await Reservation.create(req.body);

        // Extra Credit: Send automated reservation confirmation email
        sendReservationNotification({
            eventType: 'booking',
            user: req.user,
            reservation,
            restaurant
        }).catch(err => console.error('[Email Notification Error]', err.message));

        res.status(201).json({
            success: true,
            data: reservation
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Cannot create Reservation' });
    }
};

//@desc     Update reservation
//@route    PUT /api/v1/reservations/:id
//@access   Private
exports.updateReservation = async (req, res, next) => {
    try {
        let reservation = await Reservation.findById(req.params.id);

        if (!reservation) {
            return res.status(404).json({
                success: false,
                message: `No reservation with the id of ${req.params.id}`
            });
        }

        // Make sure user is the reservation owner or admin
        if (reservation.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({
                success: false,
                message: `User ${req.user.id} is not authorized to update this reservation`
            });
        }

        // Extra Credit: 2-Hour Cutoff Enforcement for non-admin
        if (req.user.role !== 'admin') {
            const now = new Date();
            const resTime = new Date(reservation.reservationDate).getTime();
            const diffHours = (resTime - now.getTime()) / (1000 * 60 * 60);

            if (diffHours < 2) {
                return res.status(400).json({
                    success: false,
                    message: 'Modification is not permitted within 2 hours of the reserved time'
                });
            }
        }

        // If date, slot, or tablesCount is modified, re-validate capacity
        const targetRestaurantId = req.body.restaurant || reservation.restaurant;
        const newDateRaw = req.body.reservationDate || reservation.reservationDate;
        const newReservationDate = new Date(newDateRaw);

        if (isNaN(newReservationDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid reservation date format'
            });
        }
        req.body.reservationDate = newReservationDate;

        let slot = req.body.timeSlot || reservation.timeSlot;
        if (!slot) {
            const hours = String(newReservationDate.getHours()).padStart(2, '0');
            const minutes = String(newReservationDate.getMinutes()).padStart(2, '0');
            slot = `${hours}:${minutes}`;
            req.body.timeSlot = slot;
        }

        const tablesToBook = parseInt(req.body.tablesCount || reservation.tablesCount || 1, 10);
        req.body.tablesCount = tablesToBook;

        const restaurant = await Restaurant.findById(targetRestaurantId);
        if (restaurant) {
            // Opening hours check
            if (restaurant.openTime && restaurant.closeTime) {
                const slotMin = timeToMinutes(slot);
                const openMin = timeToMinutes(restaurant.openTime);
                const closeMin = timeToMinutes(restaurant.closeTime);

                if (slotMin !== null && openMin !== null && closeMin !== null) {
                    let isWithinHours = false;
                    if (openMin <= closeMin) {
                        isWithinHours = slotMin >= openMin && slotMin <= closeMin;
                    } else {
                        isWithinHours = slotMin >= openMin || slotMin <= closeMin;
                    }

                    if (!isWithinHours) {
                        return res.status(400).json({
                            success: false,
                            message: `Selected time slot ${slot} is outside the restaurant opening hours (${restaurant.openTime} - ${restaurant.closeTime})`
                        });
                    }
                }
            }

            // Table capacity check excluding this reservation
            const startOfDay = new Date(newReservationDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(newReservationDate);
            endOfDay.setHours(23, 59, 59, 999);

            const currentSlotBookings = await Reservation.find({
                _id: { $ne: reservation._id },
                restaurant: targetRestaurantId,
                reservationDate: { $gte: startOfDay, $lte: endOfDay },
                timeSlot: slot
            });

            const bookedTablesInSlot = currentSlotBookings.reduce((sum, r) => sum + (r.tablesCount || 1), 0);
            const capacity = restaurant.tableCapacity || 20;

            if (bookedTablesInSlot + tablesToBook > capacity) {
                return res.status(400).json({
                    success: false,
                    message: `Restaurant capacity exceeded for slot ${slot}. Available: ${Math.max(0, capacity - bookedTablesInSlot)}, Requested: ${tablesToBook}`
                });
            }
        }

        reservation = await Reservation.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        // Extra Credit: Send automated reservation update email
        sendReservationNotification({
            eventType: 'modification',
            user: req.user,
            reservation,
            restaurant
        }).catch(err => console.error('[Email Notification Error]', err.message));

        res.status(200).json({ success: true, data: reservation });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: `No reservation with the id of ${req.params.id}`
            });
        }
        console.error(error);
        return res.status(500).json({ success: false, message: 'Cannot update Reservation' });
    }
};

//@desc     Delete reservation
//@route    DELETE /api/v1/reservations/:id
//@access   Private
exports.deleteReservation = async (req, res, next) => {
    try {
        const reservation = await Reservation.findById(req.params.id);

        if (!reservation) {
            return res.status(404).json({
                success: false,
                message: `No reservation with the id of ${req.params.id}`
            });
        }

        // Make sure user is the reservation owner or admin
        if (reservation.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({
                success: false,
                message: `User ${req.user.id} is not authorized to delete this reservation`
            });
        }

        // Extra Credit: 2-Hour Cutoff Enforcement for non-admin
        if (req.user.role !== 'admin') {
            const now = new Date();
            const resTime = new Date(reservation.reservationDate).getTime();
            const diffHours = (resTime - now.getTime()) / (1000 * 60 * 60);

            if (diffHours < 2) {
                return res.status(400).json({
                    success: false,
                    message: 'Cancellation is not permitted within 2 hours of the reserved time'
                });
            }
        }

        // Find restaurant and target user for cancellation email
        const restaurant = await Restaurant.findById(reservation.restaurant);
        let targetUser = req.user;
        if (reservation.user.toString() !== req.user.id) {
            targetUser = await User.findById(reservation.user);
        }

        await reservation.deleteOne();

        // Extra Credit: Send automated reservation cancellation email
        if (targetUser) {
            sendReservationNotification({
                eventType: 'cancellation',
                user: targetUser,
                reservation,
                restaurant
            }).catch(err => console.error('[Email Notification Error]', err.message));
        }

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: `No reservation with the id of ${req.params.id}`
            });
        }
        console.error(error);
        return res.status(500).json({ success: false, message: 'Cannot delete Reservation' });
    }
};

//@desc     Export all reservations within a date range to CSV (Extra Credit)
//@route    GET /api/v1/reservations/export
//@access   Private (Admin)
exports.exportReservationsCSV = async (req, res, next) => {
    try {
        const { startDate, endDate, restaurantId } = req.query;

        const filter = {};
        if (restaurantId) {
            filter.restaurant = restaurantId;
        }

        let start = null;
        let end = null;

        if (startDate) {
            start = new Date(startDate);
            if (isNaN(start.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid startDate format. Please use ISO 8601 or YYYY-MM-DD format (e.g. 2026-11-01)'
                });
            }
        }

        if (endDate) {
            end = new Date(endDate);
            if (isNaN(end.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid endDate format. Please use ISO 8601 or YYYY-MM-DD format (e.g. 2026-11-30)'
                });
            }
            if (String(endDate).trim().length <= 10) {
                end.setHours(23, 59, 59, 999);
            }
        }

        if (start && end && start > end) {
            return res.status(400).json({
                success: false,
                message: 'startDate cannot be later than endDate'
            });
        }

        if (start || end) {
            const dateRange = {};
            if (start) dateRange.$gte = start;
            if (end) dateRange.$lte = end;
            filter.reservationDate = dateRange;
        }

        const records = await Reservation.find(filter)
            .populate({ path: 'user', select: 'name email tel telephone' })
            .populate({ path: 'restaurant', select: 'name address tel openCloseTime' })
            .sort({ reservationDate: 1 });

        const headers = [
            'Reservation ID',
            'User Name',
            'User Email',
            'User Telephone',
            'Restaurant Name',
            'Reservation Date',
            'Time Slot',
            'Tables Count',
            'Party Size',
            'Special Requests',
            'Created At'
        ];

        const escapeCSV = (val) => {
            if (val === null || val === undefined) return '""';
            const str = String(val).replace(/"/g, '""');
            return `"${str}"`;
        };

        const rows = records.map(r => {
            const user = r.user || {};
            const restaurant = r.restaurant || {};
            const resDate = r.reservationDate;
            const resDateFormatted = resDate ? new Date(resDate).toISOString() : '';
            const createdAt = r.createdAt ? new Date(r.createdAt).toISOString() : '';

            return [
                escapeCSV(r._id),
                escapeCSV(user.name || 'N/A'),
                escapeCSV(user.email || 'N/A'),
                escapeCSV(user.tel || user.telephone || 'N/A'),
                escapeCSV(restaurant.name || 'N/A'),
                escapeCSV(resDateFormatted),
                escapeCSV(r.timeSlot || 'N/A'),
                escapeCSV(r.tablesCount || 1),
                escapeCSV(r.partySize || 'N/A'),
                escapeCSV(r.specialRequests || ''),
                escapeCSV(createdAt)
            ].join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\r\n');
        const filename = `reservations_export_${new Date().toISOString().slice(0, 10)}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(csvContent);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Cannot export reservations to CSV' });
    }
};
