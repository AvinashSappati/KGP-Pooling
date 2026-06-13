const express = require('express');
const router = express.Router();
const rideController = require('../controllers/rideController');

router.get('/feed', rideController.getFeed);
router.post('/create', rideController.createRide);
router.put('/:id/join', rideController.joinRide);
router.delete('/:id', rideController.deleteRide); 

module.exports = router;