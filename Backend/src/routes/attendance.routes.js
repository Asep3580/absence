const { authJwt } = require("../middleware");
const controller = require("../controllers/attendance.controller");
const upload = require("../middleware/upload");

module.exports = function(app) {
  // User check-in (selfie is optional — only sent when face-verify modal is active)
  app.post(
    "/api/attendance/checkin",
    [authJwt.verifyToken, upload.single('selfie')],
    controller.checkIn
  );

  // User check-out
  app.post(
    "/api/attendance/checkout",
    [authJwt.verifyToken],
    controller.checkOut
  );

  // Get user's own attendance history
  app.get(
    "/api/attendance/history",
    [authJwt.verifyToken],
    controller.getAttendanceHistory
  );

  // Admin: Get attendance records for the company by date
  app.get(
    "/api/admin/attendance",
    [authJwt.verifyToken, authJwt.isAdmin], // Assuming isAdmin middleware exists
    controller.getCompanyAttendanceByDate
  );

  // Admin: Get all attendance records
  app.get(
    "/api/attendance/all",
    [authJwt.verifyToken, authJwt.isSuperAdmin],
    controller.getAllAttendance
  );
};
