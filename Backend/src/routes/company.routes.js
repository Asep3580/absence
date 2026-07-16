const { authJwt } = require("../middleware");
const controller = require("../controllers/company.controller");

module.exports = function(app) {
    app.use(function(req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    // Public route to register a new company and its first admin user
    app.post("/api/company/register", controller.register);

    // Routes for company admin to manage their own company settings
    app.get(
        "/api/company/settings",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.getCompanySettings
    );

    app.put(
        "/api/company/settings",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.updateCompanySettings
    );
};
