const db = require("../db");
const bcrypt = require("bcryptjs");

// ─────────────────────────────────────────────
//  SAAS ADMIN — manage corporates
// ─────────────────────────────────────────────

exports.getAllCorporates = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                co.id,
                co.name,
                co.address,
                co.created_at AS "createdAt",
                COUNT(DISTINCT c.id)::int AS "companyCount",
                COUNT(DISTINCT u_emp.id)::int AS "employeeCount",
                corp_admin.email AS "adminEmail",
                corp_admin.username AS "adminUsername"
            FROM corporates co
            LEFT JOIN companies c ON c.corporate_id = co.id
            LEFT JOIN users u_emp ON u_emp.company_id = c.id AND u_emp.role = 'user' AND u_emp.is_active = TRUE
            LEFT JOIN users corp_admin ON corp_admin.corporate_id = co.id AND corp_admin.role = 'corporate_admin'
            GROUP BY co.id, co.name, co.address, co.created_at, corp_admin.email, corp_admin.username
            ORDER BY co.created_at DESC
        `);
        res.status(200).send(result.rows);
    } catch (error) {
        console.error("Error fetching corporates:", error);
        res.status(500).send({ message: "An error occurred while fetching corporates." });
    }
};

exports.getCorporateById = async (req, res) => {
    const { id } = req.params;
    try {
        const corpRes = await db.query(
            `SELECT co.*, corp_admin.email AS "adminEmail", corp_admin.username AS "adminUsername", corp_admin.id AS "adminId"
             FROM corporates co
             LEFT JOIN users corp_admin ON corp_admin.corporate_id = co.id AND corp_admin.role = 'corporate_admin'
             WHERE co.id = $1`,
            [id]
        );
        if (corpRes.rows.length === 0) return res.status(404).send({ message: "Corporate not found." });

        const companiesRes = await db.query(
            `SELECT c.id, c.name, c.address, c.subscription_status AS "subscriptionStatus",
                    COUNT(u.id)::int AS "employeeCount"
             FROM companies c
             LEFT JOIN users u ON u.company_id = c.id AND u.role = 'user' AND u.is_active = TRUE
             WHERE c.corporate_id = $1
             GROUP BY c.id ORDER BY c.name`,
            [id]
        );

        res.status(200).send({ ...corpRes.rows[0], companies: companiesRes.rows });
    } catch (error) {
        console.error("Error fetching corporate:", error);
        res.status(500).send({ message: "An error occurred." });
    }
};

exports.createCorporate = async (req, res) => {
    const { name, address, adminEmail, adminPassword, adminUsername } = req.body;
    if (!name || !adminEmail || !adminPassword || !adminUsername) {
        return res.status(400).send({ message: "name, adminEmail, adminPassword, dan adminUsername wajib diisi." });
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        // Create corporate
        const corpRes = await client.query(
            `INSERT INTO corporates (name, address) VALUES ($1, $2) RETURNING id`,
            [name, address || null]
        );
        const corporateId = corpRes.rows[0].id;

        // Create corporate_admin user
        const hashedPassword = await bcrypt.hash(adminPassword, 8);
        await client.query(
            `INSERT INTO users (corporate_id, username, email, password, role, is_active)
             VALUES ($1, $2, $3, $4, 'corporate_admin', TRUE)`,
            [corporateId, adminUsername, adminEmail, hashedPassword]
        );

        await client.query('COMMIT');
        res.status(201).send({ message: "Corporate berhasil dibuat.", corporateId });
    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') {
            return res.status(409).send({ message: "Nama corporate atau email admin sudah digunakan." });
        }
        console.error("Error creating corporate:", error);
        res.status(500).send({ message: "An error occurred while creating corporate." });
    } finally {
        client.release();
    }
};

exports.updateCorporate = async (req, res) => {
    const { id } = req.params;
    const { name, address } = req.body;
    try {
        const result = await db.query(
            `UPDATE corporates SET name = COALESCE($1, name), address = COALESCE($2, address) WHERE id = $3 RETURNING *`,
            [name, address, id]
        );
        if (result.rows.length === 0) return res.status(404).send({ message: "Corporate not found." });
        res.status(200).send(result.rows[0]);
    } catch (error) {
        console.error("Error updating corporate:", error);
        res.status(500).send({ message: "An error occurred." });
    }
};

exports.deleteCorporate = async (req, res) => {
    const { id } = req.params;
    try {
        // Unlink companies first (SET NULL via FK), then delete users, then delete corporate
        await db.query(`DELETE FROM users WHERE corporate_id = $1 AND role = 'corporate_admin'`, [id]);
        const result = await db.query(`DELETE FROM corporates WHERE id = $1 RETURNING id`, [id]);
        if (result.rows.length === 0) return res.status(404).send({ message: "Corporate not found." });
        res.status(200).send({ message: "Corporate deleted." });
    } catch (error) {
        console.error("Error deleting corporate:", error);
        res.status(500).send({ message: "An error occurred." });
    }
};

exports.assignCompanyToCorporate = async (req, res) => {
    const { companyId } = req.params;
    const { corporateId } = req.body; // null = unassign
    try {
        const result = await db.query(
            `UPDATE companies SET corporate_id = $1 WHERE id = $2 RETURNING id, name, corporate_id`,
            [corporateId || null, companyId]
        );
        if (result.rows.length === 0) return res.status(404).send({ message: "Company not found." });
        res.status(200).send({ message: "Company assigned.", company: result.rows[0] });
    } catch (error) {
        console.error("Error assigning company:", error);
        res.status(500).send({ message: "An error occurred." });
    }
};

// Get all companies not yet in any corporate (for assign dropdown)
exports.getUnassignedCompanies = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, name FROM companies WHERE corporate_id IS NULL ORDER BY name`
        );
        res.status(200).send(result.rows);
    } catch (error) {
        res.status(500).send({ message: "An error occurred." });
    }
};

// ─────────────────────────────────────────────
//  CORPORATE ADMIN — their portal
// ─────────────────────────────────────────────

exports.getCorporateOverview = async (req, res) => {
    const { corporateId } = req;
    try {
        const result = await db.query(`
            SELECT
                co.id,
                co.name AS "corporateName",
                COUNT(DISTINCT c.id)::int AS "totalHotels",
                COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'user' AND u.is_active = TRUE)::int AS "totalEmployees",
                COUNT(DISTINCT a.user_id) FILTER (
                    WHERE DATE(a.check_in_time AT TIME ZONE 'Asia/Jakarta') = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date
                )::int AS "presentToday"
            FROM corporates co
            LEFT JOIN companies c ON c.corporate_id = co.id
            LEFT JOIN users u ON u.company_id = c.id
            LEFT JOIN attendance a ON a.user_id = u.id
            WHERE co.id = $1
            GROUP BY co.id, co.name
        `, [corporateId]);

        if (result.rows.length === 0) return res.status(404).send({ message: "Corporate not found." });
        res.status(200).send(result.rows[0]);
    } catch (error) {
        console.error("Error fetching corporate overview:", error);
        res.status(500).send({ message: "An error occurred." });
    }
};

exports.getCorporateCompanies = async (req, res) => {
    const { corporateId } = req;
    try {
        const result = await db.query(`
            SELECT
                c.id,
                c.name,
                c.address,
                c.brand,
                c.star_rating AS "starRating",
                c.subscription_status AS "subscriptionStatus",
                COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'user' AND u.is_active = TRUE)::int AS "employeeCount",
                COUNT(DISTINCT a.user_id) FILTER (
                    WHERE DATE(a.check_in_time AT TIME ZONE 'Asia/Jakarta') = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date
                )::int AS "presentToday",
                admin_u.email AS "adminEmail"
            FROM companies c
            LEFT JOIN users u ON u.company_id = c.id
            LEFT JOIN attendance a ON a.user_id = u.id
            LEFT JOIN users admin_u ON admin_u.company_id = c.id AND admin_u.role = 'admin'
            WHERE c.corporate_id = $1
            GROUP BY c.id, c.name, c.address, c.brand, c.star_rating, c.subscription_status, admin_u.email
            ORDER BY c.name
        `, [corporateId]);
        res.status(200).send(result.rows);
    } catch (error) {
        console.error("Error fetching corporate companies:", error);
        res.status(500).send({ message: "An error occurred." });
    }
};

exports.getCorporateEmployees = async (req, res) => {
    const { corporateId } = req;
    const { companyId, search } = req.query;
    try {
        const params = [corporateId];
        let filterClause = '';

        if (companyId) {
            params.push(companyId);
            // Include employees whose primary company is this, OR who have a secondary assignment here
            filterClause += ` AND (c.id = $${params.length} OR EXISTS (
                SELECT 1 FROM user_company_assignments uca2
                WHERE uca2.user_id = u.id AND uca2.company_id = $${params.length} AND uca2.is_primary = FALSE
            ))`;
        }
        if (search) {
            params.push(`%${search}%`);
            filterClause += ` AND (COALESCE(up.full_name, u.username) ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
        }

        const result = await db.query(`
            SELECT
                u.id,
                COALESCE(up.full_name, u.username) AS "fullName",
                u.email,
                u.avatar_url AS "avatarUrl",
                u.is_active AS "isActive",
                c.name AS "companyName",
                c.id   AS "companyId",
                pos.name AS "position",
                dep.name AS "department",
                -- Count secondary hotel assignments
                (SELECT COUNT(*)::int FROM user_company_assignments uca
                 WHERE uca.user_id = u.id AND uca.is_primary = FALSE) AS "secondaryCount",
                -- Names of secondary hotels as JSON array
                (SELECT json_agg(json_build_object('id', sc.id, 'name', sc.name, 'brand', sc.brand, 'starRating', sc.star_rating))
                 FROM user_company_assignments uca
                 JOIN companies sc ON uca.company_id = sc.id
                 WHERE uca.user_id = u.id AND uca.is_primary = FALSE) AS "secondaryHotels"
            FROM users u
            JOIN companies c ON u.company_id = c.id
            LEFT JOIN user_profiles up  ON u.id = up.user_id
            LEFT JOIN positions pos     ON u.position_id = pos.id
            LEFT JOIN departments dep   ON u.department_id = dep.id
            WHERE c.corporate_id = $1
              AND u.role = 'user'
              ${filterClause}
            ORDER BY c.name, "fullName"
        `, params);
        res.status(200).send(result.rows);
    } catch (error) {
        console.error("Error fetching corporate employees:", error);
        res.status(500).send({ message: "An error occurred." });
    }
};

// ─────────────────────────────────────────────
//  Phase 3 — Multi-hotel assignments
// ─────────────────────────────────────────────

// GET /api/corporate/employees/:userId/assignments
exports.getEmployeeAssignments = async (req, res) => {
    const { corporateId } = req;
    const { userId } = req.params;
    try {
        // Verify employee belongs to this corporate
        const check = await db.query(
            `SELECT u.id, COALESCE(up.full_name, u.username) AS "fullName",
                    c.id AS "primaryCompanyId", c.name AS "primaryCompanyName",
                    u.active_company_id AS "activeCompanyId"
             FROM users u
             JOIN companies c ON u.company_id = c.id
             LEFT JOIN user_profiles up ON u.id = up.user_id
             WHERE u.id = $1 AND c.corporate_id = $2 AND u.role = 'user'`,
            [userId, corporateId]
        );
        if (check.rows.length === 0) {
            return res.status(404).send({ message: "Employee not found in this corporate." });
        }

        const employee = check.rows[0];

        // Get all assignments (primary + secondary)
        const assignments = await db.query(
            `SELECT uca.company_id AS "companyId", c.name AS "companyName",
                    c.brand, c.star_rating AS "starRating",
                    uca.is_primary AS "isPrimary", uca.started_at AS "startedAt"
             FROM user_company_assignments uca
             JOIN companies c ON uca.company_id = c.id
             WHERE uca.user_id = $1
             ORDER BY uca.is_primary DESC, c.name`,
            [userId]
        );

        // If no assignment records exist yet, return primary hotel from users table
        const rows = assignments.rows.length > 0
            ? assignments.rows
            : [{ companyId: employee.primaryCompanyId, companyName: employee.primaryCompanyName, brand: null, starRating: null, isPrimary: true, startedAt: null }];

        res.status(200).send({ employee, assignments: rows });
    } catch (error) {
        console.error("Error fetching employee assignments:", error);
        res.status(500).send({ message: "An error occurred." });
    }
};

// POST /api/corporate/employees/:userId/assignments
exports.addEmployeeAssignment = async (req, res) => {
    const { corporateId } = req;
    const { userId } = req.params;
    const { companyId, startedAt } = req.body;

    if (!companyId) return res.status(400).send({ message: "companyId wajib diisi." });

    try {
        // Validate: employee must belong to this corporate
        const empCheck = await db.query(
            `SELECT u.id, u.company_id AS "primaryCompanyId"
             FROM users u JOIN companies c ON u.company_id = c.id
             WHERE u.id = $1 AND c.corporate_id = $2 AND u.role = 'user'`,
            [userId, corporateId]
        );
        if (empCheck.rows.length === 0) {
            return res.status(404).send({ message: "Employee not found in this corporate." });
        }

        // Validate: target company must belong to this corporate
        const compCheck = await db.query(
            `SELECT id FROM companies WHERE id = $1 AND corporate_id = $2`,
            [companyId, corporateId]
        );
        if (compCheck.rows.length === 0) {
            return res.status(400).send({ message: "Hotel tidak termasuk dalam corporate ini." });
        }

        const isPrimary = empCheck.rows[0].primaryCompanyId === parseInt(companyId);

        // Ensure primary assignment record exists
        await db.query(
            `INSERT INTO user_company_assignments (user_id, company_id, is_primary, started_at)
             VALUES ($1, $2, TRUE, NULL)
             ON CONFLICT (user_id, company_id) DO NOTHING`,
            [userId, empCheck.rows[0].primaryCompanyId]
        );

        if (isPrimary) {
            return res.status(409).send({ message: "Karyawan sudah berada di hotel ini sebagai hotel utama." });
        }

        await db.query(
            `INSERT INTO user_company_assignments (user_id, company_id, is_primary, started_at)
             VALUES ($1, $2, FALSE, $3)
             ON CONFLICT (user_id, company_id) DO NOTHING`,
            [userId, companyId, startedAt || null]
        );

        res.status(201).send({ message: "Karyawan berhasil ditetapkan ke hotel." });
    } catch (error) {
        console.error("Error adding employee assignment:", error);
        res.status(500).send({ message: "An error occurred." });
    }
};

// DELETE /api/corporate/employees/:userId/assignments/:companyId
exports.removeEmployeeAssignment = async (req, res) => {
    const { corporateId } = req;
    const { userId, companyId } = req.params;

    try {
        // Cannot remove primary assignment
        const empCheck = await db.query(
            `SELECT u.company_id AS "primaryCompanyId"
             FROM users u JOIN companies c ON u.company_id = c.id
             WHERE u.id = $1 AND c.corporate_id = $2`,
            [userId, corporateId]
        );
        if (empCheck.rows.length === 0) {
            return res.status(404).send({ message: "Employee not found." });
        }
        if (empCheck.rows[0].primaryCompanyId === parseInt(companyId)) {
            return res.status(400).send({ message: "Tidak bisa menghapus hotel utama karyawan." });
        }

        const result = await db.query(
            `DELETE FROM user_company_assignments WHERE user_id = $1 AND company_id = $2 AND is_primary = FALSE RETURNING id`,
            [userId, companyId]
        );
        if (result.rows.length === 0) {
            return res.status(404).send({ message: "Assignment tidak ditemukan." });
        }
        res.status(200).send({ message: "Assignment dihapus." });
    } catch (error) {
        console.error("Error removing employee assignment:", error);
        res.status(500).send({ message: "An error occurred." });
    }
};

// PUT /api/corporate/employees/:userId/active-company
exports.setActiveCompany = async (req, res) => {
    const { corporateId } = req;
    const { userId } = req.params;
    const { companyId } = req.body; // null = reset ke hotel utama

    try {
        // Validasi: karyawan harus milik corporate ini
        const empCheck = await db.query(
            `SELECT u.company_id AS "primaryCompanyId"
             FROM users u JOIN companies c ON u.company_id = c.id
             WHERE u.id = $1 AND c.corporate_id = $2 AND u.role = 'user'`,
            [userId, corporateId]
        );
        if (empCheck.rows.length === 0) {
            return res.status(404).send({ message: "Karyawan tidak ditemukan dalam corporate ini." });
        }

        if (companyId) {
            const primary = empCheck.rows[0].primaryCompanyId;
            // Jika bukan hotel utama, harus ada assignment
            if (parseInt(companyId) !== primary) {
                const assignCheck = await db.query(
                    `SELECT id FROM user_company_assignments WHERE user_id = $1 AND company_id = $2`,
                    [userId, companyId]
                );
                if (assignCheck.rows.length === 0) {
                    return res.status(400).send({ message: "Hotel tidak ada dalam daftar assignment karyawan ini." });
                }
            }
        }

        await db.query(
            `UPDATE users SET active_company_id = $1 WHERE id = $2`,
            [companyId || null, userId]
        );

        res.status(200).send({ message: "Hotel aktif berhasil diubah." });
    } catch (error) {
        console.error("Error setting active company:", error);
        res.status(500).send({ message: "An error occurred." });
    }
};

// ─────────────────────────────────────────────
//  Phase 2 — Laporan & Monitoring
// ─────────────────────────────────────────────

// GET /api/corporate/attendance?date=YYYY-MM-DD&companyId=
exports.getCorporateAttendanceByDate = async (req, res) => {
    const { corporateId } = req;
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const { companyId } = req.query;

    try {
        const params = [corporateId, date];
        let companyFilter = '';
        if (companyId) {
            params.push(companyId);
            companyFilter = `AND c.id = $${params.length}`;
        }

        const result = await db.query(`
            SELECT
                a.id,
                a.check_in_time  AS "checkInTime",
                a.check_out_time AS "checkOutTime",
                a.status,
                a.notes,
                u.avatar_url     AS "avatarUrl",
                u.is_active      AS "isActive",
                COALESCE(up.full_name, u.username) AS "fullName",
                c.name           AS "companyName",
                c.id             AS "companyId",
                COALESCE(ws.start_time, ws_default.start_time) AS "scheduledStartTime",
                CASE
                    WHEN a.check_in_time IS NOT NULL
                     AND (a.check_in_time AT TIME ZONE 'Asia/Jakarta')::time
                         > COALESCE(ws.start_time, ws_default.start_time)
                    THEN TRUE ELSE FALSE
                END AS "isLate"
            FROM attendance a
            JOIN users u     ON a.user_id = u.id
            JOIN companies c ON u.company_id = c.id
            LEFT JOIN user_profiles up ON u.id = up.user_id
            LEFT JOIN daily_schedule_assignments dsa
                ON a.user_id = dsa.user_id
               AND dsa.assignment_date = $2
               AND dsa.company_id = c.id
            LEFT JOIN work_schedules ws         ON dsa.work_schedule_id = ws.id
            LEFT JOIN work_schedules ws_default ON u.work_schedule_id = ws_default.id
            WHERE c.corporate_id = $1
              AND DATE(COALESCE(a.check_in_time, a.created_at) AT TIME ZONE 'Asia/Jakarta') = $2
              ${companyFilter}
            ORDER BY c.name, "fullName", a.check_in_time ASC
        `, params);

        res.status(200).send(result.rows);
    } catch (error) {
        console.error("Error fetching corporate attendance:", error);
        res.status(500).send({ message: "An error occurred." });
    }
};

// GET /api/corporate/reports/attendance?startDate=&endDate=&companyId=
exports.getCorporateAttendanceReport = async (req, res) => {
    const { corporateId } = req;
    const { startDate, endDate, companyId } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).send({ message: "startDate dan endDate wajib diisi." });
    }

    try {
        const params = [startDate, endDate, corporateId];
        let companyFilter = '';
        if (companyId) {
            params.push(companyId);
            companyFilter = `AND c.id = $${params.length}`;
        }

        const result = await db.query(`
            SELECT
                u.id AS "userId",
                COALESCE(up.full_name, u.username) AS "fullName",
                c.name AS "companyName",
                c.id   AS "companyId",
                d.name AS "departmentName",
                u.is_active AS "isActive",
                COALESCE(agg.present, 0)   AS present,
                COALESCE(agg.late, 0)      AS late,
                COALESCE(agg.on_leave, 0)  AS "onLeave",
                COALESCE(agg.absent, 0)    AS absent,
                COALESCE(workdays.count,0) AS "totalWorkdays"
            FROM users u
            JOIN companies c ON u.company_id = c.id
            LEFT JOIN user_profiles up ON u.id = up.user_id
            LEFT JOIN departments d    ON u.department_id = d.id
            LEFT JOIN (
                SELECT
                    a.user_id,
                    COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'present')::int AS present,
                    COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'absent')::int  AS absent,
                    COUNT(DISTINCT a.id) FILTER (WHERE a.status IN ('on_leave','sick'))::int AS on_leave,
                    COUNT(DISTINCT a.id) FILTER (
                        WHERE a.status = 'present'
                          AND (a.check_in_time AT TIME ZONE 'Asia/Jakarta')::time
                              > COALESCE(ws_dsa.start_time, ws_u.start_time)
                    )::int AS late
                FROM attendance a
                JOIN users u2 ON a.user_id = u2.id
                JOIN companies c2 ON u2.company_id = c2.id
                LEFT JOIN daily_schedule_assignments dsa
                    ON a.user_id = dsa.user_id
                   AND DATE(a.check_in_time AT TIME ZONE 'Asia/Jakarta') = dsa.assignment_date
                   AND dsa.company_id = c2.id
                LEFT JOIN work_schedules ws_dsa ON dsa.work_schedule_id = ws_dsa.id
                LEFT JOIN work_schedules ws_u   ON u2.work_schedule_id  = ws_u.id
                WHERE c2.corporate_id = $3
                  AND DATE(COALESCE(a.check_in_time, a.created_at)) >= $1
                  AND DATE(COALESCE(a.check_in_time, a.created_at)) <= $2
                GROUP BY a.user_id
            ) agg ON u.id = agg.user_id
            LEFT JOIN (
                SELECT dsa.user_id, COUNT(*)::int AS count
                FROM daily_schedule_assignments dsa
                JOIN companies c3 ON dsa.company_id = c3.id
                WHERE c3.corporate_id = $3
                  AND dsa.work_schedule_id IS NOT NULL
                  AND dsa.assignment_date >= $1
                  AND dsa.assignment_date <= $2
                GROUP BY dsa.user_id
            ) workdays ON u.id = workdays.user_id
            WHERE c.corporate_id = $3
              AND u.role = 'user'
              AND (u.is_active = TRUE OR agg.user_id IS NOT NULL)
              ${companyFilter}
            ORDER BY c.name, u.is_active DESC, "fullName"
        `, params);

        res.status(200).send(result.rows);
    } catch (error) {
        console.error("Error generating corporate attendance report:", error);
        res.status(500).send({ message: "An error occurred." });
    }
};

// GET /api/corporate/reports/leave?startDate=&endDate=&companyId=
exports.getCorporateLeaveReport = async (req, res) => {
    const { corporateId } = req;
    const { startDate, endDate, companyId } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).send({ message: "startDate dan endDate wajib diisi." });
    }

    try {
        const params = [corporateId, startDate, endDate];
        let companyFilter = '';
        if (companyId) {
            params.push(companyId);
            companyFilter = `AND c.id = $${params.length}`;
        }

        const result = await db.query(`
            SELECT
                r.id,
                r.start_date  AS "startDate",
                r.end_date    AS "endDate",
                r.reason,
                r.status,
                r.created_at  AS "submittedDate",
                (r.end_date - r.start_date + 1) AS "totalDays",
                COALESCE(up.full_name, u.username) AS "fullName",
                u.avatar_url AS "avatarUrl",
                c.name       AS "companyName",
                c.id         AS "companyId",
                at.name      AS "leaveTypeName",
                at.code      AS "leaveTypeCode"
            FROM requests r
            JOIN users u     ON r.user_id = u.id
            JOIN companies c ON u.company_id = c.id
            LEFT JOIN user_profiles up ON u.id = up.user_id
            LEFT JOIN absence_types at ON r.absence_type_id = at.id
            WHERE c.corporate_id = $1
              AND r.request_type = 'leave'
              AND r.start_date >= $2
              AND r.start_date <= $3
              ${companyFilter}
            ORDER BY r.created_at DESC
        `, params);

        res.status(200).send(result.rows);
    } catch (error) {
        console.error("Error generating corporate leave report:", error);
        res.status(500).send({ message: "An error occurred." });
    }
};

// GET /api/corporate/requests?status=pending&companyId=
exports.getCorporateRequests = async (req, res) => {
    const { corporateId } = req;
    const { status, companyId } = req.query;

    try {
        const params = [corporateId];
        const filters = [];

        if (status && status !== 'all') {
            params.push(status);
            filters.push(`r.status = $${params.length}`);
        }
        if (companyId) {
            params.push(companyId);
            filters.push(`c.id = $${params.length}`);
        }

        const whereExtra = filters.length ? 'AND ' + filters.join(' AND ') : '';

        const result = await db.query(`
            SELECT
                r.id,
                r.request_type  AS "requestType",
                r.start_date    AS "startDate",
                r.end_date      AS "endDate",
                r.reason,
                r.status,
                r.created_at    AS "submittedDate",
                (r.end_date - r.start_date + 1) AS "totalDays",
                COALESCE(up.full_name, u.username) AS "fullName",
                u.avatar_url AS "avatarUrl",
                c.name       AS "companyName",
                c.id         AS "companyId",
                at.name      AS "absenceTypeName"
            FROM requests r
            JOIN users u     ON r.user_id = u.id
            JOIN companies c ON u.company_id = c.id
            LEFT JOIN user_profiles up    ON u.id = up.user_id
            LEFT JOIN absence_types at    ON r.absence_type_id = at.id
            WHERE c.corporate_id = $1
              ${whereExtra}
            ORDER BY r.created_at DESC
            LIMIT 200
        `, params);

        res.status(200).send(result.rows);
    } catch (error) {
        console.error("Error fetching corporate requests:", error);
        res.status(500).send({ message: "An error occurred." });
    }
};
