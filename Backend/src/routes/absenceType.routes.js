const { authJwt } = require("../middleware");
const controller = require("../controllers/absenceType.controller.js");

module.exports = function(app) {
    const router = require("express").Router();

    // These routes are protected and only for admins of a company
    const adminMiddleware = [authJwt.verifyToken, authJwt.isAdmin];

    // Create a new Absence Type
    router.post("/", adminMiddleware, controller.create);

    // Retrieve all Absence Types for the company
    router.get("/", adminMiddleware, controller.findAll);

    // Retrieve a single Absence Type with id
    router.get("/:id", adminMiddleware, controller.findOne);

    // Update an Absence Type with id
    router.put("/:id", adminMiddleware, controller.update);

    // Delete an Absence Type with id
    router.delete("/:id", adminMiddleware, controller.delete);

    app.use('/api/admin/absence-types', router);
};