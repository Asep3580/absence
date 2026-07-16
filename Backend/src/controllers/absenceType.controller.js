const db = require("../db");

// Create and Save a new Absence Type
exports.create = async (req, res) => {
    const { code, name, description, category } = req.body;
    const companyId = req.companyId; // from authJwt middleware

    if (!code || !name) {
        return res.status(400).send({ message: "Code and Name cannot be empty!" });
    }

    try {
        const sql = `INSERT INTO absence_types (company_id, code, name, description, category) VALUES ($1, $2, $3, $4, $5) RETURNING *`;
        const result = await db.query(sql, [companyId, code, name, description, category || 'leave']);
        res.status(201).send(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { // unique_violation
            return res.status(409).send({ message: `Error: Absence type with code '${code}' already exists for this company.` });
        }
        console.error("Create Absence Type Error:", error);
        res.status(500).send({ message: error.message || "Some error occurred while creating the Absence Type." });
    }
};

// Retrieve all Absence Types from the database for the company.
exports.findAll = async (req, res) => {
    const companyId = req.companyId;

    try {
        const sql = `SELECT * FROM absence_types WHERE company_id = $1 ORDER BY name ASC`;
        const result = await db.query(sql, [companyId]);
        res.status(200).send(result.rows);
    } catch (error) {
        console.error("Find All Absence Types Error:", error);
        res.status(500).send({ message: error.message || "Some error occurred while retrieving absence types." });
    }
};

// Find a single Absence Type with an id
exports.findOne = async (req, res) => {
    const { id } = req.params;
    const companyId = req.companyId;

    try {
        const sql = `SELECT * FROM absence_types WHERE id = $1 AND company_id = $2`;
        const result = await db.query(sql, [id, companyId]);

        if (result.rows.length > 0) {
            res.status(200).send(result.rows[0]);
        } else {
            res.status(404).send({ message: `Absence Type with id=${id} not found for this company.` });
        }
    } catch (error) {
        console.error(`Find One Absence Type Error (id: ${id}):`, error);
        res.status(500).send({ message: "Error retrieving Absence Type with id=" + id });
    }
};

// Update an Absence Type by the id in the request
exports.update = async (req, res) => {
    const { id } = req.params;
    const { code, name, description, category } = req.body;
    const companyId = req.companyId;

    try {
        const sql = `UPDATE absence_types SET code = $1, name = $2, description = $3, category = $4, updated_at = NOW() WHERE id = $5 AND company_id = $6 RETURNING *`;
        const result = await db.query(sql, [code, name, description, category, id, companyId]);

        if (result.rowCount > 0) {
            res.status(200).send(result.rows[0]);
        } else {
            res.status(404).send({ message: `Cannot update Absence Type with id=${id}. Maybe it was not found or you don't have permission.` });
        }
    } catch (error) {
        if (error.code === '23505') { // unique_violation
            return res.status(409).send({ message: `Error: Absence type with code '${code}' already exists for this company.` });
        }
        console.error(`Update Absence Type Error (id: ${id}):`, error);
        res.status(500).send({ message: "Error updating Absence Type with id=" + id });
    }
};

// Delete an Absence Type with the specified id in the request
exports.delete = async (req, res) => {
    const { id } = req.params;
    const companyId = req.companyId;

    try {
        const sql = `DELETE FROM absence_types WHERE id = $1 AND company_id = $2`;
        const result = await db.query(sql, [id, companyId]);

        if (result.rowCount > 0) {
            res.status(204).send(); // No Content
        } else {
            res.status(404).send({ message: `Cannot delete Absence Type with id=${id}. Maybe it was not found.` });
        }
    } catch (error) {
        console.error(`Delete Absence Type Error (id: ${id}):`, error);
        res.status(500).send({ message: "Could not delete Absence Type with id=" + id });
    }
};