const { authJwt } = require("../middleware");
const controller = require("../controllers/position.controller.js");

module.exports = function(app) {
    const router = require("express").Router();

    // These routes are protected and only for admins of a company
    const adminMiddleware = [authJwt.verifyToken, authJwt.isAdmin];

    // Create a new Position
    router.post("/", adminMiddleware, controller.create);

    // Retrieve all Positions for the company
    router.get("/", adminMiddleware, controller.getAll);

    // Retrieve a single Position with id
    router.get("/:id", adminMiddleware, controller.getById);

    // Update a Position with id
    router.put("/:id", adminMiddleware, controller.update);

    // Delete a Position with id
    router.delete("/:id", adminMiddleware, controller.delete);

    app.use('/api/admin/positions', router);
};
