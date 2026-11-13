const express = require('express');
const {
    getReservations,
    getReservation,
    addReservation,
    updateReservation,
    deleteReservation,
    exportReservationsCSV
} = require('../controllers/reservations');

const router = express.Router({ mergeParams: true });

const { protect, authorize } = require('../middleware/auth');

/**
 * @swagger
 * components:
 *   schemas:
 *     Reservation:
 *       type: object
 *       required:
 *         - reservationDate
 *         - restaurant
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated id of the reservation
 *         reservationDate:
 *           type: string
 *           format: date-time
 *           description: Reservation date and time
 *         timeSlot:
 *           type: string
 *           description: Time slot in HH:mm format
 *           example: "18:00"
 *         tablesCount:
 *           type: number
 *           description: Number of tables to reserve
 *           example: 1
 *         partySize:
 *           type: number
 *           description: Number of guests
 *           example: 4
 *         specialRequests:
 *           type: string
 *           description: Dietary requirements or seating preferences
 *         user:
 *           type: string
 *           description: ID of user making reservation
 *         restaurant:
 *           type: string
 *           description: ID of restaurant being reserved
 *       example:
 *         reservationDate: "2026-11-20T18:00:00.000Z"
 *         timeSlot: "18:00"
 *         tablesCount: 1
 *         partySize: 4
 *         specialRequests: "Window seat preferred"
 */

/**
 * @swagger
 * tags:
 *   name: Reservations
 *   description: The reservations managing API
 */

/**
 * @swagger
 * /reservations:
 *   get:
 *     summary: Returns the list of all reservations (Admin sees all, User sees own)
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of reservations
 *   post:
 *     summary: Create a new reservation
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Reservation'
 *     responses:
 *       201:
 *         description: The reservation was created
 *       400:
 *         description: Quota exceeded, time slot outside open hours, or capacity full
 */

/**
 * @swagger
 * /reservations/export:
 *   get:
 *     summary: Export reservations as CSV file (Admin only)
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         description: Start date filter (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         description: End date filter (YYYY-MM-DD)
 *       - in: query
 *         name: restaurantId
 *         description: Filter by specific restaurant ID
 *     responses:
 *       200:
 *         description: CSV file of reservations
 */

/**
 * @swagger
 * /reservations/{id}:
 *   get:
 *     summary: Get reservation by id
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Reservation id
 *     responses:
 *       200:
 *         description: Reservation details
 *       404:
 *         description: Reservation not found
 *   put:
 *     summary: Update reservation by id (enforces 2-hour cutoff for users)
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: The reservation was updated
 *       400:
 *         description: Cannot update within 2 hours of reserved time or capacity exceeded
 *   delete:
 *     summary: Delete reservation by id (enforces 2-hour cutoff for users)
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: The reservation was deleted
 *       400:
 *         description: Cannot cancel within 2 hours of reserved time
 */

// Export CSV route (must be defined before /:id)
router.route('/export')
    .get(protect, authorize('admin'), exportReservationsCSV);

router.route('/')
    .get(protect, getReservations)
    .post(protect, authorize('admin', 'user'), addReservation);

router.route('/:id')
    .get(protect, getReservation)
    .put(protect, authorize('admin', 'user'), updateReservation)
    .delete(protect, authorize('admin', 'user'), deleteReservation);

module.exports = router;
