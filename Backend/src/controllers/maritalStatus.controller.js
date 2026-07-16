const createCrudController = require("./crudFactory");

const maritalStatusOptions = {
    createFields: ['name', 'description'],
    updateFields: ['name', 'description']
};

const maritalStatusController = createCrudController('marital_statuses', 'Marital Status', maritalStatusOptions);

module.exports = maritalStatusController;