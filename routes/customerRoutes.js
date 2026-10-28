const router = require('express').Router();
const controller = require('../controllers/customerController');
router.use(require('../middleware/authMiddleware'), require('../middleware/roleMiddleware')('customer'));
router.get('/settings', controller.getSettings);
router.get('/reviews', controller.getReviews);
module.exports = router;
