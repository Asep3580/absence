const isValidInteger = (value) => {
    const num = Number(value);
    return Number.isInteger(num) && num > 0;
};

const validateId = (req, res, next) => {
    if (!isValidInteger(req.params.id)) {
        return res.status(400).send({ message: "Invalid ID format." });
    }
    next();
};

const paramValidators = {
    validateId
};

module.exports = paramValidators;
