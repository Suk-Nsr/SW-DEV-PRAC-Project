const express = require('express');
const {
    getRestaurants,
    getRestaurant,
    createRestaurant,
    updateRestaurant,
    deleteRestaurant
} = require('../controllers/restaurants');

const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

// Re-route into other resource routers (reservations)
let reservationRouter;
try {
    reservationRouter = require('./reservations');
} catch (e) {
    try {
        reservationRouter = require('./appointments');
    } catch (err) {}
}

if (reservationRouter) {
    router.use('/:restaurantId/reservations', reservationRouter);
    router.use('/:restaurantId/appointments', reservationRouter);
}

/**
 * @swagger
 * components:
 *   schemas:
 *     Restaurant:
 *       type: object
 *       required:
 *         - name
 *         - address
 *         - tel
 *         - openCloseTime
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated id of the restaurant
 *         name:
 *           type: string
 *           description: Restaurant name
 *         address:
 *           type: string
 *           description: Restaurant address
 *         tel:
 *           type: string
 *           description: Telephone number
 *         openCloseTime:
 *           type: string
 *           description: Restaurant opening and closing hours
 *           example: "10:00 - 22:00"
 *         tableCapacity:
 *           type: number
 *           description: Maximum table capacity for reservation
 *           example: 20
 *       example:
 *         name: "Siam Delights Restaurant"
 *         address: "123 Phayathai Road, Pathumwan, Bangkok 10330"
 *         tel: "02-1234567"
 *         openCloseTime: "10:00 - 22:00"
 *         tableCapacity: 20
 */

/**
 * @swagger
 * tags:
 *   name: Restaurants
 *   description: The restaurants managing API
 */

/**
 * @swagger
 * /restaurants:
 *   get:
 *     summary: Returns the list of all restaurants
 *     tags: [Restaurants]
 *     responses:
 *       200:
 *         description: The list of restaurants
 *   post:
 *     summary: Create a new restaurant
 *     tags: [Restaurants]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Restaurant'
 *     responses:
 *       201:
 *         description: The restaurant was successfully created
 */

/**
 * @swagger
 * /restaurants/{id}:
 *   get:
 *     summary: Get restaurant by id
 *     tags: [Restaurants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Restaurant id
 *     responses:
 *       200:
 *         description: The restaurant description by id
 *       404:
 *         description: Restaurant not found
 *   put:
 *     summary: Update restaurant by id
 *     tags: [Restaurants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: The restaurant was updated
 *   delete:
 *     summary: Delete restaurant by id
 *     tags: [Restaurants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: The restaurant was deleted
 */

router.route('/')
    .get(getRestaurants)
    .post(protect, authorize('admin'), createRestaurant);

router.route('/:id')
    .get(getRestaurant)
    .put(protect, authorize('admin'), updateRestaurant)
    .delete(protect, authorize('admin'), deleteRestaurant);

module.exports = router;

