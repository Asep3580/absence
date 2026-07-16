const { authJwt } = require("../middleware");
const controller = require("../controllers/workSchedule.controller.js");

module.exports = function(app) {
    const router = require("express").Router();

    // These routes are protected and only for admins of a company
    const adminMiddleware = [authJwt.verifyToken, authJwt.isAdmin];

    // Create a new Work Schedule
    router.post("/", adminMiddleware, controller.create);

    // Retrieve all Work Schedules for the company
    router.get("/", adminMiddleware, controller.findAll);

    // Retrieve a single Work Schedule with id
    router.get("/:id", adminMiddleware, controller.findOne);

    // Update a Work Schedule with id
    router.put("/:id", adminMiddleware, controller.update);

    // Delete a Work Schedule with id
    router.delete("/:id", adminMiddleware, controller.delete);

    app.use('/api/admin/work-schedules', router);
};