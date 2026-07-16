const pool = require("../db/index");

const checkDuplicateUsernameOrEmail = async (req, res, next) => {
  try {
    // Username
    let result = await pool.query("SELECT * FROM users WHERE username = $1", [req.body.username]);
    if (result.rows.length > 0) {
      return res.status(400).send({ message: "Failed! Username is already in use!" });
    }

    // Email
    result = await pool.query("SELECT * FROM users WHERE email = $1", [req.body.email]);
    if (result.rows.length > 0) {
      return res.status(400).send({ message: "Failed! Email is already in use!" });
    }

    next();
  } catch (error) {
    return res.status(500).send({ message: "Unable to validate Username or Email!" });
  }
};

const verifySignUp = {
  checkDuplicateUsernameOrEmail,
};

module.exports = verifySignUp;