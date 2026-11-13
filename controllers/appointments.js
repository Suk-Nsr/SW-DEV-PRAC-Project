const Appointment = require('../models/Appointment');
let Restaurant;
try {
    Restaurant = require('../models/Restaurant');
} catch (e) {
    Restaurant = null;
}
const Hospital = require('../models/Hospital');

//@desc     Get all appointments / reservations
//@route    GET /api/v1/appointments
//@route    GET /api/v1/restaurants/:restaurantId/appointments
//@access   Public
exports.getAppointments = async (req, res, next) => {
    let query;
    const targetId = req.params.restaurantId || req.params.hospitalId;

    // General users can see only their appointments
    if (req.user.role !== 'admin') {
        const filter = { user: req.user.id };
        if (targetId) {
            filter.$or = [{ hospital: targetId }, { restaurant: targetId }];
        }
        query = Appointment.find(filter)
            .populate({ path: 'hospital', select: 'name province tel openCloseTime' })
            .populate({ path: 'restaurant', select: 'name address tel openCloseTime' });
    } else {
        // If you are an admin, you can see all
        if (targetId) {
            query = Appointment.find({
                $or: [{ hospital: targetId }, { restaurant: targetId }]
            })
            .populate({ path: 'hospital', select: 'name province tel openCloseTime' })
            .populate({ path: 'restaurant', select: 'name address tel openCloseTime' });
        } else {
            query = Appointment.find()
                .populate({ path: 'hospital', select: 'name province tel openCloseTime' })
                .populate({ path: 'restaurant', select: 'name address tel openCloseTime' });
        }
    }

    try {
        const appointments = await query;
        res.status(200).json({ success: true, count: appointments.length, data: appointments });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Cannot find Appointment" });
    }
};

//@desc     Get single appointment
//@route    GET /api/v1/appointments/:id
//@access   Public
exports.getAppointment = async (req, res, next) => {
    try {
        const appointment = await Appointment.findById(req.params.id)
            .populate({ path: 'hospital', select: 'name description tel openCloseTime' })
            .populate({ path: 'restaurant', select: 'name address tel openCloseTime' });

        if (!appointment) {
            return res.status(404).json({ success: false, message: `No appointment with the id of ${req.params.id}` });
        }

        res.status(200).json({ success: true, data: appointment });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(404).json({ success: false, message: `No appointment with the id of ${req.params.id}` });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: 'Cannot find Appointment' });
    }
};

//@desc     Add appointment / reservation
//@route    POST /api/v1/restaurants/:restaurantId/appointments
//@route    POST /api/v1/hospitals/:hospitalId/appointments
//@access   Private
exports.addAppointment = async (req, res, next) => {
    try {
        const targetId = req.params.restaurantId || req.params.hospitalId || req.body.restaurant || req.body.hospital;

        if (!targetId) {
            return res.status(400).json({ success: false, message: 'Please provide a restaurant or hospital ID' });
        }

        // Check if hospital or restaurant exists
        let venue = null;
        if (Restaurant) {
            venue = await Restaurant.findById(targetId);
        }
        if (!venue && Hospital) {
            venue = await Hospital.findById(targetId);
        }

        if (!venue) {
            return res.status(404).json({ success: false, message: `No restaurant or hospital with the id of ${targetId}` });
        }

        // Set venue IDs in req.body for compatibility
        req.body.hospital = targetId;
        req.body.restaurant = targetId;

        // Add user Id to req.body
        req.body.user = req.user.id;

        // Check for existed appointments
        const existedAppointments = await Appointment.find({ user: req.user.id });

        // If the user is not an admin, they can only create up to 3 appointments/tables
        if (existedAppointments.length >= 3 && req.user.role !== 'admin') {
            return res.status(400).json({
                success: false,
                message: `The user with ID ${req.user.id} has already made 3 appointments`
            });
        }

        const appointment = await Appointment.create(req.body);

        res.status(201).json({ success: true, data: appointment });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Cannot create Appointment' });
    }
};

//@desc     Update appointment
//@route    PUT /api/v1/appointments/:id
//@access   Private
exports.updateAppointment = async (req, res, next) => {
    try {
        let appointment = await Appointment.findById(req.params.id);

        if (!appointment) {
            return res.status(404).json({ success: false, message: `No appointment with the id of ${req.params.id}` });
        }

        // Make sure user is the appointment owner or admin
        if (appointment.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({
                success: false,
                message: `User ${req.user.id} is not authorized to update this appointment`
            });
        }

        appointment = await Appointment.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({ success: true, data: appointment });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(404).json({ success: false, message: `No appointment with the id of ${req.params.id}` });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: "Cannot update Appointment" });
    }
};

//@desc     Delete appointment
//@route    DELETE /api/v1/appointments/:id
//@access   Private
exports.deleteAppointment = async (req, res, next) => {
    try {
        const appointment = await Appointment.findById(req.params.id);

        if (!appointment) {
            return res.status(404).json({ success: false, message: `No appointment with the id of ${req.params.id}` });
        }

        // Make sure user is the appointment owner or admin
        if (appointment.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({
                success: false,
                message: `User ${req.user.id} is not authorized to delete this appointment`
            });
        }

        await appointment.deleteOne();

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(404).json({ success: false, message: `No appointment with the id of ${req.params.id}` });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: "Cannot delete Appointment" });
    }
};

//@desc     Export all reservations within a date range to CSV (Extra Credit)
//@route    GET /api/v1/reservations/export
//@access   Private (Admin)
exports.exportReservationsCSV = async (req, res, next) => {
    try {
        const { startDate, endDate, restaurantId } = req.query;

        // Build query filter
        const filter = {};

        if (restaurantId) {
            filter.$or = [{ hospital: restaurantId }, { restaurant: restaurantId }];
        }

        // Date range filtering with robust date validation
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
            filter.apptDate = dateRange;
        }

        // Support both Reservation and Appointment models
        let ReservationModel = Appointment;
        try {
            const CustomReservation = require('../models/Reservation');
            if (CustomReservation) {
                ReservationModel = CustomReservation;
            }
        } catch (e) {}

        const records = await ReservationModel.find(filter)
            .populate({ path: 'user', select: 'name email tel telephone' })
            .populate({ path: 'hospital', select: 'name address tel openCloseTime' })
            .populate({ path: 'restaurant', select: 'name address tel openCloseTime' })
            .sort({ apptDate: 1 });

        // Build CSV output
        const headers = [
            'Reservation ID',
            'User Name',
            'User Email',
            'User Telephone',
            'Restaurant Name',
            'Reservation Date',
            'Created At'
        ];

        const escapeCSV = (val) => {
            if (val === null || val === undefined) return '""';
            const str = String(val).replace(/"/g, '""');
            return `"${str}"`;
        };

        const rows = records.map(r => {
            const user = r.user || {};
            const restaurant = r.restaurant || r.hospital || {};
            const resDate = r.apptDate || r.reservationDate;
            const resDateFormatted = resDate ? new Date(resDate).toISOString() : '';
            const createdAt = r.createdAt ? new Date(r.createdAt).toISOString() : '';

            return [
                escapeCSV(r._id),
                escapeCSV(user.name || 'N/A'),
                escapeCSV(user.email || 'N/A'),
                escapeCSV(user.tel || user.telephone || 'N/A'),
                escapeCSV(restaurant.name || 'N/A'),
                escapeCSV(resDateFormatted),
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
