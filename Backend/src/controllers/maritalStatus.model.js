const db = require("../db");

const MaritalStatus = {};

MaritalStatus.create = async ({ name, description, companyId }) => {
    const { rows } = await db.query(
        `INSERT INTO marital_statuses (name, description, company_id)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [name, description, companyId]
    );
    return rows[0];
};

MaritalStatus.findAllByCompany = async (companyId) => {
    const { rows } = await db.query(
        `SELECT * FROM marital_statuses WHERE company_id = $1 ORDER BY name ASC`,
        [companyId]
    );
    return rows;
};

MaritalStatus.findById = async (id, companyId) => {
    const { rows } = await db.query(
        `SELECT * FROM marital_statuses WHERE id = $1 AND company_id = $2`,
        [id, companyId]
    );
    return rows[0];
};

MaritalStatus.update = async (id, { name, description }, companyId) => {
    const { rows } = await db.query(
        `UPDATE marital_statuses
         SET name = $1, description = $2
         WHERE id = $3 AND company_id = $4
         RETURNING *`,
        [name, description, id, companyId]
    );
    return rows[0];
};

MaritalStatus.remove = async (id, companyId) => {
    const { rowCount } = await db.query(
        `DELETE FROM marital_statuses WHERE id = $1 AND company_id = $2`,
        [id, companyId]
    );
    return rowCount > 0;
};

module.exports = MaritalStatus;