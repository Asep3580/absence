const pg = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

// FIX: Mencegah error "Aborted (core dumped)" di beberapa lingkungan hosting
// dengan memaksa penggunaan driver JavaScript murni dari 'pg'.
pg.native = null;
const { Pool } = pg;

// --- Konfigurasi ---
const BCRYPT_SALT_ROUNDS = 10;

// --- Koneksi Database ---
// Menggunakan variabel lingkungan dari file .env
// Cek jika DATABASE_URL ada, jika tidak, gunakan variabel individual.
// Ini membuat skrip kompatibel dengan hosting seperti Heroku/Render dan cPanel.
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

const pool = new Pool(connectionConfig);

/**
 * Memvalidasi bahwa variabel lingkungan yang diperlukan untuk database telah di-set.
 */
function validateDbEnvVars() {
  // Jika DATABASE_URL disediakan, kita tidak perlu memeriksa variabel individual.
  if (process.env.DATABASE_URL) {
    return; // Konfigurasi valid.
  }

  const requiredVars = ['DB_USER', 'DB_HOST', 'DB_DATABASE', 'DB_PASSWORD', 'DB_PORT'];
  const missingVars = requiredVars.filter(v => !process.env[v]);

  if (missingVars.length > 0) {
    console.error('❌ Kesalahan Konfigurasi: Variabel lingkungan database berikut tidak ditemukan:');
    console.error(missingVars.join(', '));
    console.error('Pastikan Anda telah mengatur variabel di atas ATAU satu variabel DATABASE_URL.');
    process.exit(1);
  }
}

/**
 * Membuat atau memperbarui akun superadmin dari variabel di file .env.
 * Dijalankan jika skrip dipanggil tanpa argumen.
 */
async function createOrUpdateSuperAdmin() {
  const { SUPERADMIN_EMAIL, SUPERADMIN_USERNAME, SUPERADMIN_PASSWORD } = process.env;

  if (!SUPERADMIN_EMAIL || !SUPERADMIN_USERNAME || !SUPERADMIN_PASSWORD) {
    console.error('Kesalahan: Untuk membuat superadmin, jalankan skrip tanpa argumen.');
    console.error('Pastikan variabel SUPERADMIN_EMAIL, SUPERADMIN_USERNAME, dan SUPERADMIN_PASSWORD ada di file .env Anda.');
    process.exit(1);
  }

  console.log(`Mencoba membuat/memperbarui superadmin "${SUPERADMIN_USERNAME}" (${SUPERADMIN_EMAIL})...`);

  const client = await pool.connect();
  try {
    const hashedPassword = await bcrypt.hash(SUPERADMIN_PASSWORD, BCRYPT_SALT_ROUNDS);

    // Query ini akan membuat superadmin jika email belum ada,
    // atau memperbarui username dan password jika email sudah ada.
    const query = `
      INSERT INTO users (company_id, username, email, password, role)
      VALUES (NULL, $1, $2, $3, 'superadmin')
      ON CONFLICT (email) DO UPDATE
      SET username = EXCLUDED.username,
          password = EXCLUDED.password,
          role = 'superadmin',
          company_id = NULL
      RETURNING (xmax = 0) AS inserted;
    `;

    const result = await client.query(query, [SUPERADMIN_USERNAME, SUPERADMIN_EMAIL, hashedPassword]);

    if (result.rows.length > 0) {
      const { inserted } = result.rows[0];
      if (inserted) {
        console.log(`✅ Sukses! Superadmin "${SUPERADMIN_USERNAME}" telah berhasil dibuat.`);
      } else {
        console.log(`✅ Sukses! Superadmin "${SUPERADMIN_USERNAME}" telah berhasil diperbarui.`);
      }
    }
  } catch (error) {
    console.error('\n❌ Terjadi kesalahan saat memproses superadmin.');
    console.error('Detail Kesalahan:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * Membuat perusahaan baru dan akun admin untuk perusahaan tersebut.
 * Dijalankan jika skrip dipanggil dengan argumen.
 */
async function createAdminAndCompany(args) {
  const [companyName, companyAddress, companyWhatsapp, adminUsername, adminEmail, adminPassword] = args;

  // No Whatsapp sekarang menjadi argumen ketiga
  if (!companyName || !companyAddress || !companyWhatsapp || !adminUsername || !adminEmail || !adminPassword) {
    console.error('Penggunaan: node create-admin-pg.js <"Nama Perusahaan"> <"Alamat"> <"No Whatsapp"> <username> <email> <password>');
    console.error('Contoh: node create-admin-pg.js "PT Maju" "Jl. Sudirman 123" "081234567890" adminmaju admin@maju.com pass123');
    process.exit(1);
  }

  console.log(`Mencoba membuat perusahaan "${companyName}" (Whatsapp: ${companyWhatsapp}) dengan admin "${adminEmail}"...`);

  const client = await pool.connect();

  try {
    const hashedPassword = await bcrypt.hash(adminPassword, BCRYPT_SALT_ROUNDS);
    await client.query('BEGIN');

    const companyQuery = 'INSERT INTO companies(name, address, whatsapp) VALUES($1, $2, $3) RETURNING id';
    const companyResult = await client.query(companyQuery, [companyName, companyAddress, companyWhatsapp]);
    const newCompanyId = companyResult.rows[0].id;
    console.log(`-> Perusahaan "${companyName}" berhasil dibuat dengan ID: ${newCompanyId}`);

    const userQuery = 'INSERT INTO users(company_id, username, email, password, role) VALUES($1, $2, $3, $4, $5)';
    await client.query(userQuery, [newCompanyId, adminUsername, adminEmail, hashedPassword, 'admin']);
    console.log(`-> Akun admin "${adminUsername}" untuk email "${adminEmail}" berhasil dibuat.`);

    // --- TAMBAHAN: Buat role default untuk perusahaan baru ---
    const adminPermissions = JSON.stringify([
        "view_dashboard", 
        "view_settings", 
        "manage_users", 
        "manage_roles", 
        "manage_positions", 
        "manage_departments", 
        "manage_work_schedules"
    ]);
    const adminRoleQuery = `INSERT INTO roles (company_id, name, permissions) VALUES ($1, 'admin', $2)`;
    await client.query(adminRoleQuery, [newCompanyId, adminPermissions]);
    console.log(`-> Role 'admin' dengan hak akses penuh berhasil dibuat untuk perusahaan baru.`);

    const userRoleQuery = `INSERT INTO roles (company_id, name, permissions) VALUES ($1, 'user', '["view_dashboard"]')`;
    await client.query(userRoleQuery, [newCompanyId]);
    console.log(`-> Role 'user' dengan hak akses dasar berhasil dibuat untuk perusahaan baru.`);
    // --- Akhir Tambahan ---


    await client.query('COMMIT');
    console.log('\n✅ Sukses! Perusahaan dan akun admin telah berhasil dibuat.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Terjadi kesalahan. Semua perubahan telah dibatalkan.');
    if (error.code === '23505' && error.constraint === 'users_email_key') {
      console.error(`Detail: Email "${adminEmail}" sudah terdaftar di sistem.`);
    } else {
      console.error('Detail Kesalahan:', error.message);
    }
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * Fungsi utama untuk menentukan aksi berdasarkan argumen.
 */
async function main() {
  // Validasi variabel database terlebih dahulu
  validateDbEnvVars();

  const args = process.argv.slice(2);
  if (args.length === 0) {
    // Tidak ada argumen, buat/perbarui superadmin
    await createOrUpdateSuperAdmin();
  } else {
    // Ada argumen, buat admin perusahaan
    await createAdminAndCompany(args);
  }
}

// Jalankan fungsi utama
async function run() {
  try {
    await main();
  } catch (error) {
    console.error('\n❌ Terjadi kesalahan fatal yang tidak terduga saat eksekusi skrip.');
    if (error instanceof Error) {
        console.error('Detail:', error.message);
        // Untuk error 'core dumped', stack mungkin tidak tersedia, tapi ini bagus untuk error lain.
        if(error.stack) console.error('Stack Trace:', error.stack);
    } else {
        console.error('Informasi Error:', error);
    }
    process.exit(1);
  }
}
run();