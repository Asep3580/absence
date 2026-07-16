const db = require("../db");

exports.createLeaveRequest = async (req, res) => {
    const { absence_type_id, start_date, end_date, reason, request_type } = req.body;
    const { userId, companyId } = req;
    const attachmentUrl = req.file ? `/uploads/${req.file.filename}` : null;

    try {
        // Overtime: tidak butuh absence_type_id
        if (request_type === 'overtime') {
            if (!start_date || !end_date) {
                return res.status(400).send({ message: "Date is required for overtime requests." });
            }
            const sql = `
                INSERT INTO requests (user_id, company_id, request_type, start_date, end_date, reason, attachment_url, status)
                VALUES ($1, $2, 'overtime', $3, $4, $5, $6, 'pending')
                RETURNING *
            `;
            const result = await db.query(sql, [userId, companyId, start_date, end_date, reason, attachmentUrl]);
            return res.status(201).send(result.rows[0]);
        }

        // Permission (izin telat / pulang cepat / tugas luar)
        if (request_type === 'permission') {
            if (!start_date || !reason) {
                return res.status(400).send({ message: "Date and reason are required for permission requests." });
            }
            const sql = `
                INSERT INTO requests (user_id, company_id, request_type, start_date, end_date, reason, attachment_url, status)
                VALUES ($1, $2, 'permission', $3, $3, $4, $5, 'pending')
                RETURNING *
            `;
            const result = await db.query(sql, [userId, companyId, start_date, reason, attachmentUrl]);
            return res.status(201).send(result.rows[0]);
        }

        // Reimburse: butuh start_date (tanggal nota) dan reason (berisi tipe+nominal+keterangan)
        if (request_type === 'reimburse') {
            if (!start_date || !reason) {
                return res.status(400).send({ message: "Receipt date and description are required for reimbursement." });
            }
            if (!attachmentUrl) {
                return res.status(400).send({ message: "Receipt attachment is required for reimbursement." });
            }
            const sql = `
                INSERT INTO requests (user_id, company_id, request_type, start_date, end_date, reason, attachment_url, status)
                VALUES ($1, $2, 'reimburse', $3, $3, $4, $5, 'pending')
                RETURNING *
            `;
            const result = await db.query(sql, [userId, companyId, start_date, reason, attachmentUrl]);
            return res.status(201).send(result.rows[0]);
        }

        // Leave: wajib ada absence_type_id
        if (!absence_type_id || !start_date || !end_date) {
            return res.status(400).send({ message: "Absence type, start date, and end date are required." });
        }

        const absenceTypeCheck = await db.query(
            "SELECT category FROM absence_types WHERE id = $1 AND company_id = $2",
            [absence_type_id, companyId]
        );

        if (absenceTypeCheck.rows.length === 0) {
            return res.status(404).send({ message: "Absence type not found or not valid for your company." });
        }

        const category = absenceTypeCheck.rows[0].category;
        if (category !== 'leave') {
            return res.status(400).send({ message: `Absence type with category '${category}' cannot be requested.` });
        }

        const sql = `
            INSERT INTO requests (user_id, company_id, request_type, absence_type_id, start_date, end_date, reason, attachment_url, status)
            VALUES ($1, $2, 'leave', $3, $4, $5, $6, $7, 'pending')
            RETURNING *
        `;
        const result = await db.query(sql, [userId, companyId, absence_type_id, start_date, end_date, reason, attachmentUrl]);
        res.status(201).send(result.rows[0]);

    } catch (error) {
        console.error("Error creating request:", error);
        res.status(500).send({ message: "An error occurred while submitting your request." });
    }
};

exports.createChangeScheduleRequest = async (req, res) => {
    const { target_date, target_schedule_id, colleague_id, reason } = req.body;
    const { userId, companyId } = req;

    if (!target_date || !target_schedule_id) {
        return res.status(400).send({ message: "Target date and shift are required." });
    }

    try {
        // Use the employee's assigned supervisor_id (Direct Supervisor)
        const supervisorResult = await db.query(
            `SELECT supervisor_id FROM users WHERE id = $1 AND company_id = $2`,
            [userId, companyId]
        );
        const supervisorId = supervisorResult.rows[0]?.supervisor_id || null;
        const level1Status = supervisorId ? 'pending' : 'skipped';

        const result = await db.query(`
            INSERT INTO requests (
                user_id, company_id, request_type, status,
                start_date, end_date, reason,
                target_date, target_schedule_id, colleague_id,
                level1_approver_id, level1_status
            )
            VALUES ($1, $2, 'change_schedule', 'pending', $3, $3, $4, $3, $5, $6, $7, $8)
            RETURNING *
        `, [userId, companyId, target_date, reason || null, target_schedule_id, colleague_id || null, supervisorId, level1Status]);

        res.status(201).send(result.rows[0]);
    } catch (error) {
        console.error("Error creating change schedule request:", error);
        res.status(500).send({ message: "An error occurred while submitting your request." });
    }
};

exports.getUserRequests = async (req, res) => {
    const { userId, companyId } = req;
    try {
        const result = await db.query(`
            SELECT
                r.id,
                r.request_type AS "requestType",
                r.status,
                TO_CHAR(r.start_date, 'YYYY-MM-DD') AS "startDate",
                TO_CHAR(r.end_date, 'YYYY-MM-DD') AS "endDate",
                r.reason,
                r.created_at AS "submittedDate",
                TO_CHAR(r.target_date, 'YYYY-MM-DD') AS "targetDate",
                r.level1_status AS "level1Status",
                r.level1_processed_at AS "level1ProcessedAt",
                r.level1_notes AS "level1Notes",
                r.processor_notes AS "processorNotes",
                r.processed_at AS "processedAt",
                ws.name AS "targetScheduleName",
                TO_CHAR(ws.start_time, 'HH24:MI') AS "targetScheduleStart",
                TO_CHAR(ws.end_time, 'HH24:MI') AS "targetScheduleEnd",
                COALESCE(col_up.full_name, col_u.username) AS "colleagueName",
                COALESCE(l1_up.full_name, l1_u.username) AS "level1ApproverName",
                COALESCE(proc_up.full_name, proc_u.username) AS "processedByName",
                COALESCE(at.name, r.request_type::text) AS "requestTypeName"
            FROM requests r
            LEFT JOIN work_schedules ws ON r.target_schedule_id = ws.id
            LEFT JOIN users col_u ON r.colleague_id = col_u.id
            LEFT JOIN user_profiles col_up ON col_u.id = col_up.user_id
            LEFT JOIN users l1_u ON r.level1_approver_id = l1_u.id
            LEFT JOIN user_profiles l1_up ON l1_u.id = l1_up.user_id
            LEFT JOIN users proc_u ON r.processed_by = proc_u.id
            LEFT JOIN user_profiles proc_up ON proc_u.id = proc_up.user_id
            LEFT JOIN absence_types at ON r.absence_type_id = at.id
            WHERE r.user_id = $1 AND r.company_id = $2
            ORDER BY r.created_at DESC
            LIMIT 50
        `, [userId, companyId]);
        res.send(result.rows);
    } catch (error) {
        console.error("Error fetching user requests:", error);
        res.status(500).send({ message: "An error occurred." });
    }
};

exports.getPendingApprovals = async (req, res) => {
    const { userId, companyId } = req;
    try {
        const result = await db.query(`
            SELECT
                r.id,
                r.request_type AS "requestType",
                r.status,
                r.target_date AS "targetDate",
                r.reason,
                r.level1_status AS "level1Status",
                r.created_at AS "submittedDate",
                ws.name AS "targetScheduleName",
                TO_CHAR(ws.start_time, 'HH24:MI') AS "targetScheduleStart",
                TO_CHAR(ws.end_time, 'HH24:MI') AS "targetScheduleEnd",
                COALESCE(req_up.full_name, req_u.username) AS "requesterName",
                req_u.avatar_url AS "requesterAvatar"
            FROM requests r
            JOIN users req_u ON r.user_id = req_u.id
            LEFT JOIN user_profiles req_up ON req_u.id = req_up.user_id
            LEFT JOIN work_schedules ws ON r.target_schedule_id = ws.id
            WHERE r.level1_approver_id = $1
              AND r.company_id = $2
              AND r.level1_status = 'pending'
              AND r.request_type = 'change_schedule'
            ORDER BY r.created_at DESC
        `, [userId, companyId]);
        res.send(result.rows);
    } catch (error) {
        console.error("Error fetching pending approvals:", error);
        res.status(500).send({ message: "An error occurred." });
    }
};

exports.processLevel1Action = async (req, res) => {
    const { id } = req.params;
    const { action, notes } = req.body;
    const { userId, companyId } = req;

    if (!['approved', 'rejected'].includes(action)) {
        return res.status(400).send({ message: "Invalid action. Must be 'approved' or 'rejected'." });
    }

    try {
        const check = await db.query(
            `SELECT id FROM requests WHERE id = $1 AND company_id = $2 AND level1_approver_id = $3 AND level1_status = 'pending'`,
            [id, companyId, userId]
        );
        if (check.rows.length === 0) {
            return res.status(403).send({ message: "Not authorized or request already processed." });
        }

        // If supervisor rejects → overall status becomes rejected; if approves → stays pending for manager
        const overallStatus = action === 'rejected' ? 'rejected' : 'pending';
        await db.query(`
            UPDATE requests SET
                level1_status = $1,
                level1_processed_at = NOW(),
                level1_notes = $2,
                status = $3
            WHERE id = $4
        `, [action, notes || null, overallStatus, id]);

        res.send({ message: `Request ${action} at supervisor level.` });
    } catch (error) {
        console.error("Error processing level1 action:", error);
        res.status(500).send({ message: "An error occurred." });
    }
};