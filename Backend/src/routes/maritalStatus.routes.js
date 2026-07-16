const { authJwt, paramValidators } = require("../middleware/index.js");
const controller = require("../controllers/maritalStatus.controller.js");

module.exports = function(app) {
    const router = require("express").Router();
    const adminMiddleware = [authJwt.verifyToken, authJwt.isAdmin];

    router.post("/", adminMiddleware, controller.create);
    router.get("/", adminMiddleware, controller.getAll);
    router.get("/:id", adminMiddleware, controller.getById);
    router.put("/:id", adminMiddleware, controller.update);
    router.delete("/:id", adminMiddleware, controller.delete);

    app.use('/api/admin/marital-statuses', router);
};