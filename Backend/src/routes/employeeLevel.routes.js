const { authJwt } = require("../middleware");
const controller = require("../controllers/employeeLevel.controller.js");

module.exports = function(app) {
    const router = require("express").Router();

    // All these routes are protected and only for admins of a company
    const adminMiddleware = [authJwt.verifyToken, authJwt.isAdmin];

    // Create a new Employee Level
    router.post("/", adminMiddleware, controller.create);

    // Retrieve all Employee Levels
    router.get("/", adminMiddleware, controller.findAll);

    // Retrieve a single Employee Level with id
    router.get("/:id", adminMiddleware, controller.findOne);

    // Update an Employee Level with id
    router.put("/:id", adminMiddleware, controller.update);

    // Delete an Employee Level with id
    router.delete("/:id", adminMiddleware, controller.delete);

    app.use('/api/admin/employee-levels', router);
};