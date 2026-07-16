const db = require("../db");

const EmployeeLevel = {};

EmployeeLevel.create = async ({ name, description, companyId }) => {
    const { rows } = await db.query(
        `INSERT INTO employee_levels (name, description, company_id)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [name, description, companyId]
    );
    return rows[0];
};

EmployeeLevel.findAllByCompany = async (companyId) => {
    const { rows } = await db.query(
        `SELECT * FROM employee_levels WHERE company_id = $1 ORDER BY name ASC`,
        [companyId]
    );
    return rows;
};

EmployeeLevel.findById = async (id, companyId) => {
    const { rows } = await db.query(
        `SELECT * FROM employee_levels WHERE id = $1 AND company_id = $2`,
        [id, companyId]
    );
    return rows[0];
};

EmployeeLevel.update = async (id, { name, description }, companyId) => {
    const { rows } = await db.query(
        `UPDATE employee_levels
         SET name = $1, description = $2
         WHERE id = $3 AND company_id = $4
         RETURNING *`,
        [name, description, id, companyId]
    );
    return rows[0];
};

EmployeeLevel.remove = async (id, companyId) => {
    const { rowCount } = await db.query(
        `DELETE FROM employee_levels WHERE id = $1 AND company_id = $2`,
        [id, companyId]
    );
    return rowCount > 0;
};

module.exports = EmployeeLevel;