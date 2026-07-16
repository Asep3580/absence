const db = require("../db");

// Haversine formula to calculate distance between two points in meters
const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

exports.checkIn = async (req, res) => {
    const { userId, companyId } = req;
    const latitude  = parseFloat(req.body.latitude);
    const longitude = parseFloat(req.body.longitude);
    const selfieUrl = req.file ? `/uploads/${req.file.filename}` : null;

    // Validate that frontend sent location data
    if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).send({ message: "Location data is required for check-in." });
    }

    try {
        // 0. Resolve effective company: gunakan active_company_id jika di-set
        const userRes = await db.query(
            `SELECT COALESCE(active_company_id, company_id) AS eff_id FROM users WHERE id = $1`,
            [userId]
        );
        const effectiveCompanyId = userRes.rows[0]?.eff_id || companyId;

        // 1. Get company's geofencing settings
        const companyRes = await db.query(
            'SELECT office_latitude, office_longitude, office_radius FROM companies WHERE id = $1',
            [effectiveCompanyId]
        );
        const officeLocation = companyRes.rows[0];

        // 2. If geofencing is configured, validate the user's location
        if (officeLocation && officeLocation.office_latitude && officeLocation.office_longitude && officeLocation.office_radius) {
            const officeLat = parseFloat(officeLocation.office_latitude);
            const officeLon = parseFloat(officeLocation.office_longitude);
            const officeRadius = parseInt(officeLocation.office_radius, 10);

            const distance = getDistance(latitude, longitude, officeLat, officeLon);

            if (distance > officeRadius) {
                return res.status(400).send({
                    message: `You are too far from the office. You are ${Math.round(distance)} meters away, but the allowed radius is ${officeRadius} meters.`
                });
            }
        }
        // If geofencing is not configured, the check proceeds without location validation.

        // 3. Cek apakah user sudah punya absensi hari ini (berdasarkan timezone WIB)
        const todayRes = await db.query(
            `SELECT id, check_out_time FROM attendance
             WHERE user_id = $1
               AND DATE(check_in_time AT TIME ZONE 'Asia/Jakarta') = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date
             ORDER BY check_in_time DESC LIMIT 1`,
            [userId]
        );
        if (todayRes.rows.length > 0) {
            if (!todayRes.rows[0].check_out_time) {
                return res.status(400).send({ message: "Anda sudah Clock In hari ini dan belum Clock Out." });
            }
            // Sudah selesai (check-in + check-out) hari ini
            return res.status(409).send({ code: "ALREADY_COMPLETED_TODAY", message: "Absensi hari ini sudah selesai. Untuk kerja ekstra, ajukan Overtime." });
        }

        // 4. Create a new check-in record (selfie_url is optional)
        const sql = `
            INSERT INTO attendance (user_id, company_id, check_in_time, status, selfie_url)
            VALUES ($1, $2, CURRENT_TIMESTAMP, 'present', $3)
            RETURNING *
        `;
        const insertResult = await db.query(sql, [userId, effectiveCompanyId, selfieUrl]);

        res.status(201).send({
            message: "Checked in successfully!",
            attendance: insertResult.rows[0]
        });

    } catch (error) {
        console.error("Check-in Error:", error);
        res.status(500).send({ message: "An error occurred during the check-in process." });
    }
};

exports.checkOut = (req, res) => {
    const userId = req.userId;

    // Find the open check-in record for the user
    db.query("SELECT * FROM attendance WHERE user_id = $1 AND check_out_time IS NULL ORDER BY check_in_time DESC LIMIT 1", [userId])
        .then(result => {
            if (result.rows.length === 0) {
                return res.status(400).send({ message: "No open check-in found to check out." });
            }

            const attendanceId = result.rows[0].id;
            db.query("UPDATE attendance SET check_out_time = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *", [attendanceId])
                .then(updateResult => {
                    res.status(200).send({
                        message: "Checked out successfully!",
                        attendance: updateResult.rows[0]
                    });
                })
                .catch(err => {
                    res.status(500).send({ message: err.message });
                });
        })
        .catch(err => {
            res.status(500).send({ message: err.message });
        });
};

exports.getAttendanceHistory = (req, res) => {
    const userId = req.userId;

    const sql = `
        SELECT
            a.*,
            ws.start_time AS "scheduledStartTime"
        FROM attendance a
        LEFT JOIN daily_schedule_assignments dsa ON a.user_id = dsa.user_id AND DATE(a.check_in_time) = dsa.assignment_date
        LEFT JOIN work_schedules ws ON dsa.work_schedule_id = ws.id
        WHERE a.user_id = $1
        ORDER BY a.check_in_time DESC
    `;

    db.query(sql, [userId])
        .then(result => {
            res.status(200).send(result.rows);
        })
        .catch(err => {
            console.error("Error fetching user attendance history:", err);
            res.status(500).send({ message: "An error occurred while fetching attendance history." });
        });
};

exports.getCompanyAttendanceByDate = (req, res) => {
    const companyId = req.companyId; // from authJwt middleware
    const date = req.query.date || new Date().toISOString().split('T')[0];

    const query = `
        SELECT
            a.id,
            a.check_in_time AS "checkInTime",
            a.check_out_time AS "checkOutTime",
            a.status,
            a.notes,
            u.avatar_url AS "avatarUrl",
            u.is_active AS "isActive",
            COALESCE(up.full_name, u.username) AS "fullName",
            COALESCE(ws.start_time, ws_default.start_time) AS "scheduledStartTime",
            COALESCE(ws.end_time, ws_default.end_time) AS "scheduledEndTime"
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        LEFT JOIN user_profiles up ON u.id = up.user_id
        LEFT JOIN daily_schedule_assignments dsa ON a.user_id = dsa.user_id AND dsa.assignment_date = $2 AND dsa.company_id = $1
        LEFT JOIN work_schedules ws ON dsa.work_schedule_id = ws.id
        LEFT JOIN work_schedules ws_default ON u.work_schedule_id = ws_default.id
        WHERE u.company_id = $1 AND DATE(COALESCE(a.check_in_time, a.created_at)) = $2
        ORDER BY "fullName" ASC, a.check_in_time ASC;
    `;

    db.query(query, [companyId, date])
        .then(result => {
            res.status(200).send(result.rows);
        })
        .catch(err => {
            console.error("Error fetching company attendance by date:", err);
            res.status(500).send({
                message: "An error occurred while fetching attendance data."
            });
        });
};

// Admin function to get all attendance records for their company
exports.getAllAttendance = (req, res) => {
    const companyId = req.companyId;

    const query = `
        SELECT a.*, u.username
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        WHERE u.company_id = $1
        ORDER BY a.check_in_time DESC
    `;

    db.query(query, [companyId])
        .then(result => {
            res.status(200).send(result.rows);
        })
        .catch(err => {
            res.status(500).send({ message: err.message });
        });
}
