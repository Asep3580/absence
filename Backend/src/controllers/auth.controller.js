const config = require("../config/auth.config");
const pool = require("../db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

exports.signup = async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 8);
        await pool.query(
            "INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, 'user') RETURNING id",
            [username, email, hashedPassword]
        );
        res.send({ message: "User was registered successfully!" });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

exports.signin = async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query(
            `SELECT u.*, c.subscription_end_date, c.subscription_start_date
             FROM users u
             LEFT JOIN companies c ON u.company_id = c.id
             WHERE u.email = $1`,
            [email]
        );
        if (result.rows.length === 0) {
            return res.status(404).send({ message: "User Not found." });
        }

        const user = result.rows[0];

        // Check if the user account is active
        if (user.is_active === false) {
            return res.status(403).send({ message: "Your account has been deactivated. Please contact your administrator." });
        }

        // Check subscription status for admin users
        if (user.role === 'admin' && user.company_id && user.subscription_end_date) {
            const subscriptionEndDate = new Date(user.subscription_end_date);
            const currentDate = new Date();
            currentDate.setHours(0, 0, 0, 0); // Normalize current date to compare with DATE type from DB

            if (subscriptionEndDate < currentDate) {
                return res.status(403).send({ message: "Company subscription has expired. Please contact your superadmin." });
            }
        }

        const passwordIsValid = bcrypt.compareSync(password, user.password);

        if (!passwordIsValid) { 
            console.log("[signin] invalid password for email:", email);

            return res.status(401).send({
                accessToken: null,
                message: "Invalid Password!",
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                role: user.role,
                companyId: user.company_id,
                corporateId: user.corporate_id || null
            },
            config.secret,
            { expiresIn: 86400 } // 24 jam
        );

        res.status(200).send({
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            companyId: user.company_id,
            corporateId: user.corporate_id || null,
            accessToken: token,
        });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};