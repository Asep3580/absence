const db = require("../db");

// Create and Save a new Work Schedule
exports.create = async (req, res) => {
    const { code, name, start_time, end_time } = req.body;
    const companyId = req.companyId;

    if (!code || !name || !start_time || !end_time) {
        return res.status(400).send({ message: "All fields (code, name, start_time, end_time) are required!" });
    }

    // Validasi: Pastikan start_time lebih awal dari end_time.
    // Perbandingan string sederhana sudah cukup untuk format 'HH:mm'.
    if (start_time >= end_time) {
        return res.status(400).send({ message: "Validation Error: Start time must be earlier than end time." });
    }

    try {
        const sql = `INSERT INTO work_schedules (company_id, code, name, start_time, end_time) VALUES ($1, $2, $3, $4, $5) RETURNING *`;
        const result = await db.query(sql, [companyId, code, name, start_time, end_time]);
        res.status(201).send(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { // unique_violation
            return res.status(409).send({ message: `Error: Work schedule with code '${code}' already exists for this company.` });
        }
        console.error("Create Work Schedule Error:", error);
        res.status(500).send({ message: error.message || "Some error occurred while creating the Work Schedule." });
    }
};

// Retrieve all Work Schedules from the database for the company.
exports.findAll = async (req, res) => {
    const companyId = req.companyId;

    try {
        const sql = `SELECT * FROM work_schedules WHERE company_id = $1 ORDER BY code ASC`;
        const result = await db.query(sql, [companyId]);
        res.status(200).send(result.rows);
    } catch (error) {
        console.error("Find All Work Schedules Error:", error);
        res.status(500).send({ message: error.message || "Some error occurred while retrieving work schedules." });
    }
};

// Find a single Work Schedule with an id
exports.findOne = async (req, res) => {
    const { id } = req.params;
    const companyId = req.companyId;

    try {
        const sql = `SELECT * FROM work_schedules WHERE id = $1 AND company_id = $2`;
        const result = await db.query(sql, [id, companyId]);

        if (result.rows.length > 0) {
            res.status(200).send(result.rows[0]);
        } else {
            res.status(404).send({ message: `Work Schedule with id=${id} not found for this company.` });
        }
    } catch (error) {
        console.error(`Find One Work Schedule Error (id: ${id}):`, error);
        res.status(500).send({ message: "Error retrieving Work Schedule with id=" + id });
    }
};

// Update a Work Schedule by the id in the request
exports.update = async (req, res) => {
    const { id } = req.params;
    const { code, name, start_time, end_time } = req.body;
    const companyId = req.companyId;

    // Validasi: Pastikan start_time lebih awal dari end_time.
    // Ini juga berlaku saat update.
    if (start_time && end_time && start_time >= end_time) {
        return res.status(400).send({ message: "Validation Error: Start time must be earlier than end time." });
    }

    try {
        const sql = `UPDATE work_schedules SET code = $1, name = $2, start_time = $3, end_time = $4 WHERE id = $5 AND company_id = $6 RETURNING *`;
        const result = await db.query(sql, [code, name, start_time, end_time, id, companyId]);

        if (result.rowCount > 0) {
            res.status(200).send(result.rows[0]);
        } else {
            res.status(404).send({ message: `Cannot update Work Schedule with id=${id}. Maybe it was not found or you don't have permission.` });
        }
    } catch (error) {
        if (error.code === '23505') { // unique_violation
            return res.status(409).send({ message: `Error: Work schedule with code '${code}' already exists for this company.` });
        }
        console.error(`Update Work Schedule Error (id: ${id}):`, error);
        res.status(500).send({ message: "Error updating Work Schedule with id=" + id });
    }
};

// Delete a Work Schedule with the specified id in the request
exports.delete = async (req, res) => {
    const { id } = req.params;
    const companyId = req.companyId;

    try {
        const sql = `DELETE FROM work_schedules WHERE id = $1 AND company_id = $2`;
        const result = await db.query(sql, [id, companyId]);

        if (result.rowCount > 0) {
            res.status(204).send(); // No Content
        } else {
            res.status(404).send({ message: `Cannot delete Work Schedule with id=${id}. Maybe it was not found.` });
        }
    } catch (error) {
        if (error.code === '23503') {
            return res.status(400).send({ message: "Cannot delete this work schedule as it is currently assigned to one or more employees." });
        }
        console.error(`Delete Work Schedule Error (id: ${id}):`, error);
        res.status(500).send({ message: "Could not delete Work Schedule with id=" + id });
    }
};