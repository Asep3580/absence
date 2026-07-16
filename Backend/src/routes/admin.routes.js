const { authJwt } = require("../middleware");
const adminController = require("../controllers/admin.controller");
const userAdminController = require("../controllers/user.admin.controller");

module.exports = function(app) {
    // Middleware untuk memastikan hanya admin perusahaan yang bisa akses
    const adminAccess = [authJwt.verifyToken, authJwt.isAdmin];

    // Dashboard and company info
    app.get("/api/admin/companies/me", adminAccess, adminController.getCompanyDetails);
    app.get("/api/admin/dashboard-stats", adminAccess, adminController.getDashboardStats);
    app.get("/api/admin/weekly-attendance", adminAccess, adminController.getWeeklyAttendance);
    app.get("/api/admin/gender-distribution", adminAccess, adminController.getGenderDistribution);

    // Company Settings
    app.get("/api/admin/company/location", adminAccess, adminController.getCompanyLocation);
    app.put("/api/admin/company/location", adminAccess, adminController.updateCompanyLocation);
    app.get("/api/admin/recent-requests", adminAccess, adminController.getRecentRequests);

    // Report Generation
    app.get("/api/admin/reports/attendance", adminAccess, adminController.getAttendanceReport);
    app.get("/api/admin/reports/attendance/:userId/log", adminAccess, adminController.getEmployeeAttendanceLog);
    app.get("/api/admin/reports/leave", adminAccess, adminController.getLeaveReport);

    // --- Employee/User Management Routes ---
    // GET all users (paginated for employees page, or simple list for user management)
    app.get("/api/admin/users", adminAccess, userAdminController.getAll);

    // GET a single user by ID
    app.get("/api/admin/users/:id", adminAccess, userAdminController.getById);
    app.get("/api/admin/employees/:userId/extra-details", adminAccess, adminController.getEmployeeExtraDetails);

    // POST to create a new user/employee
    app.post("/api/admin/users", adminAccess, userAdminController.create);

    // POST to bulk import employees from parsed Excel data
    app.post("/api/admin/users/bulk-import", adminAccess, userAdminController.bulkImport);

    // PUT to update a user's core details (role, etc.) - used by user management
    app.put("/api/admin/users/:id", adminAccess, userAdminController.update);

    // PUT to deactivate/reactivate a user
    app.put("/api/admin/users/:id/deactivate", adminAccess, userAdminController.deactivate);
    app.put("/api/admin/users/:id/reactivate", adminAccess, userAdminController.reactivate);

    // DELETE a user
    app.delete("/api/admin/users/:id", adminAccess, userAdminController.delete);

    // --- Request Management Routes ---
    app.get("/api/admin/requests", adminAccess, adminController.getAllRequests);
    app.put("/api/admin/requests/:requestId/status", adminAccess, adminController.updateRequestStatus);
    app.delete("/api/admin/requests/:requestId", adminAccess, adminController.deleteRequest);
    
    /**
     * Endpoint untuk memperbarui profil karyawan, termasuk data personal,
     * pekerjaan, dan tanggal kontrak baru.
     */
    app.put(
        "/api/admin/employees/:userId/profile",
        adminAccess,
        adminController.updateEmployeeProfile
    );

    app.put(
        "/api/admin/employees/:userId/leave-adjustment",
        adminAccess,
        adminController.updateLeaveAdjustment
    );

    // Catatan: Endpoint lain yang ada di admin.js seperti:
    // - /admin/attendance
    // - /admin/schedule-assignments
    // Sebaiknya juga dipindahkan dan didefinisikan di sini untuk kerapian.
};