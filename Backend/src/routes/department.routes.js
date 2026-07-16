const { authJwt } = require("../middleware");
const controller = require("../controllers/department.controller.js");

module.exports = function(app) {
    const router = require("express").Router();

    // These routes are protected and only for admins of a company
    const adminMiddleware = [authJwt.verifyToken, authJwt.isAdmin];

    // Create a new Department
    router.post("/", adminMiddleware, controller.create);

    // Retrieve all Departments for the company
    router.get("/", adminMiddleware, controller.getAll);

    // Retrieve a single Department with id
    router.get("/:id", adminMiddleware, controller.getById);

    // Update a Department with id
    router.put("/:id", adminMiddleware, controller.update);

    // Delete a Department with id
    router.delete("/:id", adminMiddleware, controller.delete);

    app.use('/api/admin/departments', router);
};
