const pg = require('pg');

// FIX: Mencegah error "Aborted (core dumped)" di beberapa lingkungan hosting
// dengan memaksa penggunaan driver JavaScript murni dari 'pg'.
pg.native = null;
const { Pool, types } = pg;

// FIX UTC: Kolom DATE (OID 1082) dikembalikan pg sebagai Date object yang menyertakan
// offset UTC server. Di server UTC+7, "2000-05-15" menjadi "2000-05-14T17:00:00.000Z"
// sehingga substring(0,10) menghasilkan tanggal salah (-1 hari).
// Solusi: override type parser agar DATE selalu dikembalikan sebagai string "YYYY-MM-DD".
types.setTypeParser(1082, (val) => val); // DATE → plain "YYYY-MM-DD" string

/**
 * Memvalidasi bahwa variabel lingkungan yang diperlukan untuk database telah di-set.
 */
function validateDbEnvVars() {
  // Jika DATABASE_URL disediakan, kita tidak perlu memeriksa variabel individual.
  if (process.env.DATABASE_URL) return;

  const required = ['DB_USER', 'DB_HOST', 'DB_DATABASE', 'DB_PASSWORD', 'DB_PORT'];
  const missing = required.filter((k) => !process.env[k]);

  if (missing.length) {
    console.error('❌ Database configuration is incomplete. Missing env vars:');
    console.error(missing.join(', '));
    console.error('Expected either DATABASE_URL OR all of: DB_USER, DB_HOST, DB_DATABASE, DB_PASSWORD, DB_PORT');
    process.exit(1);
  }
}


// Menggunakan logika koneksi yang fleksibel untuk mendukung DATABASE_URL (dari Render/Heroku)
// dan variabel DB_* individual (dari .env atau cPanel).
const connectionConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      // Tambahkan konfigurasi SSL untuk koneksi ke database cloud seperti Render
      ssl: {
        rejectUnauthorized: false,
      },
    }
  : {
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_DATABASE,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
    };

validateDbEnvVars();

const pool = new Pool({
    ...connectionConfig,
    max: 5,               // max 5 concurrent DB connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

module.exports = pool;
