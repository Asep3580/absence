const jwt = require("jsonwebtoken");
const config = require("../config/auth.config.js");
const db = require("../db");

const verifyTokenAsync = (token) => {
    return new Promise((resolve, reject) => {
        if (!token) {
            return reject(new Error("No token provided!"));
        }

        jwt.verify(token, config.secret, (err, decoded) => {
            if (err) {
                return reject(err);
            }
            resolve(decoded);
        });
    });
};

const verifyToken = (req, res, next) => {
    let token = req.headers["x-access-token"];

    if (!token) {
        return res.status(403).send({ message: "No token provided!" });
    }

    jwt.verify(token, config.secret, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: "Unauthorized!" });
        }
        req.userId = decoded.id;
        req.companyId = decoded.companyId;
        req.corporateId = decoded.corporateId || null;
        req.role = decoded.role;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.role && req.role === 'admin') {
        next();
        return;
    }
    res.status(403).send({ message: "Require Admin Role!" });
};

const isSuperAdmin = (req, res, next) => {
    if (req.role && req.role === 'superadmin') {
        next();
        return;
    }
    res.status(403).send({ message: "Require Super Admin Role!" });
};

const isAdminOrSuperAdmin = (req, res, next) => {
    if (req.role && (req.role === 'admin' || req.role === 'superadmin')) {
        next();
        return;
    }
    res.status(403).send({ message: "Require Admin or Super Admin Role!" });
};

const isCorporateAdmin = (req, res, next) => {
    if (req.role && req.role === 'corporate_admin') {
        next();
        return;
    }
    res.status(403).send({ message: "Require Corporate Admin Role!" });
};

const isCorporateAdminOrSuperAdmin = (req, res, next) => {
    if (req.role && (req.role === 'corporate_admin' || req.role === 'superadmin')) {
        next();
        return;
    }
    res.status(403).send({ message: "Require Corporate Admin or Super Admin Role!" });
};

const hasPermission = (permission) => {
    return async (req, res, next) => {
        try {
            // Superadmin always has access
            if (req.role === 'superadmin') {
                return next();
            }

            // Role dan companyId sudah di-decode dari token oleh verifyToken
            if (!req.role || !req.companyId) {
                return res.status(403).send({ message: "Role or Company ID not found in token!" });
            }

            const userRoleName = req.role; // Langsung gunakan role dari token

            // Temukan definisi role dan izinnya di dalam perusahaan
            const roleResult = await db.query("SELECT permissions FROM roles WHERE name = $1 AND company_id = $2", [userRoleName, req.companyId]);

            // Jika definisi role tidak ditemukan di tabel `roles`...
            if (roleResult.rows.length === 0) {
                // ...tetapi pengguna memiliki role 'admin' di token mereka (dari tabel `users`),
                // kita berikan akses sebagai fallback untuk akun-akun lama. Ini adalah langkah transisi.
                // Solusi jangka panjang adalah memastikan semua perusahaan memiliki definisi role melalui migrasi data.
                if (userRoleName === 'admin') {
                    console.warn(`[authJwt] Role definition for 'admin' not found for company ${req.companyId}. Granting access based on user's role as a fallback.`);
                    return next();
                }
                // Untuk role lain, jika tidak terdefinisi, maka gagal total.
                return res.status(403).send({ message: `Role definition for '${userRoleName}' not found in company ${req.companyId}.` });
            }

            const permissions = roleResult.rows[0].permissions; // Ini adalah array JSON dari DB

            // Periksa apakah array izin mengandung izin yang diperlukan
            if (permissions && permissions.includes(permission)) {
                next(); // Pengguna memiliki izin, lanjutkan ke controller
            } else {
                return res.status(403).send({ message: `Forbidden: Role '${userRoleName}' does not have the required '${permission}' permission.` });
            }
        } catch (error) {
            console.error("Permission check error:", error);
            return res.status(500).send({ message: "Internal error during permission validation." });
        }
    };
};

const authJwt = {
    verifyToken,
    isAdmin,
    isSuperAdmin,
    isAdminOrSuperAdmin,
    isCorporateAdmin,
    isCorporateAdminOrSuperAdmin,
    hasPermission,
};

module.exports = authJwt;
module.exports.verifyTokenAsync = verifyTokenAsync;