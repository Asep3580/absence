const EmployeeLevel = require("../models/employeeLevel.model.js");

// Create and Save a new EmployeeLevel
exports.create = async (req, res) => {
    if (!req.body.name) {
        return res.status(400).send({ message: "Level name can not be empty!" });
    }

    try {
        const levelData = {
            name: req.body.name,
            description: req.body.description,
            companyId: req.companyId, // Injected by auth middleware
        };
        const data = await EmployeeLevel.create(levelData);
        res.status(201).send(data);
    } catch (err) {
        res.status(500).send({
            message: err.message || "Some error occurred while creating the Employee Level."
        });
    }
};

// Retrieve all EmployeeLevels from the database for the company.
exports.findAll = async (req, res) => {
    try {
        const data = await EmployeeLevel.findAllByCompany(req.companyId);
        res.send(data);
    } catch (err) {
        res.status(500).send({
            message: err.message || "Some error occurred while retrieving employee levels."
        });
    }
};

// Find a single EmployeeLevel with an id
exports.findOne = async (req, res) => {
    try {
        const data = await EmployeeLevel.findById(req.params.id, req.companyId);
        if (data) {
            res.send(data);
        } else {
            res.status(404).send({ message: `Not found Employee Level with id ${req.params.id}.` });
        }
    } catch (err) {
        res.status(500).send({ message: "Error retrieving Employee Level with id " + req.params.id });
    }
};

// Update an EmployeeLevel by the id in the request
exports.update = async (req, res) => {
    if (!req.body) {
        return res.status(400).send({ message: "Data to update can not be empty!" });
    }

    try {
        const data = await EmployeeLevel.update(req.params.id, req.body, req.companyId);
        if (data) {
            res.send(data);
        } else {
            res.status(404).send({
                message: `Cannot update Employee Level with id=${req.params.id}. Maybe Level was not found!`
            });
        }
    } catch (err) {
        res.status(500).send({ message: "Error updating Employee Level with id " + req.params.id });
    }
};

// Delete an EmployeeLevel with the specified id in the request
exports.delete = async (req, res) => {
    try {
        const wasDeleted = await EmployeeLevel.remove(req.params.id, req.companyId);
        if (wasDeleted) {
            res.status(204).send(); // No Content
        } else {
            res.status(404).send({ message: `Cannot delete Employee Level with id=${req.params.id}. Maybe it was not found!` });
        }
    } catch (err) {
        res.status(500).send({ message: "Could not delete Employee Level with id " + req.params.id });
    }
};