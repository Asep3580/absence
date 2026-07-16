const { authJwt } = require("../middleware");
const upload = require("../middleware/upload");
const controller = require("../controllers/request.controller");

module.exports = function(app) {
    // Leave / overtime request (supports file attachment)
    app.post(
        "/api/requests",
        [authJwt.verifyToken, upload.single('attachment')],
        controller.createLeaveRequest
    );

    // Change schedule request (multi-level approval)
    app.post("/api/requests/change-schedule", [authJwt.verifyToken], controller.createChangeScheduleRequest);

    // Get the current user's own request history
    app.get("/api/user/my-requests", [authJwt.verifyToken], controller.getUserRequests);

    // Get change_schedule requests pending the current user's level-1 (supervisor) approval
    app.get("/api/user/pending-approvals", [authJwt.verifyToken], controller.getPendingApprovals);

    // Supervisor approves or rejects at level-1
    app.put("/api/requests/:id/level1-action", [authJwt.verifyToken], controller.processLevel1Action);
};