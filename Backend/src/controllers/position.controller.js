const createCrudController = require("./crudFactory");

const positionsController = createCrudController('positions', 'Position');

module.exports = positionsController;