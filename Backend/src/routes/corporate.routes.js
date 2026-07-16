const { authJwt } = require("../middleware");
const controller = require("../controllers/corporate.controller");

module.exports = function(app) {
    const superAdminAccess    = [authJwt.verifyToken, authJwt.isSuperAdmin];
    const corporateAdminAccess = [authJwt.verifyToken, authJwt.isCorporateAdmin];

    // ── SaaS Super Admin: manage corporates ──────────────────────────
    app.get("/api/saas/corporates", superAdminAccess, controller.getAllCorporates);
    app.post("/api/saas/corporates", superAdminAccess, controller.createCorporate);
    app.get("/api/saas/corporates/:id", superAdminAccess, controller.getCorporateById);
    app.put("/api/saas/corporates/:id", superAdminAccess, controller.updateCorporate);
    app.delete("/api/saas/corporates/:id", superAdminAccess, controller.deleteCorporate);

    // Assign / unassign a company (hotel) to a corporate
    app.put("/api/saas/companies/:companyId/assign-corporate", superAdminAccess, controller.assignCompanyToCorporate);

    // ── Corporate Admin: portal endpoints ────────────────────────────
    app.get("/api/corporate/overview",  corporateAdminAccess, controller.getCorporateOverview);
    app.get("/api/corporate/companies", corporateAdminAccess, controller.getCorporateCompanies);
    app.get("/api/corporate/employees", corporateAdminAccess, controller.getCorporateEmployees);

    // Phase 2 — Laporan & monitoring
    app.get("/api/corporate/attendance",          corporateAdminAccess, controller.getCorporateAttendanceByDate);
    app.get("/api/corporate/reports/attendance",  corporateAdminAccess, controller.getCorporateAttendanceReport);
    app.get("/api/corporate/reports/leave",       corporateAdminAccess, controller.getCorporateLeaveReport);
    app.get("/api/corporate/requests",            corporateAdminAccess, controller.getCorporateRequests);

    // Phase 3 — Multi-hotel employee assignments
    app.get("/api/corporate/employees/:userId/assignments",              corporateAdminAccess, controller.getEmployeeAssignments);
    app.post("/api/corporate/employees/:userId/assignments",             corporateAdminAccess, controller.addEmployeeAssignment);
    app.delete("/api/corporate/employees/:userId/assignments/:companyId", corporateAdminAccess, controller.removeEmployeeAssignment);
    app.put("/api/corporate/employees/:userId/active-company",           corporateAdminAccess, controller.setActiveCompany);
};
