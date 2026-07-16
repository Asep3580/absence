const createCrudController = require("./crudFactory");

const employeeStatusController = createCrudController('employee_statuses', 'Employee Status', {
    createFields: ['name', 'description'],
    updateFields: ['name', 'description']
});

module.exports = employeeStatusController;
