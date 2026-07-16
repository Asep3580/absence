const { authJwt } = require("../middleware");
const controller = require("../controllers/scheduleAssignment.controller.js");

module.exports = function(app) {
    const router = require("express").Router();

    // These routes are protected and only for admins of a company
    const adminMiddleware = [authJwt.verifyToken, authJwt.isAdmin];

    // Retrieve all Schedule Assignments for the company for a given month and year
    router.get("/", adminMiddleware, controller.getScheduleAssignments);

    // Bulk update schedule assignments
    router.post("/bulk", adminMiddleware, controller.bulkUpdate);

    // Bulk upload from Excel template
    router.post("/upload", adminMiddleware, controller.uploadFromExcel);

    app.use('/api/admin/schedule-assignments', router);
};
