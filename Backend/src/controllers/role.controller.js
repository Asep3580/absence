const db = require("../db");

const rolesController = {
    getAll: async (req, res) => {
        try {
            const query = `
                SELECT r.id, r.name, r.permissions, COUNT(u.id) AS "userCount"
                FROM roles r
                LEFT JOIN users u ON r.name = u.role AND r.company_id = u.company_id
                WHERE r.company_id = $1
                GROUP BY r.id, r.name, r.permissions
                ORDER BY r.name;
            `;
            const result = await db.query(query, [req.companyId]);
            res.status(200).send(result.rows);
        } catch (error) {
            res.status(500).send({ message: error.message });
        }
    },
    getById: async (req, res) => {
        try {
            const result = await db.query("SELECT id, name, permissions FROM roles WHERE id = $1 AND company_id = $2", [req.params.id, req.companyId]);
            if (result.rows.length === 0) return res.status(404).send({ message: "Role not found." });
            res.status(200).send(result.rows[0]);
        } catch (error) {
            res.status(500).send({ message: error.message });
        }
    },
    create: async (req, res) => {
        const { name, permissions } = req.body;
        try {
            const result = await db.query("INSERT INTO roles (company_id, name, permissions) VALUES ($1, $2, $3::jsonb) RETURNING *", [req.companyId, name, JSON.stringify(permissions || [])]);
            res.status(201).send(result.rows[0]);
        } catch (error) {
            if (error.code === '23505') return res.status(409).send({ message: "Role name already exists." });
            res.status(500).send({ message: error.message });
        }
    },
    update: async (req, res) => {
        const { permissions } = req.body;
        try {
            const result = await db.query("UPDATE roles SET permissions = $1::jsonb WHERE id = $2 AND company_id = $3 RETURNING *", [JSON.stringify(permissions || []), req.params.id, req.companyId]);
            if (result.rows.length === 0) return res.status(404).send({ message: "Role not found." });
            res.status(200).send(result.rows[0]);
        } catch (error) {
            res.status(500).send({ message: error.message });
        }
    },
    delete: async (req, res) => {
        try {
            const result = await db.query("DELETE FROM roles WHERE id = $1 AND company_id = $2", [req.params.id, req.companyId]);
            if (result.rowCount === 0) return res.status(404).send({ message: "Role not found." });
            res.status(204).send();
        } catch (error) {
            if (error.code === '23503') return res.status(400).send({ message: "Cannot delete role. It is still in use." });
            res.status(500).send({ message: error.message });
        }
    }
};

module.exports = rolesController;