const db = require("../db");

const createCrudController = (tableName, entityName, options = {}) => {
    const {
        createFields = ['name'],
        updateFields = ['name'],
        orderByField = 'name',
        uniqueField = 'name'
    } = options;

    const pluralName = tableName;
    const singleName = entityName;

    return {
        getAll: async (req, res) => {
            try {
                const result = await db.query(`SELECT * FROM ${pluralName} WHERE company_id = $1 ORDER BY ${orderByField}`, [req.companyId]);
                res.status(200).send(result.rows);
            } catch (error) {
                res.status(500).send({ message: error.message });
            }
        },
        getById: async (req, res) => {
            try {
                const result = await db.query(`SELECT * FROM ${pluralName} WHERE id = $1 AND company_id = $2`, [req.params.id, req.companyId]);
                if (result.rows.length === 0) return res.status(404).send({ message: `${singleName} not found.` });
                res.status(200).send(result.rows[0]);
            } catch (error) {
                res.status(500).send({ message: error.message });
            }
        },
        create: async (req, res) => {
            const columns = [...createFields, 'company_id'];
            const values = [];
            const placeholders = [];

            for (let i = 0; i < createFields.length; i++) {
                const field = createFields[i];
                if (req.body[field] == null) { // Checks for both null and undefined
                    return res.status(400).send({ message: `Field "${field}" is required.` });
                }
                values.push(req.body[field]);
                placeholders.push(`$${i + 1}`);
            }

            values.push(req.companyId);
            placeholders.push(`$${values.length}`);

            try {
                const result = await db.query(
                    `INSERT INTO ${pluralName} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
                    values
                );
                res.status(201).send(result.rows[0]);
            } catch (error) {
                if (error.code === '23505') return res.status(409).send({ message: `${singleName} with this ${uniqueField} already exists.` });
                res.status(500).send({ message: error.message });
            }
        },
        update: async (req, res) => {
            const setClauses = [];
            const values = [];

            for (let i = 0; i < updateFields.length; i++) {
                const field = updateFields[i];
                if (req.body[field] == null) { // Checks for both null and undefined
                    return res.status(400).send({ message: `Field "${field}" is required.` });
                }
                values.push(req.body[field]);
                setClauses.push(`${field} = $${i + 1}`);
            }

            values.push(req.params.id, req.companyId);

            try {
                const result = await db.query(
                    `UPDATE ${pluralName} SET ${setClauses.join(', ')} WHERE id = $${values.length - 1} AND company_id = $${values.length} RETURNING *`,
                    values
                );
                if (result.rows.length === 0) return res.status(404).send({ message: `${singleName} not found.` });
                res.status(200).send(result.rows[0]);
            } catch (error) {
                if (error.code === '23505') return res.status(409).send({ message: `${singleName} with this ${uniqueField} already exists.` });
                res.status(500).send({ message: error.message });
            }
        },
        delete: async (req, res) => {
            try {
                const result = await db.query(`DELETE FROM ${pluralName} WHERE id = $1 AND company_id = $2`, [req.params.id, req.companyId]);
                if (result.rowCount === 0) return res.status(404).send({ message: `${singleName} not found.` });
                res.status(204).send();
            } catch (error) {
                if (error.code === '23503') return res.status(400).send({ message: `Cannot delete ${singleName}. It is still in use.` });
                res.status(500).send({ message: error.message });
            }
        }
    };
};

module.exports = createCrudController;