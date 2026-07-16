const db = require("../db");

/**
 * Creates a generic CRUD controller for a given table.
 * @param {string} tableName - The name of the database table.
 * @param {string} entityName - The singular name of the entity (e.g., 'Position').
 * @param {object} [options] - Optional configuration.
 * @param {string[]} [options.createFields] - Fields to include in the create operation.
 * @param {string[]} [options.updateFields] - Fields to include in the update operation.
 */
const createCrudController = (tableName, entityName, options = {}) => {
    const pluralName = tableName;
    const singleName = entityName;

    return {
        getAll: async (req, res) => {
            try {
                const result = await db.query(`SELECT * FROM ${pluralName} WHERE company_id = $1 ORDER BY name`, [req.companyId]);
                res.status(200).send(result.rows);
            } catch (error) {
                res.status(500).send({ message: error.message });
            }
        },
        getById: async (req, res) => {
            try {
                const result = await db.query(`SELECT * FROM ${pluralName} WHERE id = $1 AND company_id = $2`, [req.params.id, req.companyId]);
                if (result.rows.length === 0) {
                    return res.status(404).send({ message: `${singleName} not found.` });
                }
                res.status(200).send(result.rows[0]);
            } catch (error) {
                res.status(500).send({ message: error.message });
            }
        },
        create: async (req, res) => {
            const fields = options.createFields || ['name'];
            const missingField = fields.find(f => req.body[f] === undefined);
            if (missingField) {
                return res.status(400).send({ message: `Field '${missingField}' is required.` });
            }

            const columns = [...fields, 'company_id'];
            const values = fields.map(f => req.body[f]);
            values.push(req.companyId);

            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

            try {
                const result = await db.query(
                    `INSERT INTO ${pluralName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`,
                    values
                );
                res.status(201).send(result.rows[0]);
            } catch (error) {
                if (error.code === '23505') {
                    return res.status(409).send({ message: `${singleName} with this name already exists in your company.` });
                }
                res.status(500).send({ message: error.message });
            }
        },
        update: async (req, res) => {
            const fields = options.updateFields || ['name'];
            const setParts = [];
            const values = [];
            let valueIndex = 1;

            for (const field of fields) {
                if (req.body[field] !== undefined) {
                    setParts.push(`${field} = $${valueIndex++}`);
                    values.push(req.body[field]);
                }
            }
            if (setParts.length === 0) return res.status(400).send({ message: "No valid fields to update provided." });

            values.push(req.params.id, req.companyId);

            try {
                const result = await db.query(
                    `UPDATE ${pluralName} SET ${setParts.join(', ')} WHERE id = $${valueIndex++} AND company_id = $${valueIndex++} RETURNING *`,
                    values
                );
                if (result.rows.length === 0) {
                    return res.status(404).send({ message: `${singleName} not found.` });
                }
                res.status(200).send(result.rows[0]);
            } catch (error) {
                if (error.code === '23505') {
                    return res.status(409).send({ message: `${singleName} with this name already exists in your company.` });
                }
                res.status(500).send({ message: error.message });
            }
        },
        delete: async (req, res) => {
            try {
                const result = await db.query(`DELETE FROM ${pluralName} WHERE id = $1 AND company_id = $2`, [req.params.id, req.companyId]);
                if (result.rowCount === 0) {
                    return res.status(404).send({ message: `${singleName} not found.` });
                }
                res.status(204).send();
            } catch (error) {
                if (error.code === '23503') { // Foreign key violation
                    return res.status(400).send({ message: `Cannot delete ${singleName}. It is still in use.` });
                }
                res.status(500).send({ message: error.message });
            }
        }
    };
};

module.exports = createCrudController;