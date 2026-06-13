// server/routes/poolRoutes.js
const express = require('express');
const router = express.Router();
const { getMyPools } = require('../controllers/poolController');

router.get('/my-pools', getMyPools);

module.exports = router;