const { authJwt } = require("../middleware");
const controller = require("../controllers/saas.controller");
const upload = require("../middleware/upload");

module.exports = function(app) {
    // Definisikan middleware untuk akses superadmin sekali saja untuk konsistensi
    const superAdminAccess = [authJwt.verifyToken, authJwt.isSuperAdmin];

    // Endpoint untuk statistik dashboard SaaS Admin
    app.get(
        "/api/saas/dashboard-stats",
        superAdminAccess,
        controller.getDashboardStats
    );

    // Endpoint for company growth chart data
    app.get(
        "/api/saas/company-growth",
        superAdminAccess,
        controller.getCompanyGrowthStats
    );

    // Endpoint for recent companies list
    app.get(
        "/api/saas/recent-companies",
        superAdminAccess,
        controller.getRecentCompanies
    );

    // Endpoint for monthly revenue trend chart
    app.get(
        "/api/saas/monthly-revenue",
        superAdminAccess,
        controller.getMonthlyRevenue
    );

    // Endpoint untuk mendapatkan semua perusahaan dan membuat perusahaan baru
    app.get(
        "/api/saas/companies",
        superAdminAccess,
        controller.getAllCompanies
    );
    app.post(
        "/api/saas/companies",
        superAdminAccess,
        controller.createCompanyAndAdmin
    );

    // Companies not yet in any corporate — MUST be before /:id to avoid conflict
    app.get(
        "/api/saas/companies/unassigned",
        superAdminAccess,
        require("../controllers/corporate.controller").getUnassignedCompanies
    );

    // Endpoint untuk mendapatkan detail satu perusahaan
    app.get(
        "/api/saas/companies/:id",
        superAdminAccess,
        controller.getCompanyById
    );

    // Endpoint untuk mengupdate detail perusahaan
    app.put(
        "/api/saas/companies/:id",
        superAdminAccess,
        controller.updateCompany
    );

    // Endpoint untuk menghapus perusahaan
    app.delete(
        "/api/saas/companies/:id",
        superAdminAccess,
        controller.deleteCompany
    );

    // Endpoint for billing/invoices
    app.get(
        "/api/saas/invoices",
        superAdminAccess,
        controller.getAllInvoices
    );

    // Endpoint for a single invoice
    app.get(
        "/api/saas/invoices/:id",
        superAdminAccess,
        controller.getInvoiceById
    );

    // Endpoint to create a manual invoice
    app.post(
        "/api/saas/invoices",
        superAdminAccess,
        controller.createManualInvoice
    );

    // Endpoint to update an invoice
    app.put(
        "/api/saas/invoices/:id",
        superAdminAccess,
        controller.updateInvoice
    );

    // Endpoint to delete an invoice
    app.delete(
        "/api/saas/invoices/:id",
        superAdminAccess,
        controller.deleteInvoice
    );

    // Endpoint to re-open a paid invoice
    app.put(
        "/api/saas/invoices/:id/reopen",
        superAdminAccess,
        controller.reopenInvoice
    );

    // Endpoint for invoice HTML preview
    app.get(
        "/api/saas/invoices/:id/preview",
        superAdminAccess,
        controller.previewInvoice
    );

    // Endpoint to download an invoice as PDF
    app.get(
        "/api/saas/invoices/:id/download",
        superAdminAccess,
        controller.downloadInvoiceAsPdf
    );

    // Endpoint to mark an invoice as paid
    app.put(
        "/api/saas/invoices/:id/mark-as-paid",
        superAdminAccess,
        controller.markInvoiceAsPaid
    );

    // Endpoint for SaaS settings
    app.get(
        "/api/saas/settings",
        superAdminAccess,
        controller.getSaaSSettings
    );

    app.put(
        "/api/saas/settings",
        [...superAdminAccess, upload.single('saas_company_logo')],
        controller.updateSaaSSettings
    );

    // Endpoints for SaaS User Management (superadmins managing other admins/superadmins)
    app.get(
        "/api/saas/users",
        superAdminAccess,
        controller.getAllSaaSUsers
    );

    app.post(
        "/api/saas/users",
        superAdminAccess,
        controller.createSaaSUser
    );

    app.get(
        "/api/saas/users/:id",
        superAdminAccess,
        controller.getSaaSUserById
    );

    app.put(
        "/api/saas/users/:id",
        superAdminAccess,
        controller.updateSaaSUser
    );

    app.delete(
        "/api/saas/users/:id",
        superAdminAccess,
        controller.deleteSaaSUser
    );
};