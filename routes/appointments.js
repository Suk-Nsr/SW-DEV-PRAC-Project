const express = require('express');
const {
    getAppointments,
    getAppointment,
    addAppointment,
    updateAppointment,
    deleteAppointment,
    exportReservationsCSV
} = require('../controllers/appointments');

const router = express.Router({ mergeParams: true });

const { protect, authorize } = require('../middleware/auth');

// Export CSV route (must be defined before /:id)
router.route('/export')
    .get(protect, authorize('admin'), exportReservationsCSV);

router.route('/')
    .get(protect, getAppointments)
    .post(protect, authorize('admin', 'user'), addAppointment);

router.route('/:id')
    .get(protect, getAppointment)
    .put(protect, authorize('admin', 'user'), updateAppointment)
    .delete(protect, authorize('admin', 'user'), deleteAppointment);

module.exports = router;
