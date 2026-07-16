const db = require("../db");
const bcrypt = require("bcryptjs");

// Get company settings (for company admin)
exports.getCompanySettings = async (req, res) => {
    const companyId = req.companyId; // from authJwt middleware

    if (!companyId) {
        return res.status(403).send({ message: "No company ID found in token." });
    }

    try {
        const result = await db.query(
            'SELECT office_latitude AS "officeLatitude", office_longitude AS "officeLongitude", office_radius AS "officeRadius" FROM companies WHERE id = $1',
            [companyId]
        );

        if (result.rows.length === 0) {
            return res.status(404).send({ message: "Company not found." });
        }

        res.status(200).send(result.rows[0]);
    } catch (error) {
        res.status(500).send({ message: "Error fetching company settings." });
    }
};

exports.getCompanies = async (req, res) => {
    try {
        const query = `
            SELECT 
                c.id, 
                c.name, 
                c.created_at, 
                u.email as admin_email 
            FROM companies c
            LEFT JOIN users u ON c.id = u.company_id AND u.role = 'admin'
            ORDER BY c.created_at DESC;
        `;
        const result = await db.query(query);
        res.status(200).json(result.rows);
    } catch (error) {
        res.status(500).send({ message: "Error fetching companies." });
    }
};

// Update company settings (for company admin)
exports.updateCompanySettings = async (req, res) => {
    const companyId = req.companyId;
    const { officeLatitude, officeLongitude, officeRadius } = req.body;

    if (!companyId) {
        return res.status(403).send({ message: "No company ID found in token." });
    }

    try {
        const result = await db.query(
            "UPDATE companies SET office_latitude = $1, office_longitude = $2, office_radius = $3 WHERE id = $4 RETURNING id",
            [officeLatitude || null, officeLongitude || null, officeRadius || null, companyId]
        );

        if (result.rowCount === 0) {
            return res.status(404).send({ message: "Company not found." });
        }

        res.status(200).send({ message: "Company settings updated successfully." });
    } catch (error) {
        res.status(500).send({ message: "Error updating company settings." });
    }
};

// In a real-world application, these two database calls should be wrapped in a transaction
// to ensure that if one fails, the other is rolled back.
exports.register = async (req, res) => {
    const { companyName, username, email, password } = req.body;

    if (!companyName || !username || !email || !password) {
        return res.status(400).send({ message: "All fields are required!" });
    }

    try {
        // 1. Create the company
        const companyResult = await db.query(
            "INSERT INTO companies (name) VALUES ($1) RETURNING id",
            [companyName]
        );
        const companyId = companyResult.rows[0].id;

        // 2. Create the admin user for that company
        const hashedPassword = bcrypt.hashSync(password, 8);
        await db.query(
            "INSERT INTO users (company_id, username, email, password, role) VALUES ($1, $2, $3, $4, 'admin')",
            [companyId, username, email, hashedPassword]
        );

        res.status(201).send({ message: "Company and admin user registered successfully!" });

    } catch (err) {
        // A simple error check. A more robust solution would check for duplicate email/username
        // from the users table and provide a clearer message.
        if (err.constraint === 'users_email_key') {
            // This is a bit of a race condition. The user might not exist, but by the time we insert, it does.
            // A better way is to check first.
             return res.status(409).send({ message: "Failed! Email is already in use." });
        }
        res.status(500).send({ message: err.message });
    }
};
