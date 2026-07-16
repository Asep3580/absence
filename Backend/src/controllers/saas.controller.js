const db = require("../db");
const bcrypt = require("bcryptjs");
const fs = require('fs').promises;
const path = require('path');


// Helper to format date string to YYYY-MM-DD or return null, handling invalid dates.
const formatDate = (date) => {
    if (!date || date === '') return null; // Handles null, undefined, ''
    try {
        return new Date(date).toISOString().split('T')[0];
    } catch (e) {
        return null; // Return null if date is invalid
    }
};

// GET /api/saas/dashboard-stats
exports.getDashboardStats = async (req, res) => {
  try {
    const statsQuery = `
      SELECT
        (SELECT COUNT(*)::int FROM companies WHERE subscription_status = 'active') AS "totalCompanies",
        (SELECT COALESCE(SUM(amount), 0)::float8 FROM invoices WHERE status IN ('due', 'overdue', 'paid')) AS "totalRevenue",
        (SELECT COUNT(*)::int FROM users WHERE company_id IS NOT NULL AND is_active = TRUE AND role = 'user') AS "totalEmployees",
        (SELECT COUNT(*)::int FROM invoices WHERE status IN ('due', 'overdue')) AS "totalUnpaidBilling"
    `;
    const result = await db.query(statsQuery);

    const stats = {
      totalCompanies: result.rows[0]?.totalCompanies || 0,
      totalRevenue: result.rows[0]?.totalRevenue || 0,
      totalEmployees: result.rows[0]?.totalEmployees || 0,
      totalUnpaidBilling: result.rows[0]?.totalUnpaidBilling || 0,
    };

    res.status(200).send(stats);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).send({ message: error.message });
  }
};

// GET /api/saas/companies
exports.getAllCompanies = async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const search = req.query.search || '';
  const sortBy = req.query.sortBy || 'created_at';
  const sortOrder = req.query.sortOrder || 'desc';
  const offset = (page - 1) * limit;

  // Whitelist columns to prevent SQL injection
  const allowedSortColumns = {
      'name': 'c.name',
      'created_at': 'c.created_at'
  };
  const sortColumn = allowedSortColumns[sortBy] || 'c.created_at';
  const orderDirection = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  try {
    let whereClause = '';
    const queryParams = [];
    let paramIndex = 1;

    if (search) {
      // Use an EXISTS subquery for robust searching by admin email
      whereClause = `
        WHERE c.name ILIKE $${paramIndex} OR EXISTS (
          SELECT 1 FROM users u 
          WHERE u.company_id = c.id AND u.role = 'admin' AND u.email ILIKE $${paramIndex}
        )
      `;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const dataSql = `
      SELECT
        c.id,
        c.name,
        c.address,
        c.whatsapp,
        c.subscription_start_date AS "subscriptionStartDate",
        c.subscription_end_date AS "subscriptionEndDate",
        COALESCE(c.price_per_employee, 0) AS "pricePerEmployee",
        COALESCE(c.max_employees, 0) AS "maxEmployees",
        c.created_at AS "createdAt",
        (
            SELECT u.email
            FROM users u
            WHERE u.company_id = c.id AND u.role = 'admin'
            ORDER BY u.created_at DESC
            LIMIT 1
        ) AS "adminEmail",
        (SELECT COUNT(*)::int FROM users u WHERE u.company_id = c.id AND u.role = 'user' AND u.is_active = TRUE) AS "employeeCount",
        COUNT(*) OVER()::int as "totalItems"
      FROM companies c
      ${whereClause}
      ORDER BY ${sortColumn} ${orderDirection}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const queryValues = [...queryParams, limit, offset];
    const dataResult = await db.query(dataSql, queryValues);

    const rows = dataResult.rows;
    const totalItems = rows.length > 0 ? rows[0].totalItems : 0;
    const totalPages = Math.ceil(totalItems / limit);
    
    // The "totalItems" column is not needed in the final output for each row.
    const companies = rows.map(({ totalItems, ...rest }) => rest);

    res.status(200).send({
      data: companies,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        limit
      }
    });
  } catch (error) {
    console.error('Error in getAllCompanies:', error);
    res.status(500).send({ message: error.message });
  }
};

// GET /api/saas/company-growth
exports.getCompanyGrowthStats = async (req, res) => {
    try {
        const currentYear  = new Date().getFullYear();
        const previousYear = currentYear - 1;

        const sql = `
            SELECT
                EXTRACT(YEAR  FROM created_at)::int AS year,
                EXTRACT(MONTH FROM created_at)::int AS month,
                COUNT(*)::int                        AS count
            FROM companies
            WHERE EXTRACT(YEAR FROM created_at) IN ($1, $2)
            GROUP BY year, month
            ORDER BY year, month
        `;
        const result = await db.query(sql, [currentYear, previousYear]);

        const currentData  = new Array(12).fill(0);
        const previousData = new Array(12).fill(0);

        for (const row of result.rows) {
            const idx = row.month - 1;
            if (row.year === currentYear)  currentData[idx]  = row.count;
            if (row.year === previousYear) previousData[idx] = row.count;
        }

        res.status(200).send({
            labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
            currentYear:   currentYear,
            previousYear:  previousYear,
            currentData:   currentData,
            previousData:  previousData,
        });
    } catch (error) {
        console.error('Error in getCompanyGrowthStats:', error);
        res.status(500).send({ message: error.message });
    }
};

// GET /api/saas/monthly-revenue
exports.getMonthlyRevenue = async (req, res) => {
    try {
        const currentYear  = new Date().getFullYear();
        const previousYear = currentYear - 1;

        const sql = `
            SELECT
                EXTRACT(YEAR  FROM created_at)::int AS year,
                EXTRACT(MONTH FROM created_at)::int AS month,
                COALESCE(SUM(amount), 0)::float8     AS revenue
            FROM invoices
            WHERE status IN ('due', 'overdue', 'paid')
              AND EXTRACT(YEAR FROM created_at) IN ($1, $2)
            GROUP BY year, month
            ORDER BY year, month
        `;
        const result = await db.query(sql, [currentYear, previousYear]);

        // Build two 12-element arrays, index 0 = January
        const currentData  = new Array(12).fill(0);
        const previousData = new Array(12).fill(0);

        for (const row of result.rows) {
            const idx = row.month - 1; // 0-based
            if (row.year === currentYear)  currentData[idx]  = row.revenue;
            if (row.year === previousYear) previousData[idx] = row.revenue;
        }

        res.status(200).send({
            labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
            currentYear:   currentYear,
            previousYear:  previousYear,
            currentData:   currentData,
            previousData:  previousData,
        });
    } catch (error) {
        console.error('Error in getMonthlyRevenue:', error);
        res.status(500).send({ message: error.message });
    }
};

// GET /api/saas/recent-companies
exports.getRecentCompanies = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 5;
        const sql = `
            SELECT 
                c.id, 
                c.name, 
                c.created_at AS "createdAt",
                (
                    SELECT u.email 
                    FROM users u 
                    WHERE u.company_id = c.id AND u.role = 'admin' 
                    ORDER BY u.created_at DESC 
                    LIMIT 1
                ) as "adminEmail"
            FROM companies c
            ORDER BY c.created_at DESC
            LIMIT $1
        `;
        const result = await db.query(sql, [limit]);
        res.status(200).send(result.rows);
    } catch (error) {
        console.error('Error in getRecentCompanies:', error);
        res.status(500).send({ message: error.message });
    }
};

// GET /api/saas/companies/:id
exports.getCompanyById = async (req, res) => {
  const { id } = req.params;
  try {
    const companySql = `SELECT id, name, address, whatsapp, subscription_start_date AS "subscriptionStartDate", subscription_end_date AS "subscriptionEndDate", COALESCE(price_per_employee, 0) AS "pricePerEmployee", COALESCE(max_employees, 0) AS "maxEmployees", office_latitude AS "officeLatitude", office_longitude AS "officeLongitude", office_radius AS "officeRadius" FROM companies WHERE id = $1`;
    const companyResult = await db.query(companySql, [id]);

    if (companyResult.rows.length === 0) {
      return res.status(404).send({ message: "Company not found." });
    }
    const company = companyResult.rows[0];

    const adminSql = `SELECT id, username, email FROM users WHERE company_id = $1 AND role = 'admin' LIMIT 1`;
    const adminResult = await db.query(adminSql, [id]);
    const admin = adminResult.rows[0] || {};

    res.status(200).send({
      id: company.id,
      name: company.name,
      address: company.address,
      whatsapp: company.whatsapp,
      subscriptionStartDate: company.subscriptionStartDate,
      subscriptionEndDate: company.subscriptionEndDate,
      pricePerEmployee: company.pricePerEmployee,
      maxEmployees: company.maxEmployees,
      officeLatitude: company.officeLatitude,
      officeLongitude: company.officeLongitude,
      officeRadius: company.officeRadius,
      adminId: admin.id,
      adminUsername: admin.username,
      adminEmail: admin.email,
    });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

// POST /api/saas/companies
// Create company + admin user (role='admin')
exports.createCompanyAndAdmin = async (req, res) => {
  const { companyName, companyAddress, companyWhatsapp, subscriptionStartDate, subscriptionEndDate, pricePerEmployee, maxEmployees, officeLatitude, officeLongitude, officeRadius, adminUsername, adminEmail, adminPassword } = req.body;

  if (!companyName || !adminUsername || !adminEmail || !adminPassword) {
    return res.status(400).send({ message: "Semua field wajib diisi." });
  }

  // NOTE: current db layer exposes only pool.query; we can still use a single transaction via BEGIN/COMMIT.
  const passwordHash = bcrypt.hashSync(adminPassword, 8);

  try {
    await db.query("BEGIN");

    const companyRes = await db.query(
      "INSERT INTO companies (name, address, whatsapp, subscription_start_date, subscription_end_date, price_per_employee, max_employees, office_latitude, office_longitude, office_radius) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, name, address",
      [companyName, companyAddress, companyWhatsapp, formatDate(subscriptionStartDate), formatDate(subscriptionEndDate), pricePerEmployee || 0, maxEmployees || 10, officeLatitude || null, officeLongitude || null, officeRadius || null]
    );
    const companyId = companyRes.rows[0].id;

    // Ensure roles row exists for this company (optional but aligned with init.sql structure)
    // Insert admin role and user role if missing.
    await db.query(
      "INSERT INTO roles (company_id, name, permissions) VALUES ($1, 'admin', $2::jsonb) ON CONFLICT (company_id, name) DO NOTHING",
      [companyId, '["view_dashboard","view_settings","manage_users","manage_roles","manage_positions","manage_departments","manage_work_schedules"]']
    );
    await db.query(
      "INSERT INTO roles (company_id, name, permissions) VALUES ($1, 'user', $2::jsonb) ON CONFLICT (company_id, name) DO NOTHING",
      [companyId, '["view_dashboard"]']
    );

    const userRes = await db.query(
      "INSERT INTO users (company_id, username, email, password, role) VALUES ($1, $2, $3, $4, 'admin') RETURNING id",
      [companyId, adminUsername, adminEmail, passwordHash]
    );

    // --- LOGIKA BARU: Buat tagihan pertama secara otomatis ---
    const firstInvoiceAmount = (parseInt(pricePerEmployee, 10) || 0) * (parseInt(maxEmployees, 10) || 10);
    if (firstInvoiceAmount > 0) {
        const description = `SaaS Subscription for ${companyName} (up to ${maxEmployees} users)`;
        await db.query(
            `INSERT INTO invoices (company_id, amount, description, due_date, status) 
             VALUES ($1, $2, $3, NOW() + interval '14 days', 'due')`,
            [companyId, firstInvoiceAmount, description]
        );
    }
    // --- AKHIR LOGIKA BARU ---

    await db.query("COMMIT");
    res.status(201).send({ message: "Perusahaan dan admin berhasil dibuat!" });
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch (_) {}
    if (error.code === '23505') { // unique_violation for email
        return res.status(409).send({ message: "Email admin sudah digunakan oleh pengguna lain." });
    }
    res.status(500).send({ message: error.message || "Terjadi kesalahan saat membuat perusahaan." });
  }
};

// PUT /api/saas/companies/:id
exports.updateCompany = async (req, res) => {
  const { id } = req.params;
  // The admin's email is a fixed identifier and should not be updated from this form.
  const { companyName, companyAddress, companyWhatsapp, subscriptionStartDate, subscriptionEndDate, pricePerEmployee, maxEmployees, officeLatitude, officeLongitude, officeRadius, adminId, adminUsername, adminEmail, adminPassword } = req.body;

  if (!companyName || !adminUsername || !adminEmail || !adminId) {
    return res.status(400).send({ message: "Nama perusahaan, username admin, email admin, dan ID admin wajib diisi." });
  }

  try {
    await db.query("BEGIN");

    // 1. Update detail perusahaan
    const companyResult = await db.query(
      "UPDATE companies SET name = $1, address = $2, whatsapp = $3, subscription_start_date = $4, subscription_end_date = $5, price_per_employee = $6, max_employees = $7, office_latitude = $8, office_longitude = $9, office_radius = $10 WHERE id = $11 RETURNING id",
      [companyName, companyAddress, companyWhatsapp, formatDate(subscriptionStartDate), formatDate(subscriptionEndDate), pricePerEmployee || 0, maxEmployees || 10, officeLatitude || null, officeLongitude || null, officeRadius || null, id]
    );

    if (companyResult.rowCount === 0) {
      throw new Error("Perusahaan tidak ditemukan.");
    }

    // 2. Update detail user admin
    let userQuery;
    let userValues;
    if (adminPassword) {
      const passwordHash = bcrypt.hashSync(adminPassword, 8);
      userQuery = "UPDATE users SET username = $1, password = $2 WHERE id = $3 AND company_id = $4";
      userValues = [adminUsername, passwordHash, adminId, id];
    } else {
      userQuery = "UPDATE users SET username = $1 WHERE id = $2 AND company_id = $3";
      userValues = [adminUsername, adminId, id];
    }

    const userResult = await db.query(userQuery, userValues);

    if (userResult.rowCount === 0) {
      throw new Error("User admin untuk perusahaan ini tidak ditemukan atau ID admin salah.");
    }

    await db.query("COMMIT");
    res.status(200).send({ message: "Detail perusahaan dan admin berhasil diperbarui." });

  } catch (error) {
    await db.query("ROLLBACK");
    // Since email is not updated, a unique constraint violation on email is not expected.
    // However, a username conflict could still occur.
    if (error.code === '23505') { // unique constraint violation
        return res.status(409).send({ message: "Username is already in use by another user." });
    }
    res.status(500).send({ message: error.message });
  }
};

// DELETE /api/saas/companies/:id
exports.deleteCompany = async (req, res) => {
  const { id } = req.params;

  try {
    await db.query("BEGIN");

    // For data integrity, it's good practice to delete related records first.
    // Here, we delete users associated with the company.
    await db.query("DELETE FROM users WHERE company_id = $1", [id]);

    // Then, delete the company itself.
    const result = await db.query("DELETE FROM companies WHERE id = $1", [id]);

    if (result.rowCount === 0) {
      throw new Error("Company not found or already deleted.");
    }

    await db.query("COMMIT");
    res.status(204).send(); // 204 No Content is standard for a successful DELETE
  } catch (error) {
    await db.query("ROLLBACK");
    res.status(500).send({ message: error.message });
  }
};

// --- Billing / Invoice Management ---

// GET /api/saas/invoices
exports.getAllInvoices = async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const search = req.query.search || '';
  const sortBy = req.query.sortBy || 'created_at';
  const status = req.query.status || 'new'; // 'new', 'paid', or 'all'
  const sortOrder = req.query.sortOrder || 'desc';
  const offset = (page - 1) * limit;

  // Whitelist columns to prevent SQL injection
  const allowedSortColumns = {
      'id': `'INV-' || TO_CHAR(i.created_at, 'YYYY-') || LPAD(i.id::text, 3, '0')`,
      'companyName': 'c.name',
      'amount': 'i.amount',
      'dueDate': 'i.due_date',
      'status': 'i.status',
      'created_at': 'i.created_at'
  };
  const sortColumn = allowedSortColumns[sortBy] || 'i.created_at';
  const orderDirection = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  try {
    const whereClauses = [];
    const queryParams = [];
    let paramIndex = 1;

    if (search) {
      // Search on company name or the constructed invoice ID
      whereClauses.push(`(c.name ILIKE $${paramIndex} OR ('INV-' || TO_CHAR(i.created_at, 'YYYY-') || LPAD(i.id::text, 3, '0')) ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (status === 'new') {
        whereClauses.push(`i.status IN ('due', 'overdue', 'draft')`);
    } else if (status === 'paid') {
        whereClauses.push(`i.status = 'paid'`);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const dataSql = `
      SELECT
        'INV-' || TO_CHAR(i.created_at, 'YYYY-') || LPAD(i.id::text, 3, '0') AS id,
        i.id AS "invoicePk",
        c.name AS "companyName",
        i.amount,
        i.due_date AS "dueDate",
        i.status,
        i.created_at AS "createdAt",
        COUNT(*) OVER()::int as "totalItems"
      FROM invoices i
      JOIN companies c ON i.company_id = c.id
      ${whereClause}
      ORDER BY ${sortColumn} ${orderDirection}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const queryValues = [...queryParams, limit, offset];
    const dataResult = await db.query(dataSql, queryValues);

    const rows = dataResult.rows;
    const totalItems = rows.length > 0 ? rows[0].totalItems : 0;
    const totalPages = Math.ceil(totalItems / limit);
    
    const invoices = rows.map(({ totalItems, ...rest }) => rest);

    res.status(200).send({ data: invoices, pagination: { currentPage: page, totalPages, totalItems, limit } });
  } catch (error) {
    if (error.code === '42P01') { // undefined_table
        console.warn("Warning: 'invoices' table does not exist. Returning empty array for billing.");
        return res.status(200).send({ data: [], pagination: { currentPage: 1, totalPages: 0, totalItems: 0, limit } });
    }
    console.error('Error in getAllInvoices:', error);
    res.status(500).send({ message: error.message });
  }
};

// GET /api/saas/invoices/:id
exports.getInvoiceById = async (req, res) => {
  const { id } = req.params;

  try {
    const sql = `
      SELECT
        'INV-' || TO_CHAR(i.created_at, 'YYYY-') || LPAD(i.id::text, 3, '0') AS id,
        i.id AS "invoicePk",
        i.amount,
        i.description,
        i.due_date AS "dueDate",
        i.status,
        i.created_at AS "createdAt",
        i.updated_at AS "updatedAt",
        c.id AS "companyId",
        c.name AS "companyName",
        c.address AS "companyAddress",
        (
            SELECT u.email
            FROM users u
            WHERE u.company_id = c.id AND u.role = 'admin'
            ORDER BY u.created_at DESC
            LIMIT 1
        ) AS "companyAdminEmail"
      FROM invoices i
      JOIN companies c ON i.company_id = c.id
      WHERE i.id = $1
    `;
    const result = await db.query(sql, [id]);

    if (result.rows.length === 0) {
      return res.status(404).send({ message: "Invoice not found." });
    }

    const invoice = result.rows[0];

    // Construct an 'items' array for frontend form compatibility.
    // We reconstruct a single item from the stored total amount and description.
    invoice.items = [{
        description: invoice.description || 'SaaS Subscription',
        quantity: 1,
        unit_price: invoice.amount,
    }];
    const companyDetails = await db.query(
        `SELECT price_per_employee, max_employees 
         FROM companies WHERE id = $1`,
        [result.rows[0].companyId]
    );
    
    const { price_per_employee, max_employees } = companyDetails.rows[0];

    res.status(200).send(invoice);
  } catch (error) {
    console.error('Error in getInvoiceById:', error);
    res.status(500).send({ message: error.message });
  }
};

// POST /api/saas/invoices
exports.createManualInvoice = async (req, res) => {
  const { company_id, items, due_date, status } = req.body;

  if (!company_id || !items || !Array.isArray(items) || items.length === 0 || !due_date || !status) {
    return res.status(400).send({ message: "All fields are required, and items must be a non-empty array." });
  }

  if (!['due', 'draft'].includes(status)) {
      return res.status(400).send({ message: "Invalid status. Must be 'due' or 'draft'." });
  }

  // For now, we only handle the first item from the form.
  const firstItem = items[0];
  const description = firstItem.description;
  // The 'amount' stored in the DB is the subtotal, calculated from the item.
  const amount = (parseFloat(firstItem.quantity) || 0) * (parseFloat(firstItem.unit_price) || 0);

  if (!description || amount < 0) {
      return res.status(400).send({ message: "Invalid item data. Description and non-negative amount are required." });
  }

  try {
    const sql = `
      INSERT INTO invoices (company_id, amount, description, due_date, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await db.query(sql, [company_id, amount, description, due_date, status]);
    res.status(201).send(result.rows[0]);
  } catch (error) {
    // Check for foreign key violation if company_id is invalid
    if (error.code === '23503') {
        return res.status(404).send({ message: `Company with ID ${company_id} not found.` });
    }
    console.error('Error creating manual invoice:', error);
    res.status(500).send({ message: "An error occurred while creating the invoice." });
  }
};

// PUT /api/saas/invoices/:id
exports.updateInvoice = async (req, res) => {
  const { id } = req.params;
  const { company_id, items, due_date, status } = req.body;

  if (!company_id || !items || !Array.isArray(items) || items.length === 0 || !due_date || !status) {
    return res.status(400).send({ message: "All fields are required, and items must be a non-empty array." });
  }

  if (!['due', 'draft', 'paid', 'overdue'].includes(status)) {
      return res.status(400).send({ message: "Invalid status." });
  }

  // For now, we only handle the first item from the form.
  const firstItem = items[0];
  const description = firstItem.description;
  // The 'amount' stored in the DB is the subtotal, calculated from the item.
  const amount = (parseFloat(firstItem.quantity) || 0) * (parseFloat(firstItem.unit_price) || 0);

  if (!description || amount < 0) {
      return res.status(400).send({ message: "Invalid item data. Description and non-negative amount are required." });
  }

  try {
    const sql = `
      UPDATE invoices
      SET company_id = $1, amount = $2, description = $3, due_date = $4, status = $5, updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `;
    const result = await db.query(sql, [company_id, amount, description, due_date, status, id]);
    if (result.rowCount === 0) {
      return res.status(404).send({ message: "Invoice not found." });
    }
    res.status(200).send(result.rows[0]);
  } catch (error) {
    if (error.code === '23503') {
        return res.status(404).send({ message: `Company with ID ${company_id} not found.` });
    }
    console.error('Error updating invoice:', error);
    res.status(500).send({ message: "An error occurred while updating the invoice." });
  }
};

// DELETE /api/saas/invoices/:id
exports.deleteInvoice = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query("DELETE FROM invoices WHERE id = $1", [id]);
    if (result.rowCount === 0) {
      return res.status(404).send({ message: "Invoice not found." });
    }
    res.status(204).send(); // No Content
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).send({ message: "An error occurred while deleting the invoice." });
  }
};

// PUT /api/saas/invoices/:id/reopen
exports.reopenInvoice = async (req, res) => {
  const { id } = req.params;
  try {
    const sql = `
      UPDATE invoices
      SET status = 'due', payment_date = NULL, payment_notes = NULL, updated_at = NOW()
      WHERE id = $1 AND status = 'paid'
      RETURNING *
    `;
    const result = await db.query(sql, [id]);
    if (result.rowCount === 0) {
      return res.status(404).send({ message: "Invoice not found or is not in 'paid' status." });
    }
    res.status(200).send({ message: "Invoice re-opened successfully.", invoice: result.rows[0] });
  } catch (error) {
    console.error('Error re-opening invoice:', error);
    res.status(500).send({ message: "An error occurred while re-opening the invoice." });
  }
};

// GET /api/saas/invoices/:id/preview
exports.previewInvoice = async (req, res) => {
    const { id } = req.params;

    try {
        // 1. Fetch all necessary data in parallel
        const [invoiceResult, settingsResult] = await Promise.all([
            db.query(`
                SELECT
                    'INV-' || TO_CHAR(i.created_at, 'YYYY-') || LPAD(i.id::text, 3, '0') AS id,
                    i.amount, i.description, i.due_date AS "dueDate", i.created_at AS "createdAt",
                    c.name AS "companyName", c.address AS "companyAddress",
                    (SELECT u.email FROM users u WHERE u.company_id = c.id AND u.role = 'admin' ORDER BY u.created_at DESC LIMIT 1) AS "companyAdminEmail"
                FROM invoices i
                JOIN companies c ON i.company_id = c.id
                WHERE i.id = $1
            `, [id]),
            db.query("SELECT key, value FROM saas_settings")
        ]);

        if (invoiceResult.rows.length === 0) {
            return res.status(404).send({ message: "Invoice not found." });
        }
        const invoice = invoiceResult.rows[0];
        const saasSettings = settingsResult.rows.reduce((acc, row) => {
            acc[row.key] = row.value;
            return acc;
        }, {});

        // New: Construct logo URL
        let logoUrl = null;
        if (saasSettings.saas_company_logo) {
            // Construct the full URL for the logo
            const protocol = req.protocol;
            const host = req.get('host');
            logoUrl = `${protocol}://${host}${saasSettings.saas_company_logo}`;
        }

        // 2. Prepare data for the template
        const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);
        const formatDate = (dateString) => new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

        const ppnRate = parseFloat(saasSettings.saas_tax_ppn_rate) || 0;
        const pph23Rate = parseFloat(saasSettings.saas_tax_pph23_rate) || 0;
        const subtotal = invoice.amount;
        const ppnAmount = (subtotal * ppnRate) / 100;
        const totalAmount = subtotal + ppnAmount;
        const pph23Amount = (subtotal * pph23Rate) / 100;

        // Construct items array for the template
        const items = [{
            description: invoice.description || 'SaaS Subscription',
            quantity: 1,
            unitPrice: formatCurrency(subtotal), // Format here for display
            amount: formatCurrency(subtotal)     // Format here for display
        }];

        const templateData = {
            saasCompanyLogoUrl: logoUrl,
            saasCompanyName: saasSettings.saas_company_name || 'SaaS Corp.',
            saasCompanyAddress: (saasSettings.saas_company_address || '').replace(/\n/g, '<br>'),
            saasNpwp: saasSettings.saas_npwp || '',
            invoiceId: invoice.id,
            invoiceDate: formatDate(invoice.createdAt),
            invoiceDueDate: formatDate(invoice.dueDate),
            companyName: invoice.companyName,
            companyAddress: (invoice.companyAddress || 'No address provided').replace(/\n/g, '<br>'),
            companyAdminEmail: invoice.companyAdminEmail || '',
            items: items,
            subtotal: formatCurrency(subtotal),
            ppnText: `PPN (${ppnRate}%)`,
            ppnAmount: formatCurrency(ppnAmount),
            totalAmount: formatCurrency(totalAmount),
            pph23Text: `PPh 23 (${pph23Rate}%)`,
            pph23Amount: `(${formatCurrency(pph23Amount)})`,
            showPpn: ppnRate > 0,
            showPph23: pph23Rate > 0,
            paymentInfo: saasSettings.saas_bank_account || '',
            signatureText: saasSettings.saas_invoice_signature_text || '',
            signatureName: saasSettings.saas_invoice_signature_name || '',
            showSignature: !!saasSettings.saas_invoice_signature_name,
            footerText: saasSettings.saas_invoice_footer_text || `Thank you for your business! If you have any questions, please contact support@${(saasSettings.saas_company_name || 'saascorp').toLowerCase().replace(/[^a-z0-9]/g, '')}.com`
        };

        // 3. Read and populate HTML template
        const templatePath = path.resolve(__dirname, '..', 'templates', 'invoice-template.html');
        let html = await fs.readFile(templatePath, 'utf-8');

        // Handlebars-like replacement for simple logic
        // Handle {{#each}}
        html = html.replace(/{{#each (.*?)}}([\s\S]*?){{\/each}}/g, (match, arrayKey, content) => {
            return (templateData[arrayKey.trim()] || []).map(item => content.replace(/{{this\.(.*?)}}/g, (m, prop) => item[prop.trim()] || '')).join('');
        });
        html = html.replace(/{{#if (.*?)}}([\s\S]*?){{\/if \1}}/g, (match, key, content) => templateData[key.trim()] ? content : '');
        html = html.replace(/{{(.*?)}}/g, (match, key) => templateData[key.trim()] !== undefined ? templateData[key.trim()] : '');

        // 4. Send HTML as response
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (error) {
        console.error('Error generating invoice preview:', error);
        res.status(500).send({ message: 'Failed to generate invoice preview.' });
    }
};

// GET /api/saas/invoices/:id/download — delegates to previewInvoice (PDF generated client-side)
exports.downloadInvoiceAsPdf = exports.previewInvoice;

// PUT /api/saas/invoices/:id/mark-as-paid
exports.markInvoiceAsPaid = async (req, res) => {
  const { id } = req.params;
  const { paymentDate, paymentNotes } = req.body;

  if (!paymentDate) {
    return res.status(400).send({ message: "Payment date is required." });
  }

  try {
    const sql = `
      UPDATE invoices
      SET status = 'paid', payment_date = $1, payment_notes = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;
    const result = await db.query(sql, [paymentDate, paymentNotes || null, id]);
    if (result.rowCount === 0) {
      return res.status(404).send({ message: "Invoice not found." });
    }
    res.status(200).send({ message: "Invoice marked as paid successfully.", invoice: result.rows[0] });
  } catch (error) {
    console.error('Error marking invoice as paid:', error);
    res.status(500).send({ message: "An error occurred while updating the invoice." });
  }
};

// --- SaaS Settings ---

// GET /api/saas/settings
exports.getSaaSSettings = async (req, res) => {
  try {
    const result = await db.query("SELECT key, value FROM saas_settings");
    const settings = result.rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
    res.status(200).send(settings);
  } catch (error) {
    console.error('Error fetching SaaS settings:', error);
    res.status(500).send({ message: error.message });
  }
};

// PUT /api/saas/settings
exports.updateSaaSSettings = async (req, res) => {
  const settings = req.body; // Expects an object like { saas_company_name: 'New Name' }
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    for (const key in settings) {
      if (Object.hasOwnProperty.call(settings, key)) {
        const value = settings[key];
        await client.query(
          `INSERT INTO saas_settings (key, value) VALUES ($1, $2)
           ON CONFLICT (key) DO UPDATE SET value = $2`,
          [key, value]
        );
      }
    }

    // Handle logo upload
    if (req.file) {
        const oldLogoResult = await client.query("SELECT value FROM saas_settings WHERE key = 'saas_company_logo'");
        const oldLogoPath = oldLogoResult.rows[0]?.value;
        const newLogoPath = `/uploads/${req.file.filename}`;

        await client.query(`INSERT INTO saas_settings (key, value) VALUES ('saas_company_logo', $1) ON CONFLICT (key) DO UPDATE SET value = $1`, [newLogoPath]);

        if (oldLogoPath && oldLogoPath !== newLogoPath) {
            try {
                const fullOldPath = path.join(__dirname, '..', '..', oldLogoPath);
                await fs.unlink(fullOldPath);
            } catch (unlinkError) {
                if (unlinkError.code !== 'ENOENT') console.error(`Failed to delete old logo file: ${oldLogoPath}`, unlinkError);
            }
        }
    }

    await client.query('COMMIT');
    res.status(200).send({ message: "SaaS settings updated successfully." });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating SaaS settings:', error);
    res.status(500).send({ message: error.message });
  } finally {
    client.release();
  }
};

// --- SaaS User Management Controllers ---

// GET /api/saas/users
exports.getAllSaaSUsers = async (req, res) => {
  const search = req.query.search || '';
  try {
    let whereClause = `WHERE u.role IN ('admin', 'superadmin')`;
    const queryParams = [];

    if (search) {
      whereClause += ` AND (u.username ILIKE $1 OR u.email ILIKE $1)`;
      queryParams.push(`%${search}%`);
    }

    const sql = `
      SELECT 
        u.id, 
        u.username, 
        u.email, 
        u.role, 
        u.created_at AS "createdAt", 
        u.company_id AS "companyId", 
        c.name AS "companyName" 
      FROM users u 
      LEFT JOIN companies c ON u.company_id = c.id 
      ${whereClause}
      ORDER BY u.created_at DESC
    `;

    const result = await db.query(sql, queryParams);
    res.status(200).send(result.rows);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

// GET /api/saas/users/:id
exports.getSaaSUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const sql = `SELECT id, username, email, role, company_id as "companyId" FROM users WHERE id = $1 AND role IN ('admin', 'superadmin')`;
    const result = await db.query(sql, [id]);
    if (result.rows.length === 0) {
      return res.status(404).send({ message: "User not found or is not an admin/superadmin." });
    }
    res.status(200).send(result.rows[0]);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

// POST /api/saas/users
exports.createSaaSUser = async (req, res) => {
  const { username, email, password, role, companyId } = req.body;

  if (!username || !email || !password || !role) {
    return res.status(400).send({ message: "Username, email, password, and role are required." });
  }
  if (role === 'admin' && !companyId) {
    return res.status(400).send({ message: "An 'admin' role must be assigned to a company." });
  }
  if (!['admin', 'superadmin'].includes(role)) {
    return res.status(400).send({ message: "Role must be 'admin' or 'superadmin'." });
  }

  const passwordHash = bcrypt.hashSync(password, 8);
  const userCompanyId = role === 'superadmin' ? null : companyId;

  try {
    const sql = `INSERT INTO users (username, email, password, role, company_id) VALUES ($1, $2, $3, $4, $5) RETURNING id`;
    await db.query(sql, [username, email, passwordHash, role, userCompanyId]);
    res.status(201).send({ message: "User created successfully." });
  } catch (error) {
    if (error.code === '23505') { // unique_violation
      return res.status(409).send({ message: "Email or username is already in use." });
    }
    res.status(500).send({ message: error.message });
  }
};

// PUT /api/saas/users/:id
exports.updateSaaSUser = async (req, res) => {
  const { id } = req.params;
  const { username, email, password, role, companyId } = req.body;

  if (!username || !email || !role) {
    return res.status(400).send({ message: "Username, email, and role are required." });
  }
  if (role === 'admin' && !companyId) {
    return res.status(400).send({ message: "An 'admin' role must be assigned to a company." });
  }
  if (!['admin', 'superadmin'].includes(role)) {
    return res.status(400).send({ message: "Role must be 'admin' or 'superadmin'." });
  }

  const userCompanyId = role === 'superadmin' ? null : companyId;

  try {
    let query;
    let queryParams;

    if (password) {
      const passwordHash = bcrypt.hashSync(password, 8);
      query = `UPDATE users SET username = $1, email = $2, password = $3, role = $4, company_id = $5 WHERE id = $6`;
      queryParams = [username, email, passwordHash, role, userCompanyId, id];
    } else {
      query = `UPDATE users SET username = $1, email = $2, role = $3, company_id = $4 WHERE id = $5`;
      queryParams = [username, email, role, userCompanyId, id];
    }

    const result = await db.query(query, queryParams);
    if (result.rowCount === 0) {
      return res.status(404).send({ message: "User not found." });
    }
    res.status(200).send({ message: "User updated successfully." });
  } catch (error) {
    if (error.code === '23505') { // unique_violation
      return res.status(409).send({ message: "Email or username is already in use." });
    }
    res.status(500).send({ message: error.message });
  }
};

// DELETE /api/saas/users/:id
exports.deleteSaaSUser = async (req, res) => {
  const { id } = req.params;
  const currentUserId = req.userId; // from verifyToken middleware

  if (parseInt(id, 10) === currentUserId) {
    return res.status(403).send({ message: "You cannot delete your own account." });
  }

  try {
    const result = await db.query("DELETE FROM users WHERE id = $1 AND role IN ('admin', 'superadmin')", [id]);
    if (result.rowCount === 0) {
      return res.status(404).send({ message: "User not found or is not an admin/superadmin." });
    }
    res.status(200).send({ message: "User deleted successfully." });
  } catch (error) {
    console.error("Error in deleteSaaSUser:", error);
    res.status(500).send({ message: error.message });
  }
};
