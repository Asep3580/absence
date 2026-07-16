const createCrudController = require("./crudFactory");

const departmentsController = createCrudController('departments', 'Department');

module.exports = departmentsController;