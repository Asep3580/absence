const db = require("../db");

// Retrieve all schedule assignments for a given month and year
exports.getScheduleAssignments = async (req, res) => {
    const { companyId } = req;
    const { year, month } = req.query;

    if (!year || !month) {
        return res.status(400).send({ message: "Year and month query parameters are required." });
    }

    try {
        // Combine actual daily_schedule_assignments (highest priority) with approved
        // absence requests — the UNION ensures approved requests show even when no
        // dsa row was written (e.g., requests approved before the auto-update code).
        const sql = `
            WITH monthly_dsa AS (
                SELECT
                    dsa.id,
                    TO_CHAR(dsa.assignment_date, 'YYYY-MM-DD') AS "assignmentDate",
                    dsa.user_id AS "userId",
                    u.username,
                    u.role,
                    up.full_name AS "fullName",
                    p.name AS "position",
                    u.employee_nik AS "employeeNik",
                    dsa.work_schedule_id AS "workScheduleId",
                    ws.code AS "workScheduleCode",
                    ws.name AS "workScheduleName",
                    dsa.absence_type_id AS "absenceTypeId",
                    at.code AS "absenceTypeCode",
                    at.name AS "absenceTypeName"
                FROM daily_schedule_assignments dsa
                JOIN users u ON dsa.user_id = u.id AND u.is_active = TRUE
                LEFT JOIN user_profiles up ON u.id = up.user_id
                LEFT JOIN positions p ON u.position_id = p.id
                LEFT JOIN work_schedules ws ON dsa.work_schedule_id = ws.id
                LEFT JOIN absence_types at ON dsa.absence_type_id = at.id
                WHERE dsa.company_id = $1
                  AND EXTRACT(YEAR FROM dsa.assignment_date) = $2
                  AND EXTRACT(MONTH FROM dsa.assignment_date) = $3
            ),
            approved_absences AS (
                -- Approved absence requests that have no dsa row for that specific date
                SELECT
                    NULL::integer AS id,
                    TO_CHAR(gs.d::date, 'YYYY-MM-DD') AS "assignmentDate",
                    r.user_id AS "userId",
                    u.username,
                    u.role,
                    up.full_name AS "fullName",
                    p.name AS "position",
                    u.employee_nik AS "employeeNik",
                    NULL::integer AS "workScheduleId",
                    NULL AS "workScheduleCode",
                    NULL AS "workScheduleName",
                    r.absence_type_id AS "absenceTypeId",
                    at.code AS "absenceTypeCode",
                    at.name AS "absenceTypeName"
                FROM requests r
                CROSS JOIN LATERAL generate_series(r.start_date::date, r.end_date::date, '1 day'::interval) AS gs(d)
                JOIN users u ON r.user_id = u.id AND u.is_active = TRUE
                LEFT JOIN user_profiles up ON u.id = up.user_id
                LEFT JOIN positions p ON u.position_id = p.id
                LEFT JOIN absence_types at ON r.absence_type_id = at.id
                WHERE r.company_id = $1
                  AND r.status = 'approved'
                  AND r.absence_type_id IS NOT NULL
                  AND EXTRACT(YEAR FROM gs.d::date) = $2
                  AND EXTRACT(MONTH FROM gs.d::date) = $3
                  AND NOT EXISTS (
                      SELECT 1 FROM daily_schedule_assignments dsa2
                      WHERE dsa2.company_id = $1
                        AND dsa2.user_id = r.user_id
                        AND dsa2.assignment_date = gs.d::date
                  )
            )
            SELECT * FROM monthly_dsa
            UNION ALL
            SELECT * FROM approved_absences
            ORDER BY "fullName", "assignmentDate";
        `;
        const result = await db.query(sql, [companyId, year, month]);
        res.status(200).send(result.rows);
    } catch (error) {
        console.error("Error fetching schedule assignments:", error);
        res.status(500).send({ message: "An error occurred while fetching schedule assignments." });
    }
};

// Bulk update schedule assignments
exports.bulkUpdate = async (req, res) => {
    console.log("Bulk update request body:", JSON.stringify(req.body, null, 2));
    const { companyId } = req;
    const { year, month, changes } = req.body;

    if (year === undefined || month === undefined || !changes) {
        return res.status(400).send({ message: "Year, month, and changes are required." });
    }

    const parsedYear = parseInt(year, 10);
    const parsedMonth = parseInt(month, 10);

    if (!Number.isFinite(parsedYear) || !Number.isFinite(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
        return res.status(400).send({ message: "Invalid year or month." });
    }

    const client = await db.connect();

    let affected = {
        insertedOrUpdated: 0,
        deleted: 0,
        skippedInvalidAssignmentId: 0,
        processed: 0,
    };

    try {
        await client.query('BEGIN');

        for (const userId in changes) {
            if (Object.hasOwnProperty.call(changes, userId)) {
                const userIdInt = parseInt(userId, 10);
                if (!Number.isFinite(userIdInt)) continue;

                const dayChanges = changes[userId];
                for (const day in dayChanges) {
                    if (!Object.hasOwnProperty.call(dayChanges, day)) continue;

                    const assignmentId = dayChanges[day];
                    const dayInt = parseInt(day, 10);
                    if (!Number.isFinite(dayInt) || dayInt < 1 || dayInt > 31) continue;

                    // Use YYYY-MM-DD string to avoid timezone issues
                    const assignmentDate = `${parsedYear}-${String(parsedMonth).padStart(2, '0')}-${String(dayInt).padStart(2, '0')}`;
                    affected.processed++;

                    if (!assignmentId) {
                        const deleteSql = `
                            DELETE FROM daily_schedule_assignments
                            WHERE company_id = $1 AND user_id = $2 AND assignment_date = $3;
                        `;
                        const delRes = await client.query(deleteSql, [companyId, userIdInt, assignmentDate]);
                        affected.deleted += delRes.rowCount || 0;
                        continue;
                    }

                    const parts = String(assignmentId).split('-');
                    if (parts.length !== 2) {
                        affected.skippedInvalidAssignmentId++;
                        console.warn('Invalid assignmentId format, skipped:', assignmentId);
                        continue;
                    }

                    const type = parts[0];
                    const idStr = parts[1];

                    const id = parseInt(idStr, 10);
                    if (!idStr || !Number.isFinite(id)) {
                        affected.skippedInvalidAssignmentId++;
                        continue;
                    }

                    const workScheduleId = type === 'work' ? id : null;
                    const absenceTypeId = type === 'absence' ? id : null;

                    if (workScheduleId === null && absenceTypeId === null) {
                        affected.skippedInvalidAssignmentId++;
                        continue;
                    }

                    // Upsert logic
                    const upsertSql = `
                        INSERT INTO daily_schedule_assignments (
                            company_id, user_id, assignment_date,
                            work_schedule_id, absence_type_id,
                            created_at, updated_at
                        )
                        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                        ON CONFLICT (company_id, user_id, assignment_date)
                        DO UPDATE SET
                            work_schedule_id = EXCLUDED.work_schedule_id,
                            absence_type_id = EXCLUDED.absence_type_id,
                            updated_at = NOW();
                    `;

                    await client.query(upsertSql, [companyId, userIdInt, assignmentDate, workScheduleId, absenceTypeId]);
                    // rowCount for upsert isn't reliable across PG versions for DO UPDATE
                    affected.insertedOrUpdated++;
                }
            }
        }

        await client.query('COMMIT');
        console.log('Bulk update summary:', affected);
        res.status(200).send({ message: "Schedule updated successfully.", ...affected });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error bulk updating schedule assignments:", error);
        res.status(500).send({ message: "An error occurred while updating the schedule." });
    } finally {
        client.release();
    }
};

// Bulk upload schedule assignments from an Excel file
exports.uploadFromExcel = async (req, res) => {
    const { companyId } = req;
    const { year, month, changes } = req.body;

    if (!year || !month || !changes) {
        return res.status(400).send({ message: "Year, month, and schedule changes are required." });
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        // 1. Fetch all valid work schedules and absence types for the company into maps
        const [workSchedulesRes, absenceTypesRes] = await Promise.all([
            client.query('SELECT id, code FROM work_schedules WHERE company_id = $1', [companyId]),
            client.query('SELECT id, code FROM absence_types WHERE company_id = $1', [companyId])
        ]);

        const workScheduleMap = new Map(workSchedulesRes.rows.map(item => [item.code, item.id]));
        const absenceTypeMap = new Map(absenceTypesRes.rows.map(item => [item.code, item.id]));

        let affected = { insertedOrUpdated: 0, skipped: 0 };

        // 2. Iterate through the changes and perform upserts
        for (const userId in changes) {
            const dayChanges = changes[userId];
            for (const day in dayChanges) {
                const code = dayChanges[day];
                const assignmentDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

                let workScheduleId = null;
                let absenceTypeId = null;

                if (code.toUpperCase() === 'OFF') {
                    // 'OFF' means we should delete the assignment for that day
                    await client.query(
                        'DELETE FROM daily_schedule_assignments WHERE company_id = $1 AND user_id = $2 AND assignment_date = $3',
                        [companyId, userId, assignmentDate]
                    );
                    affected.insertedOrUpdated++; // Counting this as a processed change
                    continue;
                } else if (workScheduleMap.has(code)) {
                    workScheduleId = workScheduleMap.get(code);
                } else if (absenceTypeMap.has(code)) {
                    absenceTypeId = absenceTypeMap.get(code);
                } else {
                    // If code is not found, skip this entry
                    affected.skipped++;
                    console.warn(`Skipping invalid code '${code}' for user ${userId} on ${assignmentDate}`);
                    continue;
                }

                // Upsert logic
                const upsertSql = `
                    INSERT INTO daily_schedule_assignments (company_id, user_id, assignment_date, work_schedule_id, absence_type_id)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (company_id, user_id, assignment_date) DO UPDATE SET
                        work_schedule_id = EXCLUDED.work_schedule_id, absence_type_id = EXCLUDED.absence_type_id, updated_at = NOW();`;
                await client.query(upsertSql, [companyId, userId, assignmentDate, workScheduleId, absenceTypeId]);
                affected.insertedOrUpdated++;
            }
        }

        await client.query('COMMIT');
        res.status(200).send({ message: "Schedule uploaded successfully.", ...affected });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error uploading schedule from Excel:", error);
        res.status(500).send({ message: "An error occurred while uploading the schedule." });
    } finally {
        client.release();
    }
};
