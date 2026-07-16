const { authJwt, paramValidators } = require("../middleware");
const controller = require("../controllers/employeeStatus.controller");

module.exports = function(app) {
    const fullAdminAccess = [authJwt.verifyToken, authJwt.isAdminOrSuperAdmin];
    const fullAdminAccessWithIdValidation = [...fullAdminAccess, paramValidators.validateId];

    const path = "/api/admin/employee-statuses";
    const pathWithId = `${path}/:id`;

    app.get(path, fullAdminAccess, controller.getAll);
    app.post(path, fullAdminAccess, controller.create);
    app.get(pathWithId, fullAdminAccessWithIdValidation, controller.getById);
    app.put(pathWithId, fullAdminAccessWithIdValidation, controller.update);
    app.delete(pathWithId, fullAdminAccessWithIdValidation, controller.delete);
};
