const db = require("../db");
const bcrypt = require("bcryptjs");

const fmtLocal = (d) =>
    `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

exports.allAccess = (req, res) => {
    res.status(200).send("Public Content.");
};

exports.userBoard = (req, res) => {
    res.status(200).send("User Content.");
};

exports.adminBoard = (req, res) => {
    res.status(200).send("Admin Content.");
};

exports.getMe = async (req, res) => {
    try {
        const sql = `
            SELECT
                u.id,
                u.username,
                u.email,
                u.role,
                u.employee_nik AS "nik",
                el.name AS "levelName",
                u.supervisor_id AS "supervisorId",
                sup_p.full_name AS "supervisorName",
                u.manager_id AS "managerId",
                mgr_p.full_name AS "managerName",
                u.avatar_url AS "avatarUrl",
                u.face_photo_url AS "facePhotoUrl",
                u.join_date AS "joinDate",
                u.contract_start_date AS "contractStartDate",
                u.contract_end_date AS "contractEndDate",
                u.created_at AS "createdAt",
                c.name AS "companyName",
                p.name AS "positionName",
                d.name AS "departmentName",
                es.name AS "employeeStatusName",
                ws.name AS "workScheduleName",
                up.full_name AS "fullName",
                up.phone_number AS "phoneNumber",
                up.date_of_birth AS "dateOfBirth",
                up.gender,
                ms.name AS "maritalStatus",
                up.religion,
                up.address,
                up.emergency_contact_name AS "emergencyContactName",
                up.emergency_contact_phone AS "emergencyContactPhone"
            FROM users u
            LEFT JOIN companies c ON u.company_id = c.id
            LEFT JOIN user_profiles up ON u.id = up.user_id
            LEFT JOIN marital_statuses ms ON up.marital_status_id = ms.id
            LEFT JOIN positions p ON u.position_id = p.id
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN employee_statuses es ON u.employee_status_id = es.id
            LEFT JOIN employee_levels el ON u.employee_level_id = el.id
            LEFT JOIN user_profiles sup_p ON u.supervisor_id = sup_p.user_id
            LEFT JOIN user_profiles mgr_p ON u.manager_id = mgr_p.user_id
            LEFT JOIN work_schedules ws ON u.work_schedule_id = ws.id
            WHERE u.id = $1
        `;
        const result = await db.query(sql, [req.userId]);
        if (result.rows.length === 0) return res.status(404).send({ message: "User not found." });
        res.status(200).send(result.rows[0]);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

exports.updateMyProfile = async (req, res) => {
    const { userId } = req;
    const { phoneNumber, emergencyContactName, emergencyContactPhone, currentPassword, newPassword } = req.body;
    const avatarFile    = req.files?.['avatar']?.[0];
    const facePhotoFile = req.files?.['face_photo']?.[0];
    const avatarUrl     = avatarFile    ? `/uploads/${avatarFile.filename}`    : null;
    const facePhotoUrl  = facePhotoFile ? `/uploads/${facePhotoFile.filename}` : null;

    // Validate password change if requested
    if (currentPassword) {
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).send({ message: "New password must be at least 6 characters." });
        }
        const userRow = await db.query("SELECT password FROM users WHERE id = $1", [userId]);
        const stored = userRow.rows[0]?.password;
        if (!stored || !bcrypt.compareSync(currentPassword, stored)) {
            return res.status(401).send({ message: "Current password is incorrect." });
        }
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        if (avatarUrl) {
            await client.query(`UPDATE users SET avatar_url = $1 WHERE id = $2`, [avatarUrl, userId]);
        }
        if (facePhotoUrl) {
            await client.query(`UPDATE users SET face_photo_url = $1 WHERE id = $2`, [facePhotoUrl, userId]);
        }

        if (currentPassword && newPassword) {
            const hashed = bcrypt.hashSync(newPassword, 8);
            await client.query(`UPDATE users SET password = $1 WHERE id = $2`, [hashed, userId]);
        }

        await client.query(`
            INSERT INTO user_profiles (user_id, phone_number, emergency_contact_name, emergency_contact_phone)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id) DO UPDATE SET
                phone_number = $2,
                emergency_contact_name = $3,
                emergency_contact_phone = $4,
                updated_at = NOW()
        `, [userId, phoneNumber || null, emergencyContactName || null, emergencyContactPhone || null]);

        await client.query('COMMIT');

        const result = await db.query(`
            SELECT u.avatar_url AS "avatarUrl",
                   u.face_photo_url AS "facePhotoUrl",
                   up.phone_number AS "phoneNumber",
                   up.emergency_contact_name AS "emergencyContactName",
                   up.emergency_contact_phone AS "emergencyContactPhone"
            FROM users u
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE u.id = $1
        `, [userId]);
        res.send(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error updating profile:", error);
        res.status(500).send({ message: "Failed to update profile." });
    } finally {
        client.release();
    }
};

exports.getUserSchedule = async (req, res) => {
    const { userId } = req;
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1;

    try {
        const sql = `
            WITH user_details AS (
                SELECT id, company_id FROM users WHERE id = $3
            ),
            month_dates AS (
                SELECT generate_series(
                    make_date($1, $2, 1),
                    (make_date($1, $2, 1) + '1 month'::interval - '1 day'::interval)::date,
                    '1 day'::interval
                )::date AS assignment_date
            ),
            -- Approved absence requests for this user that cover dates in the requested month.
            -- Used as a fallback when no daily_schedule_assignments row exists for a date.
            approved_absences AS (
                SELECT gs.d::date AS assignment_date, r.absence_type_id
                FROM requests r
                CROSS JOIN LATERAL generate_series(r.start_date::date, r.end_date::date, '1 day'::interval) AS gs(d)
                WHERE r.user_id = $3
                  AND r.status = 'approved'
                  AND r.absence_type_id IS NOT NULL
                  AND EXTRACT(YEAR FROM gs.d::date) = $1
                  AND EXTRACT(MONTH FROM gs.d::date) = $2
            )
            SELECT
                TO_CHAR(md.assignment_date, 'YYYY-MM-DD') AS assignment_date,
                CASE
                    WHEN COALESCE(dsa.absence_type_id, aa.absence_type_id) IS NOT NULL THEN 'absence'
                    WHEN dsa.work_schedule_id IS NOT NULL THEN 'work'
                    ELSE 'off'
                END AS assignment_type,
                ws.code AS work_schedule_code,
                ws.name AS work_schedule_name,
                ws.start_time,
                ws.end_time,
                at.code AS absence_code,
                at.name AS absence_name
            FROM month_dates md
            CROSS JOIN user_details ud
            LEFT JOIN daily_schedule_assignments dsa
                ON dsa.user_id = ud.id
                AND dsa.assignment_date = md.assignment_date
            LEFT JOIN approved_absences aa
                ON aa.assignment_date = md.assignment_date
            LEFT JOIN work_schedules ws
                ON ws.id = dsa.work_schedule_id
                AND ws.company_id = ud.company_id
            LEFT JOIN absence_types at
                ON at.id = COALESCE(dsa.absence_type_id, aa.absence_type_id)
                AND at.company_id = ud.company_id
            ORDER BY md.assignment_date;
        `;
        const result = await db.query(sql, [year, month, userId]);
        res.status(200).send(result.rows);
    } catch (error) {
        console.error("Error fetching user schedule:", error);
        res.status(500).send({ message: "An error occurred while fetching the schedule." });
    }
};

exports.getTodaySchedule = async (req, res) => {
    const { userId } = req;
    const today = new Date().toISOString().split('T')[0];

    try {
        // 1. Check for a specific assignment for today
        const assignmentSql = `
            SELECT
                CASE
                    WHEN dsa.absence_type_id IS NOT NULL THEN 'absence'
                    WHEN dsa.work_schedule_id IS NOT NULL THEN 'work'
                    ELSE 'off'
                END AS assignment_type,
                ws.name AS work_schedule_name,
                ws.start_time,
                ws.end_time,
                at.name AS absence_name,
                at.code AS absence_code
            FROM daily_schedule_assignments dsa
            LEFT JOIN work_schedules ws ON ws.id = dsa.work_schedule_id
            LEFT JOIN absence_types at ON at.id = dsa.absence_type_id
            WHERE dsa.user_id = $1 AND dsa.assignment_date = $2;
        `;
        const assignmentResult = await db.query(assignmentSql, [userId, today]);

        if (assignmentResult.rows.length > 0) {
            return res.status(200).send(assignmentResult.rows[0]);
        }

        // 2. If no specific assignment, check for the user's default schedule
        const defaultScheduleSql = `
            SELECT
                'work' as assignment_type,
                ws.name as work_schedule_name,
                ws.start_time,
                ws.end_time
            FROM users u
            JOIN work_schedules ws ON u.work_schedule_id = ws.id
            WHERE u.id = $1;
        `;
        const defaultResult = await db.query(defaultScheduleSql, [userId]);

        if (defaultResult.rows.length > 0) {
            return res.status(200).send(defaultResult.rows[0]);
        }

        // 3. If no assignment and no default, it's a day off
        return res.status(200).send({ assignment_type: 'off', absence_name: 'Day Off' });

    } catch (error) {
        console.error("Error fetching today's schedule:", error);
        res.status(500).send({ message: "An error occurred while fetching today's schedule." });
    }
};

exports.getAttendanceKpi = async (req, res) => {
    const { userId, companyId } = req;
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate   = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    try {
        // Same JOIN pattern as getAttendanceHistory (which correctly shows Late in history view)
        const sql = `
            SELECT
                a.id,
                a.status,
                a.check_in_time,
                a.created_at,
                COALESCE(ws.start_time, ws_default.start_time) AS "schedStart"
            FROM attendance a
            LEFT JOIN daily_schedule_assignments dsa
                ON a.user_id = dsa.user_id
                AND DATE(COALESCE(a.check_in_time, a.created_at)) = dsa.assignment_date
                AND dsa.company_id = $2
            LEFT JOIN work_schedules ws ON dsa.work_schedule_id = ws.id
            LEFT JOIN users u ON a.user_id = u.id
            LEFT JOIN work_schedules ws_default ON u.work_schedule_id = ws_default.id
            WHERE
                a.user_id = $1
                AND a.company_id = $2
                AND a.created_at >= $3
                AND a.created_at < $4
            ORDER BY a.check_in_time ASC NULLS LAST
        `;

        const result = await db.query(sql, [userId, companyId, startDate, endDate]);

        // Deduplicate: keep only first (earliest) record per calendar day (WIB UTC+7)
        const WIB_MS = 7 * 60 * 60 * 1000;
        const seenDays = new Set();
        const daily = [];
        for (const row of result.rows) {
            const ref = row.check_in_time || row.created_at;
            const dayKey = new Date(new Date(ref).getTime() + WIB_MS).toISOString().substring(0, 10);
            if (!seenDays.has(dayKey)) {
                seenDays.add(dayKey);
                daily.push(row);
            }
        }

        console.log('[KPI] daily rows:', daily.map(r => ({
            status: r.status,
            check_in_time: r.check_in_time,
            schedStart: r.schedStart
        })));

        let onTime = 0, late = 0, absent = 0;

        for (const row of daily) {
            if (row.status === 'absent') {
                absent++;
            } else if (row.status === 'present' && row.check_in_time && row.schedStart) {
                // Mirror history.js logic: compare in WIB (UTC+7)
                const checkIn    = new Date(row.check_in_time);
                const checkInWIB = new Date(checkIn.getTime() + WIB_MS);
                const checkInMins = checkInWIB.getUTCHours() * 60 + checkInWIB.getUTCMinutes();

                const parts    = row.schedStart.toString().substring(0, 5).split(':');
                const schedMins = parseInt(parts[0]) * 60 + parseInt(parts[1]);

                console.log('[KPI] check_in WIB mins:', checkInMins, 'sched mins:', schedMins, 'late:', checkInMins > schedMins);

                if (checkInMins > schedMins) late++;
                else onTime++;
            } else if (row.status === 'present') {
                onTime++;
            }
        }

        res.status(200).send({ onTime, late, absent });
    } catch (error) {
        console.error("Error fetching attendance KPI:", error);
        res.status(500).send({ message: "An error occurred while fetching attendance KPI data." });
    }
};

exports.getAbsenceTypesForUser = async (req, res) => {
    const { companyId } = req;

    try {
        // Mengambil semua tipe absensi dengan kategori 'leave' untuk perusahaan pengguna
        // Ini memungkinkan admin untuk mengkonfigurasi jenis cuti apa saja yang bisa diajukan
        const sql = `
            SELECT id, code, name, description
            FROM absence_types
            WHERE company_id = $1 AND category = 'leave'
            ORDER BY name ASC
        `;
        const result = await db.query(sql, [companyId]);
        res.status(200).send(result.rows);
    } catch (error) {
        console.error("Error fetching absence types for user:", error);
        res.status(500).send({ message: "An error occurred while fetching absence types." });
    }
};

exports.getLeaveBalance = async (req, res) => {
    const { userId, companyId } = req;
    // Jatah cuti tahunan, bisa dibuat dinamis dari database di masa depan
    const ANNUAL_LEAVE_ENTITLEMENT = 12;
    const ANNUAL_LEAVE_CODE = 'AL'; // Kode standar untuk Cuti Tahunan

    try {
        // 0. Ambil tanggal mulai kontrak pengguna
        const userRes = await db.query("SELECT contract_start_date, join_date FROM users WHERE id = $1", [userId]);
        if (userRes.rows.length === 0) {
            return res.status(404).send({ message: "User not found." });
        }
        
        // Prioritaskan contract_start_date, fallback ke join_date
        const referenceDate = userRes.rows[0].contract_start_date || userRes.rows[0].join_date;

        if (!referenceDate) {
            // Jika tidak ada tanggal referensi, tidak bisa menghitung sisa cuti.
            // Kembalikan jatah penuh agar tidak merugikan pengguna.
            console.warn(`User ${userId} has no contract_start_date or join_date. Returning full leave entitlement.`);
            return res.status(200).send({ remainingDays: ANNUAL_LEAVE_ENTITLEMENT });
        }

        // Tentukan awal periode cuti saat ini berdasarkan tanggal referensi (kontrak/join)
        const today = new Date();
        const refDate = new Date(referenceDate);
        let currentLeavePeriodStart = new Date(today.getFullYear(), refDate.getMonth(), refDate.getDate());
        
        // Jika hari ini lebih awal dari tanggal anniversary di tahun ini, berarti kita masih di periode tahun lalu
        if (today < currentLeavePeriodStart) {
            currentLeavePeriodStart.setFullYear(currentLeavePeriodStart.getFullYear() - 1);
        }
        const currentLeavePeriodEnd = new Date(currentLeavePeriodStart);
        currentLeavePeriodEnd.setFullYear(currentLeavePeriodEnd.getFullYear() + 1);

        // 1. Dapatkan ID untuk tipe absensi 'Cuti Tahunan' (AL) di perusahaan ini
        const absenceTypeRes = await db.query(
            "SELECT id FROM absence_types WHERE company_id = $1 AND code = $2 AND category = 'leave'",
            [companyId, ANNUAL_LEAVE_CODE]
        );

        if (absenceTypeRes.rows.length === 0) {
            // Jika tipe 'AL' tidak dikonfigurasi untuk perusahaan ini, kembalikan jatah penuh
            return res.status(200).send({ remainingDays: ANNUAL_LEAVE_ENTITLEMENT });
        }
        const annualLeaveTypeId = absenceTypeRes.rows[0].id;

        // 2. Hitung total hari cuti tahunan yang sudah disetujui ('approved') dalam periode kontrak/cuti saat ini
        const takenDaysRes = await db.query(
            `SELECT SUM(end_date - start_date + 1) AS total_taken
             FROM requests
             WHERE user_id = $1
               AND absence_type_id = $2
               AND status = 'approved'
               AND start_date >= $3 AND start_date < $4`,
            [userId, annualLeaveTypeId, fmtLocal(currentLeavePeriodStart), fmtLocal(currentLeavePeriodEnd)]
        );

        const totalTakenDays = parseInt(takenDaysRes.rows[0].total_taken, 10) || 0;

        // 3. Hitung sisa cuti
        const remainingDays = ANNUAL_LEAVE_ENTITLEMENT - totalTakenDays;

        res.status(200).send({ remainingDays });
    } catch (error) {
        console.error("Error fetching leave balance:", error);
        res.status(500).send({ message: "An error occurred while fetching leave balance." });
    }
};

// More specific user queries can be added here
// For example, get all users (admin only)

exports.getAllUsers = (req, res) => {
    const companyId = req.companyId;

    db.query("SELECT id, username, email, role FROM users WHERE company_id = $1 ORDER BY id ASC", [companyId])
        .then(result => {
            res.status(200).send(result.rows);
        })
        .catch(err => {
            res.status(500).send({ message: err.message });
        });
};
