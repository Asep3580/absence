const { authJwt } = require("../middleware");
const controller = require("../controllers/user.controller");
const adminController = require("../controllers/admin.controller");
const upload = require("../middleware/upload");

module.exports = function(app) {
  app.get("/api/test/all", controller.allAccess);

  app.get(
    "/api/test/user",
    [authJwt.verifyToken],
    controller.userBoard
  );

  app.get(
    "/api/users/me",
    [authJwt.verifyToken],
    controller.getMe
  );

  app.put(
    "/api/users/me/profile",
    [authJwt.verifyToken, upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'face_photo', maxCount: 1 }])],
    controller.updateMyProfile
  );

  // Route baru untuk mengambil jadwal kerja pengguna yang sedang login
  // Dilindungi oleh middleware verifyToken untuk memastikan hanya pengguna terotentikasi yang bisa akses
  app.get(
    "/api/user/schedule",
    [authJwt.verifyToken],
    controller.getUserSchedule
  );

  // Route baru untuk mengambil jadwal kerja hari ini
  app.get(
    "/api/user/schedule/today",
    [authJwt.verifyToken],
    controller.getTodaySchedule
  );

  // Route baru untuk mengambil tipe absensi yang bisa diajukan oleh pengguna (misal: cuti, sakit)
  app.get(
    "/api/user/absence-types",
    [authJwt.verifyToken],
    controller.getAbsenceTypesForUser
  );

  // Route baru untuk mengambil sisa cuti tahunan pengguna
  app.get(
    "/api/user/leave-balance",
    [authJwt.verifyToken],
    controller.getLeaveBalance
  );

  // Route for any authenticated user to get their company's work schedules
  app.get(
    "/api/user/work-schedules",
    [authJwt.verifyToken],
    adminController.getWorkSchedulesForCompany
  );

  // Route for any authenticated user to get a list of their colleagues
  app.get(
    "/api/user/colleagues",
    [authJwt.verifyToken],
    adminController.getColleaguesForUser
  );

  // Route for user's attendance KPI
  app.get(
    "/api/user/attendance-kpi",
    [authJwt.verifyToken],
    controller.getAttendanceKpi
  );

  // Route for user to get their company's office location (for geofencing check on frontend)
  app.get(
    "/api/user/office-location",
    [authJwt.verifyToken],
    adminController.getCompanyLocation
  );

  app.get(
    "/api/test/admin",
    [authJwt.verifyToken, authJwt.isSuperAdmin],
    controller.adminBoard
  );

  app.get(
    "/api/users",
    [authJwt.verifyToken, authJwt.isSuperAdmin],
    controller.getAllUsers
  );
};
