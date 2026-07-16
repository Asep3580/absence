const db = require("../db");
const bcrypt = require("bcryptjs");

/**
 * Helper function to check if a company has reached its employee limit.
 * Throws a specific error if the limit is reached.
 * @param {number} companyId The ID of the company to check.
 * @param {object} client The database client to use for the transaction.
 */
async function checkEmployeeLimit(companyId, client = db) {
    const companyQuery = "SELECT max_employees FROM companies WHERE id = $1";
    const companyResult = await client.query(companyQuery, [companyId]);

    if (companyResult.rows.length === 0) {
        throw new Error("Company not found.");
    }
    const maxEmployees = companyResult.rows[0].max_employees;

    const employeeCountQuery = "SELECT COUNT(*) AS count FROM users WHERE company_id = $1 AND role = 'user' AND is_active = TRUE";
    const employeeCountResult = await client.query(employeeCountQuery, [companyId]);
    const currentEmployees = parseInt(employeeCountResult.rows[0].count, 10);

    if (currentEmployees >= maxEmployees) {
        const error = new Error(`Batas maksimal jumlah karyawan (${maxEmployees}) telah tercapai. Silakan hubungi administrator untuk meningkatkan paket langganan Anda.`);
        error.statusCode = 403; // 403 Forbidden
        throw error;
    }
}

const userManagementController = {
    getAll: async (req, res) => {
        try {
            const scope = req.query.scope;

            // If scope is 'management', return a simple list of all system users (admins and users)
            // This is for the "User Management" settings page.
            if (scope === 'management') {
                const usersSql = `
                    SELECT u.id, u.username, u.email, u.role
                    FROM users u
                    WHERE u.company_id = $1 AND u.role IN ('admin', 'user')
                    ORDER BY u.username
                `;
                const usersResult = await db.query(usersSql, [req.companyId]);
                return res.status(200).send(usersResult.rows);
            }

            // --- Default behavior: Paginated employee list for the "Employees" page ---
            const page = parseInt(req.query.page, 10) || 1;
            const limit = parseInt(req.query.limit, 10) || 10;
            const offset = (page - 1) * limit;
            const status = req.query.status || 'active'; // 'active' or 'inactive'
            const isActive = status === 'active';

            // Query to get the paginated list of users based on active status
            const usersSql = `
                SELECT
                    u.id,
                    u.username,
                    u.email,
                    u.role,
                    u.avatar_url AS "avatarUrl",
                    up.full_name AS "fullName",
                    p.name AS "positionName",
                    u.employee_nik AS "employeeNik",
                    d.name AS "departmentName",
                    u.is_active AS "isActive",
                    es.name AS "employeeStatusName",
                    el.name AS "employeeLevelName"
                FROM users u
                LEFT JOIN user_profiles up ON u.id = up.user_id
                LEFT JOIN positions p ON u.position_id = p.id
                LEFT JOIN departments d ON u.department_id = d.id
                LEFT JOIN employee_statuses es ON u.employee_status_id = es.id
                LEFT JOIN employee_levels el ON u.employee_level_id = el.id
                WHERE u.company_id = $1 AND u.role = 'user' AND u.is_active = $4
                ORDER BY up.full_name, u.username
                LIMIT $2 OFFSET $3
            `;
            const usersResult = await db.query(usersSql, [req.companyId, limit, offset, isActive]);

            // Query to get the total count of users
            const countSql = `SELECT COUNT(*)::int FROM users WHERE company_id = $1 AND role = 'user' AND is_active = $2`;
            const countResult = await db.query(countSql, [req.companyId, isActive]);
            const totalItems = countResult.rows[0].count;
            const totalPages = Math.ceil(totalItems / limit);

            res.status(200).send({
                data: usersResult.rows,
                pagination: {
                    currentPage: page,
                    totalPages: totalPages,
                    totalItems: totalItems,
                    limit: limit
                }
            });
        } catch (error) {
            res.status(500).send({ message: error.message });
        }
    },
    getById: async (req, res) => {
        try {
            const sql = `
                SELECT
                    u.id,
                    u.username,
                    u.email,
                    u.role,
                    u.avatar_url AS "avatarUrl",
                    u.is_active AS "isActive",
                    u.created_at AS "createdAt",
                    c.name AS "companyName",
                    u.position_id AS "positionId",
                    p.name AS "positionName",
                    u.department_id AS "departmentId",
                    d.name AS "departmentName",
                    ws.name AS "workScheduleName",
                    u.employee_status_id AS "employeeStatusId",
                    es.name AS "employeeStatusName",
                    u.employee_level_id AS "employeeLevelId",
                    u.contract_start_date AS "contractStartDate",
                    u.contract_end_date AS "contractEndDate",
                    u.join_date AS "joinDate",
                    el.name AS "employeeLevelName",
                    u.employee_nik AS "employeeNik",
                    up.full_name AS "fullName",
                    up.phone_number AS "phoneNumber",
                    up.date_of_birth AS "dateOfBirth",
                    up.gender,
                    ms.name AS "maritalStatus",
                    up.religion,
                    up.address,
                    up.emergency_contact_name AS "emergencyContactName",
                    up.emergency_contact_phone AS "emergencyContactPhone",
                    COALESCE(up.annual_leave_adjustment, 0) AS "annualLeaveAdjustment",
                    u.supervisor_id AS "supervisorId",
                    sup_p.full_name AS "supervisorName",
                    u.manager_id AS "managerId",
                    mgr_p.full_name AS "managerName"
                FROM users u
                LEFT JOIN companies c ON u.company_id = c.id
                LEFT JOIN user_profiles up ON u.id = up.user_id
                LEFT JOIN marital_statuses ms ON up.marital_status_id = ms.id
                LEFT JOIN positions p ON u.position_id = p.id
                LEFT JOIN departments d ON u.department_id = d.id
                LEFT JOIN employee_statuses es ON u.employee_status_id = es.id
                LEFT JOIN employee_levels el ON u.employee_level_id = el.id
                LEFT JOIN work_schedules ws ON u.work_schedule_id = ws.id
                LEFT JOIN user_profiles sup_p ON u.supervisor_id = sup_p.user_id
                LEFT JOIN user_profiles mgr_p ON u.manager_id = mgr_p.user_id
                WHERE u.id = $1 AND u.company_id = $2
            `;
            const result = await db.query(sql, [req.params.id, req.companyId]);
            if (result.rows.length === 0) return res.status(404).send({ message: "User not found." });
            res.status(200).send(result.rows[0]);
        } catch (error) {
            res.status(500).send({ message: error.message });
        }
    },
    create: async (req, res) => {
        const {
            username, email, password, role, fullName, employeeNik,
            positionId, departmentId, phoneNumber, dateOfBirth,
            gender, maritalStatus, religion, address, employeeStatusId, joinDate,
            employeeLevelId, contractStartDate, contractEndDate, annualLeaveAdjustment,
            emergencyContactName, emergencyContactPhone
        } = req.body;

        if (!username || !email || !password || !role || !fullName) {
            return res.status(400).send({ message: "Username, email, password, role, and full name are required." });
        }

        // To ensure atomicity, all queries for creating a user and their profile
        // must be executed on a single client from the connection pool.
        const client = await db.connect();

        try {
            await client.query('BEGIN');

            // Check employee limit before creating a new user
            if (role === 'user') {
                await checkEmployeeLimit(req.companyId, client);
            }

            // 1. Insert into users table
            const hashedPassword = bcrypt.hashSync(password, 8);
            const userQuery = `
                INSERT INTO users (company_id, username, email, password, role, position_id, department_id, employee_status_id, employee_level_id, join_date, employee_nik, contract_start_date, contract_end_date, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                RETURNING id, username, email, role
            `;
            const userValues = [req.companyId, username, email, hashedPassword, role, positionId || null, departmentId || null, employeeStatusId || null, employeeLevelId || null, joinDate || null, employeeNik || null, contractStartDate || null, contractEndDate || null, true];
            const userResult = await client.query(userQuery, userValues);
            const newUser = userResult.rows[0];
            const userId = newUser.id;

            // 2. Resolve marital status name → id
            let maritalStatusId = null;
            if (maritalStatus) {
                const msRes = await client.query(
                    "SELECT id FROM marital_statuses WHERE company_id = $1 AND name = $2",
                    [req.companyId, maritalStatus]
                );
                maritalStatusId = msRes.rows[0]?.id || null;
            }

            // 3. Insert into user_profiles table
            const leaveAdj = (annualLeaveAdjustment != null && !isNaN(parseInt(annualLeaveAdjustment, 10)))
                ? parseInt(annualLeaveAdjustment, 10) : 0;
            const profileQuery = `
                INSERT INTO user_profiles (
                    user_id, full_name, phone_number, date_of_birth,
                    gender, marital_status_id, religion, address,
                    emergency_contact_name, emergency_contact_phone, annual_leave_adjustment
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `;
            const profileValues = [
                userId, fullName, phoneNumber || null, dateOfBirth || null,
                gender || null, maritalStatusId, religion || null, address || null,
                emergencyContactName || null, emergencyContactPhone || null, leaveAdj
            ];
            await client.query(profileQuery, profileValues);

            await client.query('COMMIT');
            res.status(201).send(newUser);

        } catch (error) {
            await client.query('ROLLBACK');
            if (error.statusCode === 403) {
                return res.status(403).send({ message: error.message });
            }
            if (error.code === '23505') { // unique_violation
                if (error.constraint && error.constraint.includes('email')) {
                    return res.status(409).send({ message: "Email already exists." });
                }
                // Handle unique NIK violation
                if (error.constraint && error.constraint.includes('employee_nik')) {
                    return res.status(409).send({ message: "Employee ID (NIK) already exists in this company." });
                }
                if (error.constraint && error.constraint.includes('username')) {
                    return res.status(409).send({ message: "Username already exists." });
                }
                return res.status(409).send({ message: "A user with this email or username already exists." });
            }
            console.error("Error creating user with profile:", error);
            res.status(500).send({ message: "An error occurred while creating the user." });
        } finally {
            client.release();
        }
    },
    update: async (req, res) => {
        const { id } = req.params;
        const fields = req.body;
        const companyId = req.companyId;

        const updatableFields = ['username', 'email', 'role', 'password', 'positionId', 'departmentId', 'employeeStatusId', 'employeeLevelId'];
        const dbFieldMap = {
            positionId: 'position_id',
            departmentId: 'department_id',
            employeeStatusId: 'employee_status_id',
            employeeLevelId: 'employee_level_id'
        };

        const queryParts = [];
        const values = [];
        let valueIndex = 1;

        for (const field of updatableFields) {
            if (fields[field] !== undefined) {
                if (field === 'password') {
                    if (fields.password) { // only update if not empty
                        queryParts.push(`password = $${valueIndex++}`);
                        values.push(bcrypt.hashSync(fields.password, 8));
                    }
                } else {
                    const dbField = dbFieldMap[field] || field;
                    // Allow setting to null if an empty string is passed
                    const value = fields[field] === '' ? null : fields[field];
                    queryParts.push(`${dbField} = $${valueIndex++}`);
                    values.push(value);
                }
            }
        }

        if (queryParts.length === 0) {
            return res.status(400).send({ message: "No fields to update provided." });
        }

        values.push(id, companyId);
        const query = `UPDATE users SET ${queryParts.join(', ')} WHERE id = $${valueIndex++} AND company_id = $${valueIndex++} RETURNING id, username, email, role`;

        try {
            const result = await db.query(query, values);
            if (result.rows.length === 0) return res.status(404).send({ message: "User not found." });
            res.status(200).send(result.rows[0]);
        } catch (error) {
            if (error.code === '23505') {
                if (error.constraint && error.constraint.includes('employee_nik')) {
                    return res.status(409).send({ message: "Employee ID (NIK) is already used by another employee." });
                }
                return res.status(409).send({ message: "Email already exists." });
            }
            res.status(500).send({ message: error.message });
        }
    },
    delete: async (req, res) => {
        const { id } = req.params;
        if (parseInt(id, 10) === req.userId) {
            return res.status(400).send({ message: "You cannot delete your own account." });
        }
        try {
            const result = await db.query("DELETE FROM users WHERE id = $1 AND company_id = $2", [id, req.companyId]);
            if (result.rowCount === 0) return res.status(404).send({ message: "User not found." });
            res.status(204).send();
        } catch (error) {
            res.status(500).send({ message: error.message });
        }
    },

    updateProfile: async (req, res) => {
        const { id } = req.params;
        const {
            fullName,
            phoneNumber,
            dateOfBirth,
            gender,
            maritalStatus,
            religion,
            address,
            emergencyContactName,
            emergencyContactPhone
        } = req.body;

        try {
            // First, verify the user exists within the admin's company
            const userCheck = await db.query("SELECT id FROM users WHERE id = $1 AND company_id = $2", [id, req.companyId]);
            if (userCheck.rows.length === 0) {
                return res.status(404).send({ message: "User not found in this company." });
            }

            // Resolve marital status name → id
            let maritalStatusId = null;
            if (maritalStatus) {
                const msRes = await db.query(
                    "SELECT id FROM marital_statuses WHERE company_id = $1 AND name = $2",
                    [req.companyId, maritalStatus]
                );
                maritalStatusId = msRes.rows[0]?.id || null;
            }

            const sql = `
                INSERT INTO user_profiles (
                    user_id, full_name, phone_number, date_of_birth, gender, marital_status_id, religion, address, emergency_contact_name, emergency_contact_phone
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (user_id) DO UPDATE SET
                    full_name = EXCLUDED.full_name,
                    phone_number = EXCLUDED.phone_number,
                    date_of_birth = EXCLUDED.date_of_birth,
                    gender = EXCLUDED.gender,
                    marital_status_id = EXCLUDED.marital_status_id,
                    religion = EXCLUDED.religion,
                    address = EXCLUDED.address,
                    emergency_contact_name = EXCLUDED.emergency_contact_name,
                    emergency_contact_phone = EXCLUDED.emergency_contact_phone,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *;
            `;

            const values = [
                id,
                fullName,
                phoneNumber,
                dateOfBirth || null,
                gender || null,
                maritalStatusId,
                religion,
                address,
                emergencyContactName,
                emergencyContactPhone
            ];

            const result = await db.query(sql, values);
            res.status(200).send(result.rows[0]);
        } catch (error) {
            console.error("Error updating user profile:", error);
            res.status(500).send({ message: "An error occurred while updating the user profile." });
        }
    },

    deactivate: async (req, res) => {
        const { id } = req.params;
        // Prevent user from deactivating themselves
        if (parseInt(id, 10) === req.userId) {
            return res.status(400).send({ message: "You cannot deactivate your own account." });
        }
        try {
            const result = await db.query("UPDATE users SET is_active = false WHERE id = $1 AND company_id = $2 RETURNING id, is_active", [id, req.companyId]);
            if (result.rowCount === 0) {
                return res.status(404).send({ message: "User not found." });
            }
            res.status(200).send(result.rows[0]);
        } catch (error) {
            res.status(500).send({ message: "An error occurred while deactivating the user." });
        }
    },

    reactivate: async (req, res) => {
        const { id } = req.params;
        const { companyId } = req;
        const client = await db.connect();

        try {
            await client.query("BEGIN");

            const userResult = await client.query("SELECT role, is_active FROM users WHERE id = $1 AND company_id = $2", [id, companyId]);

            if (userResult.rows.length === 0) {
                await client.query("ROLLBACK");
                return res.status(404).send({ message: "User not found in this company." });
            }

            const { role, is_active } = userResult.rows[0];

            if (is_active) {
                await client.query("ROLLBACK");
                return res.status(200).send({ message: "User is already active." });
            }

            if (role === 'user') {
                await checkEmployeeLimit(companyId, client);
            }

            const result = await client.query("UPDATE users SET is_active = true WHERE id = $1 AND company_id = $2 RETURNING id, is_active", [id, companyId]);

            await client.query("COMMIT");
            res.status(200).send(result.rows[0]);
        } catch (error) {
            await client.query("ROLLBACK");
            if (error.statusCode === 403) {
                return res.status(403).send({ message: error.message });
            }
            res.status(500).send({ message: "An error occurred while reactivating the user." });
        } finally {
            client.release();
        }
    },

    bulkImport: async (req, res) => {
        const { companyId } = req;
        const { employees } = req.body;

        if (!Array.isArray(employees) || employees.length === 0) {
            return res.status(400).send({ message: "No employee data provided." });
        }
        if (employees.length > 500) {
            return res.status(400).send({ message: "Maximum 500 employees per import." });
        }

        // Build name→id lookup maps for this company
        const [depts, positions, statuses, levels] = await Promise.all([
            db.query("SELECT id, LOWER(name) AS name FROM departments WHERE company_id = $1", [companyId]),
            db.query("SELECT id, LOWER(name) AS name FROM positions WHERE company_id = $1", [companyId]),
            db.query("SELECT id, LOWER(name) AS name FROM employee_statuses WHERE company_id = $1", [companyId]),
            db.query("SELECT id, LOWER(name) AS name FROM employee_levels WHERE company_id = $1", [companyId]),
        ]);
        const deptMap    = Object.fromEntries(depts.rows.map(r => [r.name, r.id]));
        const posMap     = Object.fromEntries(positions.rows.map(r => [r.name, r.id]));
        const statusMap  = Object.fromEntries(statuses.rows.map(r => [r.name, r.id]));
        const levelMap   = Object.fromEntries(levels.rows.map(r => [r.name, r.id]));

        const fmtDate = (d) => {
            if (!d) return null;
            const s = String(d).trim();
            if (!s) return null;
            const parsed = new Date(s);
            return isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0];
        };

        const results = [];
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < employees.length; i++) {
            const row = employees[i];
            const rowNum = i + 2; // Excel row number (data starts at row 2)

            const fullName = (row.fullName || '').trim();
            const email    = (row.email || '').trim().toLowerCase();
            const username = (row.username || '').trim() || fullName.toLowerCase().replace(/\s+/g, '_');

            if (!fullName || !email) {
                results.push({ row: rowNum, status: 'error', name: fullName || '-', email: email || '-', message: 'Full Name and Email are required' });
                errorCount++;
                continue;
            }
            if (!email.includes('@')) {
                results.push({ row: rowNum, status: 'error', name: fullName, email, message: 'Invalid email format' });
                errorCount++;
                continue;
            }

            const password     = (row.password || '').trim() || 'Password@123';
            const role         = ['user', 'admin'].includes((row.role || '').toLowerCase()) ? row.role.toLowerCase() : 'user';
            const departmentId = row.department      ? (deptMap[(row.department || '').toLowerCase().trim()]      || null) : null;
            const positionId   = row.position        ? (posMap[(row.position || '').toLowerCase().trim()]         || null) : null;
            const statusId     = row.employeeStatus  ? (statusMap[(row.employeeStatus || '').toLowerCase().trim()] || null) : null;
            const levelId      = row.employeeLevel   ? (levelMap[(row.employeeLevel || '').toLowerCase().trim()]  || null) : null;
            const gender       = ['Laki-laki', 'Perempuan'].includes(row.gender) ? row.gender : null;

            const client = await db.connect();
            try {
                await client.query('BEGIN');
                if (role === 'user') await checkEmployeeLimit(companyId, client);

                const hashedPassword = bcrypt.hashSync(password, 8);
                const userResult = await client.query(`
                    INSERT INTO users (
                        company_id, username, email, password, role,
                        position_id, department_id, employee_status_id, employee_level_id,
                        join_date, employee_nik, is_active,
                        contract_start_date, contract_end_date
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE,$12,$13)
                    RETURNING id
                `, [
                    companyId, username, email, hashedPassword, role,
                    positionId, departmentId, statusId, levelId,
                    fmtDate(row.joinDate), (row.nik || '').trim() || null,
                    fmtDate(row.contractStart), fmtDate(row.contractEnd)
                ]);

                const userId = userResult.rows[0].id;
                await client.query(`
                    INSERT INTO user_profiles (
                        user_id, full_name, phone_number, date_of_birth,
                        gender, religion, address,
                        emergency_contact_name, emergency_contact_phone
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                `, [
                    userId, fullName,
                    (row.phone || '').trim() || null,
                    fmtDate(row.dateOfBirth),
                    gender,
                    (row.religion || '').trim() || null,
                    (row.address || '').trim() || null,
                    (row.emergencyContactName || '').trim() || null,
                    (row.emergencyContactPhone || '').trim() || null
                ]);

                await client.query('COMMIT');
                results.push({ row: rowNum, status: 'success', name: fullName, email });
                successCount++;
            } catch (err) {
                await client.query('ROLLBACK');
                let msg = err.message;
                if (err.statusCode === 403) msg = 'Employee limit reached';
                else if (err.code === '23505') {
                    if ((err.constraint || '').includes('email'))    msg = 'Email already exists';
                    else if ((err.constraint || '').includes('username')) msg = 'Username already taken';
                    else if ((err.constraint || '').includes('nik'))  msg = 'NIK already in use';
                    else msg = 'Duplicate entry';
                }
                results.push({ row: rowNum, status: 'error', name: fullName, email, message: msg });
                errorCount++;
            } finally {
                client.release();
            }
        }

        res.send({ successCount, errorCount, results });
    }
};

module.exports = userManagementController;