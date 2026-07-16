const express = require("express");
const cors = require("cors");
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const fs = require('fs');

const app = express();

// --- Konfigurasi CORS yang lebih fleksibel ---
// Daftar origin (alamat frontend) yang diizinkan untuk mengakses backend ini.
// GANTI DENGAN DOMAIN FRONTEND ANDA. 'https://www.domain-anda.com' atau 'https://app.domain-anda.com'
const whitelist = [
  'http://127.0.0.1:5500', 'http://localhost:5500', // Untuk development lokal
  'https://absence.xenoshms.com', // Untuk produksi (tanpa slash)
  'https://www.absence.xenoshms.com' // Kadang perlu versi non-www juga (tanpa slash)
];

const corsOptions = {
  origin: function (origin, callback) {
    // Izinkan jika origin ada di dalam whitelist atau jika permintaan tidak memiliki origin (misalnya dari Postman)
    if (whitelist.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  // Izinkan header kustom 'x-access-token' dan metode HTTP yang digunakan
  allowedHeaders: ['Content-Type', 'Authorization', 'x-access-token'],
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE"
};

app.use(cors(corsOptions));
// Secara eksplisit menangani permintaan pre-flight OPTIONS untuk semua rute.
// Ini adalah "sabuk pengaman" untuk memastikan header CORS dikirim dengan benar
// sebelum rute lain dievaluasi, yang seringkali memperbaiki masalah header yang hilang.
app.options('*', cors(corsOptions));

// parse requests of content-type - application/json
app.use(express.json());

// parse requests of content-type - application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

// --- Sajikan file statis dari folder 'uploads' ---
// Ini membuat file di dalam folder 'uploads' bisa diakses melalui URL
// Contoh: http://localhost:8080/uploads/avatar-12345.jpg
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)){
    // Jika folder 'uploads' tidak ada di root direktori backend, buat folder tersebut.
    // Asumsi server dijalankan dari direktori 'backend'.
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// simple route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to absensi application." });
});

// routes
require('./src/routes/auth.routes')(app);
require('./src/routes/user.routes')(app);
require('./src/routes/attendance.routes')(app);
require('./src/routes/company.routes')(app);
require('./src/routes/admin.routes')(app);
require('./src/routes/saas.routes')(app);
require('./src/routes/employeeStatus.routes')(app);
require('./src/routes/employeeLevel.routes.js')(app);
require('./src/routes/maritalStatus.routes.js')(app);
require('./src/routes/absenceType.routes.js')(app);
require('./src/routes/workSchedule.routes.js')(app);
require('./src/routes/request.routes.js')(app);
require('./src/routes/department.routes.js')(app);
require('./src/routes/position.routes.js')(app);
require('./src/routes/schedule-assignments.routes.js')(app);
require('./src/routes/corporate.routes.js')(app);

// set port, listen for requests
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});