const db = require("../db");

// Format local Date ke "YYYY-MM-DD" tanpa UTC shift (hindari toISOString yang menggeser hari)
const fmtLocal = (d) =>
    `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

// Helper untuk memformat tanggal ke YYYY-MM-DD tanpa konversi timezone
const formatDate = (date) => {
    if (!date || date === '') return null;
    const s = String(date).substring(0, 10); // ambil "YYYY-MM-DD" langsung
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

exports.updateEmployeeProfile = async (req, res) => {
    const { userId } = req.params;
    const { companyId } = req; // Diambil dari token via middleware authJwt

    // Ambil semua data yang mungkin dikirim dari form
    const {
        fullName,
        phoneNumber,
        dateOfBirth,
        gender,
        maritalStatus,
        religion,
        address,
        emergencyContactName,
        emergencyContactPhone,
        positionId,
        departmentId,
        employeeStatusId,
        employeeLevelId,
        joinDate,
        employeeNik,
        contractStartDate,
        contractEndDate,
        supervisorId,
        managerId,
        annualLeaveAdjustment
    } = req.body;

    const client = await db.connect();

    try {
        await client.query('BEGIN');

        // 1. Update tabel 'users' dengan informasi terkait pekerjaan dan kontrak
        const userUpdateQuery = `
            UPDATE users SET
                position_id = $1,
                department_id = $2,
                employee_status_id = $3,
                employee_level_id = $4,
                join_date = $5,
                employee_nik = $6,
                contract_start_date = $7,
                contract_end_date = $8,
                supervisor_id = $9,
                manager_id = $10
            WHERE id = $11 AND company_id = $12
        `;
        await client.query(userUpdateQuery, [
            positionId || null,
            departmentId || null,
            employeeStatusId || null,
            employeeLevelId || null,
            formatDate(joinDate),
            employeeNik || null,
            formatDate(contractStartDate),
            formatDate(contractEndDate),
            supervisorId || null,
            managerId || null,
            userId,
            companyId
        ]);

        // 2. Resolve marital status name → id
        let maritalStatusId = null;
        if (maritalStatus) {
            const msRes = await client.query(
                "SELECT id FROM marital_statuses WHERE company_id = $1 AND name = $2",
                [companyId, maritalStatus]
            );
            maritalStatusId = msRes.rows[0]?.id || null;
        }

        // 3. Update atau buat data di tabel 'user_profiles' dengan info personal
        const profileUpdateQuery = `
            INSERT INTO user_profiles (
                user_id, full_name, phone_number, date_of_birth, gender,
                marital_status_id, religion, address, emergency_contact_name,
                emergency_contact_phone
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
                updated_at = NOW()
        `;
        await client.query(profileUpdateQuery, [
            userId,
            fullName,
            phoneNumber,
            formatDate(dateOfBirth),
            gender,
            maritalStatusId,
            religion,
            address,
            emergencyContactName,
            emergencyContactPhone
        ]);

        // 4. Update annual leave adjustment jika dikirim
        if (annualLeaveAdjustment != null && !isNaN(parseInt(annualLeaveAdjustment, 10))) {
            await client.query(
                `INSERT INTO user_profiles (user_id, annual_leave_adjustment)
                 VALUES ($1, $2)
                 ON CONFLICT (user_id) DO UPDATE SET annual_leave_adjustment = $2, updated_at = NOW()`,
                [userId, parseInt(annualLeaveAdjustment, 10)]
            );
        }

        await client.query('COMMIT');
        res.status(200).send({ message: "Employee profile updated successfully." });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error updating employee profile:", error);
        res.status(500).send({ message: "An error occurred while updating the employee profile." });
    } finally {
        client.release();
    }
};

exports.getEmployeeExtraDetails = async (req, res) => {
    const { userId } = req.params;
    const { companyId } = req;
    const ANNUAL_LEAVE_ENTITLEMENT = 12; // Bisa dibuat dinamis di masa depan
    const ANNUAL_LEAVE_CODE = 'AL';

    try {
        // 1. Ambil tanggal kontrak/join, tanggal akhir kontrak, supervisor, dan manager
        const userRes = await db.query(`
            SELECT u.contract_start_date, u.join_date, u.contract_end_date,
                   u.supervisor_id, u.manager_id,
                   sup_p.full_name AS supervisor_name,
                   mgr_p.full_name AS manager_name,
                   COALESCE(up.annual_leave_adjustment, 0) AS annual_leave_adjustment
            FROM users u
            LEFT JOIN user_profiles up ON u.id = up.user_id
            LEFT JOIN user_profiles sup_p ON u.supervisor_id = sup_p.user_id
            LEFT JOIN user_profiles mgr_p ON u.manager_id = mgr_p.user_id
            WHERE u.id = $1 AND u.company_id = $2
        `, [userId, companyId]);

        if (userRes.rows.length === 0) {
            return res.status(404).send({ message: "User not found." });
        }

        const { contract_start_date, join_date, contract_end_date,
                supervisor_id, manager_id, supervisor_name, manager_name,
                annual_leave_adjustment } = userRes.rows[0];
        const referenceDate = contract_start_date || join_date;
        const leaveAdjustment = parseInt(annual_leave_adjustment, 10) || 0;
        let takenDays = 0;
        let remainingLeave = ANNUAL_LEAVE_ENTITLEMENT + leaveAdjustment;

        // 2. Hitung sisa cuti jika ada tanggal referensi
        if (referenceDate) {
            const today = new Date();
            const refDate = new Date(referenceDate);
            let currentLeavePeriodStart = new Date(today.getFullYear(), refDate.getMonth(), refDate.getDate());

            if (today < currentLeavePeriodStart) {
                currentLeavePeriodStart.setFullYear(currentLeavePeriodStart.getFullYear() - 1);
            }
            const currentLeavePeriodEnd = new Date(currentLeavePeriodStart);
            currentLeavePeriodEnd.setFullYear(currentLeavePeriodEnd.getFullYear() + 1);

            const absenceTypeRes = await db.query(
                "SELECT id FROM absence_types WHERE company_id = $1 AND code = $2 AND category = 'leave'",
                [companyId, ANNUAL_LEAVE_CODE]
            );

            if (absenceTypeRes.rows.length > 0) {
                const annualLeaveTypeId = absenceTypeRes.rows[0].id;
                const takenDaysRes = await db.query(
                    `SELECT SUM(end_date - start_date + 1) AS total_taken
                     FROM requests
                     WHERE user_id = $1 AND absence_type_id = $2 AND status = 'approved' AND start_date >= $3 AND start_date < $4`,
                    [userId, annualLeaveTypeId, fmtLocal(currentLeavePeriodStart), fmtLocal(currentLeavePeriodEnd)]
                );
                takenDays = parseInt(takenDaysRes.rows[0].total_taken, 10) || 0;
                remainingLeave = ANNUAL_LEAVE_ENTITLEMENT + leaveAdjustment - takenDays;
            }
        }

        res.status(200).send({
            remainingLeave: remainingLeave,
            leaveEntitlement: ANNUAL_LEAVE_ENTITLEMENT,
            leaveAdjustment: leaveAdjustment,
            leaveTaken: takenDays,
            contractStartDate: contract_start_date,
            contractEndDate: contract_end_date,
            supervisorId: supervisor_id,
            supervisorName: supervisor_name,
            managerId: manager_id,
            managerName: manager_name
        });

    } catch (error) {
        console.error("Error fetching employee extra details:", error);
        res.status(500).send({ message: "An error occurred while fetching extra details." });
    }
};

exports.updateLeaveAdjustment = async (req, res) => {
    const { userId } = req.params;
    const { companyId } = req;
    const adjustment = parseInt(req.body.adjustment, 10);

    if (isNaN(adjustment)) {
        return res.status(400).send({ message: "Nilai adjustment harus berupa angka." });
    }

    try {
        // Pastikan user milik perusahaan ini
        const userCheck = await db.query(
            'SELECT id FROM users WHERE id = $1 AND company_id = $2',
            [userId, companyId]
        );
        if (userCheck.rows.length === 0) {
            return res.status(404).send({ message: "Employee not found." });
        }

        await db.query(
            `INSERT INTO user_profiles (user_id, annual_leave_adjustment)
             VALUES ($1, $2)
             ON CONFLICT (user_id) DO UPDATE SET annual_leave_adjustment = $2, updated_at = CURRENT_TIMESTAMP`,
            [userId, adjustment]
        );

        res.status(200).send({ message: "Leave adjustment updated.", adjustment });
    } catch (error) {
        console.error("Error updating leave adjustment:", error);
        res.status(500).send({ message: "An error occurred while updating leave adjustment." });
    }
};

exports.getCompanyDetails = async (req, res) => {
    const { companyId } = req;
    try {
        const result = await db.query(
            "SELECT id, name, address, subscription_status, created_at AS \"createdAt\" FROM companies WHERE id = $1",
            [companyId]
        );
        if (result.rows.length === 0) {
            return res.status(404).send({ message: "Company not found." });
        }
        res.status(200).send(result.rows[0]);
    } catch (error) {
        console.error("Error fetching company details:", error);
        res.status(500).send({ message: "An error occurred while fetching company details." });
    }
};

exports.getCompanyLocation = async (req, res) => {
    const { companyId } = req;
    try {
        const result = await db.query(
            "SELECT office_latitude AS \"latitude\", office_longitude AS \"longitude\", office_radius AS \"radius\" FROM companies WHERE id = $1",
            [companyId]
        );
        if (result.rows.length === 0) {
            return res.status(404).send({ message: "Company not found." });
        }
        // Jika nilai masih null (belum pernah di-set), kembalikan null agar frontend tahu
        const location = result.rows[0];
        res.status(200).send({
            latitude: location.latitude ? parseFloat(location.latitude) : null,
            longitude: location.longitude ? parseFloat(location.longitude) : null,
            radius: location.radius ? parseInt(location.radius, 10) : null,
        });
    } catch (error) {
        console.error("Error fetching company location:", error);
        res.status(500).send({ message: "An error occurred while fetching company location." });
    }
};

exports.updateCompanyLocation = async (req, res) => {
    const { companyId } = req;
    const { latitude, longitude, radius } = req.body;

    // Validasi sederhana
    if (latitude === undefined || longitude === undefined || radius === undefined) {
        return res.status(400).send({ message: "Latitude, longitude, and radius are required." });
    }

    try {
        const sql = `
            UPDATE companies
            SET office_latitude = $1, office_longitude = $2, office_radius = $3
            WHERE id = $4
        `;
        await db.query(sql, [latitude, longitude, radius, companyId]);
        res.status(200).send({ message: "Company location updated successfully." });
    } catch (error) {
        console.error("Error updating company location:", error);
        res.status(500).send({ message: "An error occurred while updating company location." });
    }
};

exports.getDashboardStats = async (req, res) => {
    const { companyId } = req;
    const { departmentId } = req.query; // Ambil departmentId dari query string

    try {
        // --- Bangun klausa WHERE dinamis untuk filter departemen ---
        const userFilterClauses = ["u.company_id = $1", "u.role = 'user'", "u.is_active = TRUE"];
        const queryParams = [companyId];

        if (departmentId && /^\d+$/.test(departmentId)) {
            queryParams.push(departmentId);
            userFilterClauses.push(`u.department_id = $${queryParams.length}`);
        }
        const userWhereClause = userFilterClauses.join(' AND ');

        // --- Jalankan query secara paralel ---
        const [totalEmployeesRes, presentTodayRes, absentTodayRes, pendingRequestsRes] = await Promise.all([
            // Total karyawan aktif (dengan filter)
            db.query(
                `SELECT COUNT(*)::int FROM users u WHERE ${userWhereClause}`,
                queryParams
            ),
            // Karyawan yang hadir hari ini (dengan filter)
            db.query(
                `SELECT COUNT(DISTINCT a.user_id)::int
                 FROM attendance a
                 JOIN users u ON a.user_id = u.id
                 WHERE a.status = 'present' AND DATE(a.check_in_time) = CURRENT_DATE AND ${userWhereClause}`,
                queryParams
            ),
            // Karyawan yang absen hari ini (berdasarkan catatan eksplisit)
            db.query(
                `SELECT COUNT(DISTINCT a.user_id)::int
                 FROM attendance a
                 JOIN users u ON a.user_id = u.id
                 WHERE a.status = 'absent' AND DATE(COALESCE(a.check_in_time, a.created_at)) = CURRENT_DATE AND ${userWhereClause}`,
                queryParams
            ),
            // Pengajuan cuti/izin yang masih pending (global untuk perusahaan)
            db.query(
                "SELECT COUNT(*)::int FROM requests WHERE company_id = $1 AND status = 'pending'",
                [companyId]
            )
        ]);

        const totalEmployees = totalEmployeesRes.rows[0]?.count || 0;
        const presentToday = presentTodayRes.rows[0]?.count || 0;
        const absentToday = absentTodayRes.rows[0]?.count || 0;
        const pendingRequests = pendingRequestsRes.rows[0]?.count || 0;

        res.status(200).send({
            totalEmployees,
            presentToday,
            absentToday,
            pendingRequests
        });

    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        res.status(500).send({ message: "An error occurred while fetching dashboard statistics." });
    }
};

exports.getAllRequests = async (req, res) => {
    const { companyId } = req;
    const { status } = req.query; // 'pending', 'approved', 'rejected', or 'history' (approved+rejected)

    let statusFilter = "";
    const queryParams = [companyId];

    if (status && status !== 'all') {
        if (status === 'history') {
            statusFilter = "AND r.status IN ('approved', 'rejected')";
        } else {
            queryParams.push(status);
            statusFilter = `AND r.status = $${queryParams.length}`;
        }
    }

    try {
        const sql = `
            SELECT
                r.id,
                r.user_id AS "userId",
                r.request_type AS "requestType",
                r.start_date AS "startDate",
                r.end_date AS "endDate",
                r.reason,
                r.status,
                r.attachment_url AS "attachmentUrl",
                r.processor_notes AS "processorNotes",
                r.processed_at AS "processedAt",
                r.created_at AS "submittedDate",
                r.target_date AS "targetDate",
                r.target_schedule_id AS "targetScheduleId",
                r.level1_status AS "level1Status",
                r.level1_processed_at AS "level1ProcessedAt",
                r.level1_notes AS "level1Notes",
                up.full_name AS "fullName",
                u.avatar_url AS "avatarUrl",
                COALESCE(at.name, r.request_type::text) AS "requestTypeName",
                proc_up.full_name AS "processedByName",
                ws.name AS "targetScheduleName",
                TO_CHAR(ws.start_time, 'HH24:MI') AS "targetScheduleStart",
                TO_CHAR(ws.end_time, 'HH24:MI') AS "targetScheduleEnd",
                COALESCE(l1_up.full_name, l1_u.username) AS "level1ApproverName",
                COALESCE(col_up.full_name, col_u.username) AS "colleagueName"
            FROM requests r
            JOIN users u ON r.user_id = u.id
            LEFT JOIN user_profiles up ON u.id = up.user_id
            LEFT JOIN absence_types at ON r.absence_type_id = at.id
            LEFT JOIN users proc ON r.processed_by = proc.id
            LEFT JOIN user_profiles proc_up ON proc.id = proc_up.user_id
            LEFT JOIN work_schedules ws ON r.target_schedule_id = ws.id
            LEFT JOIN users l1_u ON r.level1_approver_id = l1_u.id
            LEFT JOIN user_profiles l1_up ON l1_u.id = l1_up.user_id
            LEFT JOIN users col_u ON r.colleague_id = col_u.id
            LEFT JOIN user_profiles col_up ON col_u.id = col_up.user_id
            WHERE r.company_id = $1 ${statusFilter}
            ORDER BY r.created_at DESC
        `;
        const result = await db.query(sql, queryParams);
        res.status(200).send(result.rows);
    } catch (error) {
        console.error("Error fetching all requests:", error);
        res.status(500).send({ message: "An error occurred while fetching requests." });
    }
};

exports.deleteRequest = async (req, res) => {
    const { companyId } = req;
    const { requestId } = req.params;

    try {
        const result = await db.query(
            `DELETE FROM requests WHERE id = $1 AND company_id = $2 RETURNING id`,
            [requestId, companyId]
        );
        if (result.rows.length === 0) {
            return res.status(404).send({ message: "Request not found or not authorized." });
        }
        res.status(200).send({ message: "Request deleted successfully." });
    } catch (error) {
        console.error("Error deleting request:", error);
        res.status(500).send({ message: "An error occurred while deleting the request." });
    }
};

exports.updateRequestStatus = async (req, res) => {
    const { companyId, userId } = req;
    const { requestId } = req.params;
    const { status, processorNotes } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).send({ message: "Invalid status provided." });
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        // Fetch the request to check type and level1 status
        const fetchResult = await client.query(
            `SELECT request_type, level1_status, user_id,
                    start_date, end_date, absence_type_id,
                    target_date, target_schedule_id
             FROM requests WHERE id = $1 AND company_id = $2 AND status = 'pending'`,
            [requestId, companyId]
        );

        if (fetchResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).send({ message: "Request not found, not pending, or you do not have permission to update it." });
        }

        const pending = fetchResult.rows[0];

        // For change_schedule: block approval if supervisor hasn't acted yet
        if (pending.request_type === 'change_schedule' && status === 'approved' && pending.level1_status === 'pending') {
            await client.query('ROLLBACK');
            return res.status(400).send({ message: "This request is awaiting supervisor approval first." });
        }

        await client.query(
            `UPDATE requests
             SET status = $1, processed_by = $2, processed_at = NOW(), processor_notes = $3
             WHERE id = $4 AND company_id = $5`,
            [status, userId, processorNotes || null, requestId, companyId]
        );

        // Auto-apply schedule change when change_schedule request is approved
        if (pending.request_type === 'change_schedule' && status === 'approved' && pending.target_date && pending.target_schedule_id) {
            await client.query(`
                INSERT INTO daily_schedule_assignments (user_id, company_id, assignment_date, work_schedule_id, absence_type_id)
                VALUES ($1, $2, $3, $4, NULL)
                ON CONFLICT (company_id, user_id, assignment_date) DO UPDATE SET
                    work_schedule_id = EXCLUDED.work_schedule_id,
                    absence_type_id = NULL,
                    updated_at = NOW()
            `, [pending.user_id, companyId, pending.target_date, pending.target_schedule_id]);
        }

        // Auto-mark schedule as absent when a leave/absence request is approved
        if (status === 'approved' && pending.absence_type_id && pending.start_date && pending.end_date) {
            await client.query(`
                INSERT INTO daily_schedule_assignments (user_id, company_id, assignment_date, work_schedule_id, absence_type_id)
                SELECT $1, $2, d::date, NULL, $3
                FROM generate_series($4::date, $5::date, '1 day') AS d
                ON CONFLICT (company_id, user_id, assignment_date) DO UPDATE SET
                    work_schedule_id = NULL,
                    absence_type_id = EXCLUDED.absence_type_id,
                    updated_at = NOW()
            `, [pending.user_id, companyId, pending.absence_type_id, pending.start_date, pending.end_date]);
        }

        await client.query('COMMIT');
        res.status(200).send({ message: `Request has been successfully ${status}.` });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error updating request status:", error);
        res.status(500).send({ message: "An error occurred while updating the request status." });
    } finally {
        client.release();
    }
};

exports.getRecentRequests = async (req, res) => {
    const { companyId } = req;
    try {
        const sql = `
            SELECT
                r.id, r.start_date AS "startDate", r.end_date AS "endDate", r.status,
                up.full_name AS "fullName", u.avatar_url AS "avatarUrl", at.name AS "requestTypeName"
            FROM requests r
            JOIN users u ON r.user_id = u.id
            LEFT JOIN user_profiles up ON u.id = up.user_id
            JOIN absence_types at ON r.absence_type_id = at.id
            WHERE r.company_id = $1
            ORDER BY r.created_at DESC
            LIMIT 5
        `;
        const result = await db.query(sql, [companyId]);
        res.status(200).send(result.rows);
    } catch (error) {
        console.error("Error fetching recent requests:", error);
        res.status(500).send({ message: "An error occurred while fetching recent requests." });
    }
};

exports.getWeeklyAttendance = async (req, res) => {
    const { companyId } = req;
    // Get endDate from query. Default to today if not provided or invalid.
    const { endDate: endDateParam, departmentId } = req.query;
    const isValidDate = endDateParam && /^\d{4}-\d{2}-\d{2}$/.test(endDateParam);
    const targetEndDate = isValidDate ? endDateParam : 'CURRENT_DATE';

    try {
        // --- Bangun parameter dan kondisi untuk query absensi ---
        const attendanceQueryParams = [companyId, targetEndDate];
        let attendanceUserJoinCondition = '';
        if (departmentId && /^\d+$/.test(departmentId)) {
            attendanceQueryParams.push(departmentId);
            attendanceUserJoinCondition = `AND u.department_id = $${attendanceQueryParams.length}`;
        }

        // 2. Dapatkan jumlah kehadiran dan absensi harian untuk 7 hari yang berakhir pada targetEndDate
        const attendanceSql = `
            WITH date_series AS (
                SELECT generate_series(($2)::date - interval '6 days', ($2)::date, '1 day')::date AS day
            )
            SELECT
                TO_CHAR(ds.day, 'Dy, DD') AS label,
                COALESCE(p.present_count, 0)::int AS present_count,
                COALESCE(p.absent_count, 0)::int AS absent_count,
                COALESCE(p.on_leave_count, 0)::int AS on_leave_count
            FROM date_series ds
            LEFT JOIN (
                SELECT
                    DATE(COALESCE(a.check_in_time, a.created_at)) AS attendance_date,
                    COUNT(DISTINCT a.user_id) FILTER (WHERE a.status = 'present')::int AS present_count,
                    COUNT(DISTINCT a.user_id) FILTER (WHERE a.status = 'absent')::int AS absent_count,
                    COUNT(DISTINCT a.user_id) FILTER (WHERE a.status IN ('on_leave', 'sick'))::int AS on_leave_count
                FROM attendance a
                JOIN users u ON a.user_id = u.id
                WHERE
                    a.company_id = $1
                    AND DATE(COALESCE(a.check_in_time, a.created_at)) >= (($2)::date - interval '6 days')
                    AND DATE(COALESCE(a.check_in_time, a.created_at)) < (($2)::date + interval '1 day')
                    AND a.status IN ('present', 'absent', 'on_leave', 'sick')
                    AND u.is_active = TRUE AND u.role = 'user'
                    ${attendanceUserJoinCondition} -- Filter departemen dinamis
                GROUP BY attendance_date
            ) p ON ds.day = p.attendance_date
            ORDER BY ds.day ASC;
        `;

        const attendanceResult = await db.query(attendanceSql, attendanceQueryParams);

        // 3. Process the data into the format required by Chart.js
        const labels = attendanceResult.rows.map(row => row.label);
        const presentData = attendanceResult.rows.map(row => row.present_count);
        const absentData = attendanceResult.rows.map(row => row.absent_count);
        const onLeaveData = attendanceResult.rows.map(row => row.on_leave_count);

        // 4. Send the formatted data
        res.status(200).send({
            labels,
            datasets: [
                {
                    label: 'Present', data: presentData, backgroundColor: 'rgba(59, 130, 246, 0.5)',
                    borderColor: 'rgba(59, 130, 246, 1)', borderWidth: 2, borderRadius: 5, tension: 0.4
                },
                {
                    label: 'Absent', data: absentData, backgroundColor: 'rgba(239, 68, 68, 0.5)',
                    borderColor: 'rgba(239, 68, 68, 1)', borderWidth: 2, borderRadius: 5, tension: 0.4
                },
                {
                    label: 'On Leave', data: onLeaveData, backgroundColor: 'rgba(249, 115, 22, 0.5)', // orange-500
                    borderColor: 'rgba(249, 115, 22, 1)', borderWidth: 2, borderRadius: 5, tension: 0.4
                }
            ]
        });

    } catch (error) {
        console.error("Error fetching weekly attendance data:", error);
        res.status(500).send({ message: "An error occurred while fetching weekly attendance data." });
    }
};

exports.getGenderDistribution = async (req, res) => {
    const { companyId } = req;
    const { departmentId } = req.query;

    try {
        const queryParams = [companyId];
        let userWhereClause = "u.company_id = $1 AND u.is_active = TRUE AND u.role = 'user'";

        if (departmentId && /^\d+$/.test(departmentId)) {
            queryParams.push(departmentId);
            userWhereClause += ` AND u.department_id = $${queryParams.length}`;
        }

        const sql = `
            SELECT
                CASE
                    WHEN up.gender = 'Laki-laki' THEN 'Laki-laki'
                    WHEN up.gender = 'Perempuan' THEN 'Perempuan'
                    ELSE 'Unspecified'
                END AS gender,
                COUNT(u.id)::int
            FROM users u
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE ${userWhereClause}
            -- Group by the resulting string, not the enum column, to avoid type errors.
            GROUP BY gender;
        `;

        const result = await db.query(sql, queryParams);

        const dataMap = {
            'Laki-laki': 0,
            'Perempuan': 0,
            'Unspecified': 0
        };

        result.rows.forEach(row => {
            dataMap[row.gender] = row.count;
        });

        res.status(200).send({
            labels: ['Male', 'Female', 'Unspecified'],
            datasets: [{
                label: 'Employees',
                data: [dataMap['Laki-laki'], dataMap['Perempuan'], dataMap['Unspecified']],
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)', // blue-500
                    'rgba(236, 72, 153, 0.8)', // pink-500
                    'rgba(107, 114, 128, 0.8)'  // gray-500
                ],
                borderColor: '#FFFFFF',
                borderWidth: 2
            }]
        });

    } catch (error) {
        console.error("Error fetching gender distribution:", error);
        res.status(500).send({ message: "An error occurred while fetching gender distribution data." });
    }
};
/**
 * [USER-ACCESSIBLE] Fetches all work schedules for the logged-in user's company.
 * This is placed here because user.controller.js is not available, but it's called
 * from a user-facing route.
 */
exports.getWorkSchedulesForCompany = async (req, res) => {
    const { companyId } = req; // From token
    try {
        const result = await db.query(
            "SELECT id, name, start_time, end_time FROM work_schedules WHERE company_id = $1 ORDER BY start_time",
            [companyId]
        );
        res.status(200).send(result.rows);
    } catch (error) {
        console.error("Error fetching work schedules for company:", error);
        res.status(500).send({ message: "An error occurred while fetching work schedules." });
    }
};

/**
 * [USER-ACCESSIBLE] Fetches a list of active colleagues for the logged-in user.
 */
exports.getColleaguesForUser = async (req, res) => {
    const { companyId, userId } = req; // From token
    try {
        const result = await db.query(
            `SELECT u.id, up.full_name as "fullName", p.name as "positionName"
             FROM users u
             LEFT JOIN user_profiles up ON u.id = up.user_id
             LEFT JOIN positions p ON u.position_id = p.id
             WHERE u.company_id = $1 AND u.id != $2 AND u.is_active = TRUE AND u.role = 'user'
             ORDER BY up.full_name`,
            [companyId, userId]
        );
        res.status(200).send(result.rows);
    } catch (error) {
        console.error("Error fetching colleagues:", error);
        res.status(500).send({ message: "An error occurred while fetching colleagues." });
    }
};

exports.getAttendanceReport = async (req, res) => {
    const { companyId } = req;
    const { startDate, endDate, departmentId } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).send({ message: "Start date and end date are required." });
    }

    try {
        const queryParams = [startDate, endDate, companyId];
        let departmentFilter = '';
        if (departmentId) {
            queryParams.push(departmentId);
            departmentFilter = `AND u.department_id = $${queryParams.length}`;
        }

        const sql = `
            SELECT
                u.id AS "userId",
                COALESCE(up.full_name, u.username) AS "fullName",
                d.name AS "departmentName",
                u.is_active AS "isActive",
                COALESCE(agg.present, 0) AS present,
                COALESCE(agg.late, 0) AS late,
                COALESCE(agg.on_leave, 0) AS "onLeave",
                COALESCE(agg.absent, 0) AS absent,
                COALESCE(workdays.count, 0) AS "totalWorkdays"
            FROM users u
            LEFT JOIN user_profiles up ON u.id = up.user_id
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN (
                SELECT
                    a.user_id,
                    COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'present')::int AS present,
                    COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'absent')::int AS absent,
                    COUNT(DISTINCT a.id) FILTER (WHERE a.status IN ('on_leave', 'sick'))::int AS on_leave,
                    COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'present' AND (a.check_in_time AT TIME ZONE 'Asia/Jakarta')::time > COALESCE(ws.start_time, ws_user.start_time))::int AS late
                FROM attendance a
                LEFT JOIN daily_schedule_assignments dsa ON a.user_id = dsa.user_id AND DATE(a.check_in_time AT TIME ZONE 'Asia/Jakarta') = dsa.assignment_date AND dsa.company_id = $3
                LEFT JOIN work_schedules ws ON dsa.work_schedule_id = ws.id
                LEFT JOIN users u_ref ON a.user_id = u_ref.id
                LEFT JOIN work_schedules ws_user ON u_ref.work_schedule_id = ws_user.id
                WHERE a.company_id = $3
                  AND DATE(COALESCE(a.check_in_time, a.created_at)) >= $1
                  AND DATE(COALESCE(a.check_in_time, a.created_at)) <= $2
                GROUP BY a.user_id
            ) agg ON u.id = agg.user_id
            LEFT JOIN (
                SELECT
                    dsa.user_id,
                    COUNT(*)::int AS count
                FROM daily_schedule_assignments dsa
                WHERE dsa.company_id = $3
                  AND dsa.work_schedule_id IS NOT NULL
                  AND dsa.assignment_date >= $1
                  AND dsa.assignment_date <= $2
                GROUP BY dsa.user_id
            ) workdays ON u.id = workdays.user_id
            WHERE u.company_id = $3
              AND u.role = 'user'
              AND (u.is_active = TRUE OR agg.user_id IS NOT NULL)
              ${departmentFilter}
            ORDER BY u.is_active DESC, "fullName";
        `;

        const result = await db.query(sql, queryParams);
        res.status(200).send(result.rows);

    } catch (error) {
        console.error("Error generating attendance report:", error);
        res.status(500).send({ message: "An error occurred while generating the report." });
    }
};

exports.getEmployeeAttendanceLog = async (req, res) => {
    const { companyId } = req;
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).send({ message: "Start date and end date are required." });
    }

    try {
        const sql = `
            WITH date_series AS (
                SELECT generate_series($1::date, $2::date, '1 day')::date AS day
            )
            SELECT
                TO_CHAR(ds.day, 'YYYY-MM-DD') AS "assignmentDate",
                COALESCE(
                    a.status::text,
                    CASE
                        WHEN dsa.absence_type_id IS NOT NULL THEN at.category
                        WHEN dsa.work_schedule_id IS NOT NULL THEN 'absent'
                        ELSE 'off'
                    END
                ) AS status,
                a.check_in_time AS "checkInTime",
                a.check_out_time AS "checkOutTime",
                at.name AS "absenceName",
                CASE
                    WHEN a.status = 'present' AND (a.check_in_time AT TIME ZONE 'Asia/Jakarta')::time > COALESCE(ws.start_time, ws_default.start_time) THEN TRUE
                    ELSE FALSE
                END AS "isLate",
                CASE
                    WHEN a.status = 'present' AND (a.check_in_time AT TIME ZONE 'Asia/Jakarta')::time > COALESCE(ws.start_time, ws_default.start_time)
                    THEN ROUND(EXTRACT(EPOCH FROM ((a.check_in_time AT TIME ZONE 'Asia/Jakarta')::time - COALESCE(ws.start_time, ws_default.start_time))) / 60)::integer
                    ELSE NULL
                END AS "lateMinutes"
            FROM date_series ds
            LEFT JOIN daily_schedule_assignments dsa
                ON dsa.assignment_date = ds.day
                AND dsa.user_id = $3
                AND dsa.company_id = $4
            LEFT JOIN LATERAL (
                SELECT status, check_in_time, check_out_time
                FROM attendance
                WHERE user_id = $3 AND company_id = $4 AND DATE(created_at) = ds.day
                ORDER BY check_in_time ASC
                LIMIT 1
            ) a ON TRUE
            LEFT JOIN work_schedules ws ON dsa.work_schedule_id = ws.id
            LEFT JOIN users u ON u.id = $3
            LEFT JOIN work_schedules ws_default ON u.work_schedule_id = ws_default.id
            LEFT JOIN absence_types at ON dsa.absence_type_id = at.id
            ORDER BY ds.day ASC;
        `;

        const result = await db.query(sql, [startDate, endDate, userId, companyId]);

        // Post-process to handle 'leave' category and filter out 'off' days
        const processedResults = result.rows.map(row => {
            if (row.status === 'leave') row.status = 'on_leave';
            return row;
        }).filter(row => row.status !== 'off');

        res.status(200).send(processedResults);

    } catch (error) {
        console.error("Error generating employee daily log:", error);
        res.status(500).send({ message: "An error occurred while generating the daily log." });
    }
};

exports.getLeaveReport = async (req, res) => {
    const { companyId } = req;
    const { startDate, endDate, departmentId, leaveTypeId } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).send({ message: "Start date and end date are required." });
    }

    try {
        const queryParams = [companyId, startDate, endDate];
        let filters = [];

        if (departmentId) {
            queryParams.push(departmentId);
            filters.push(`u.department_id = $${queryParams.length}`);
        }

        if (leaveTypeId) {
            queryParams.push(leaveTypeId);
            filters.push(`r.absence_type_id = $${queryParams.length}`);
        }

        const filterClause = filters.length > 0 ? `AND ${filters.join(' AND ')}` : '';

        const sql = `
            SELECT
                r.id,
                up.full_name AS "fullName",
                u.username,
                d.name AS "departmentName",
                at.name AS "leaveTypeName",
                r.start_date AS "startDate",
                r.end_date AS "endDate",
                (r.end_date - r.start_date + 1) AS "totalDays",
                r.reason,
                r.status
            FROM requests r
            JOIN users u ON r.user_id = u.id
            LEFT JOIN user_profiles up ON u.id = up.user_id
            LEFT JOIN departments d ON u.department_id = d.id
            JOIN absence_types at ON r.absence_type_id = at.id
            WHERE r.company_id = $1
              AND r.start_date <= $3 -- End of period
              AND r.end_date >= $2   -- Start of period
              AND at.category IN ('leave', 'sick')
              ${filterClause}
            ORDER BY r.start_date ASC, up.full_name ASC;
        `;

        const result = await db.query(sql, queryParams);
        res.status(200).send(result.rows);

    } catch (error) {
        console.error("Error generating leave report:", error);
        res.status(500).send({ message: "An error occurred while generating the leave report." });
    }
};