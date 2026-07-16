-- Drop tables in reverse order of creation to handle dependencies
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS requests CASCADE;
DROP TABLE IF EXISTS daily_schedule_assignments CASCADE;
DROP TABLE IF EXISTS user_company_assignments CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS saas_settings CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS absence_types CASCADE;
DROP TABLE IF EXISTS support_chats CASCADE;

DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS marital_statuses CASCADE;
DROP TABLE IF EXISTS employee_levels CASCADE;
DROP TABLE IF EXISTS employee_statuses CASCADE;
DROP TABLE IF EXISTS work_schedules CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS positions CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS corporates CASCADE;

-- Drop custom types if they exist
DROP TYPE IF EXISTS attendance_status;
DROP TYPE IF EXISTS request_type;
DROP TYPE IF EXISTS request_status;
DROP TYPE IF EXISTS gender_type;
DROP TYPE IF EXISTS marital_status_type;
DROP TYPE IF EXISTS invoice_status_type;
DROP TYPE IF EXISTS subscription_status_type;

-- Create ENUM types for better data integrity and consistency
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'on_leave', 'sick');
CREATE TYPE request_type AS ENUM ('leave', 'overtime', 'remote_work', 'change_schedule', 'reimburse');
CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE gender_type AS ENUM ('Laki-laki', 'Perempuan');
CREATE TYPE invoice_status_type AS ENUM ('draft', 'due', 'paid', 'overdue');
CREATE TYPE subscription_status_type AS ENUM ('active', 'inactive', 'trial', 'expired');

-- Create corporates table (parent entity for multi-property groups)
CREATE TABLE IF NOT EXISTS corporates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  address TEXT,
  whatsapp VARCHAR(255),
  subscription_status subscription_status_type DEFAULT 'active',
  subscription_start_date DATE,
  subscription_end_date DATE,
  price_per_employee INTEGER DEFAULT 0, -- Tarif per karyawan per bulan
  max_employees INTEGER DEFAULT 10, -- Jumlah maksimal karyawan yang diizinkan
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  brand VARCHAR(255),
  star_rating INTEGER CHECK (star_rating BETWEEN 1 AND 5),
  -- Geofencing settings for attendance
  office_latitude NUMERIC(10, 8),
  office_longitude NUMERIC(11, 8),
  office_radius INTEGER, -- Radius in meters
  corporate_id INTEGER REFERENCES corporates(id) ON DELETE SET NULL
);

-- Create positions table
CREATE TABLE IF NOT EXISTS positions (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, name) -- Position names must be unique within a company
);

-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, name) -- Department names must be unique within a company
);

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  permissions JSONB DEFAULT '[]'::jsonb, -- Store permissions as a JSON array of strings
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, name)
);

-- Create work_schedules table
CREATE TABLE IF NOT EXISTS work_schedules (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(10) NOT NULL,
  name VARCHAR(255) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, code) -- Schedule codes must be unique within a company
);

-- Create employee_statuses table
CREATE TABLE IF NOT EXISTS employee_statuses (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, name) -- Status names must be unique within a company
);

-- Create employee_levels table (New)
CREATE TABLE IF NOT EXISTS employee_levels (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, name) -- Level names must be unique within a company
);

-- Create marital_statuses table (New)
CREATE TABLE IF NOT EXISTS marital_statuses (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL, -- The code, e.g., 'K/1'
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, name) -- Status codes must be unique within a company
);

-- Create saas_settings table
CREATE TABLE IF NOT EXISTS saas_settings (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT
);

-- Create absence_types table
CREATE TABLE IF NOT EXISTS absence_types (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(10) NOT NULL,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL DEFAULT 'leave', -- e.g., 'leave', 'off_day', 'holiday'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, code) -- Ensures codes are unique within a company
);

-- Create users table (Refactored for SaaS)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE, -- Users are deleted if their company is deleted.
  position_id INTEGER REFERENCES positions(id) ON DELETE SET NULL,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  work_schedule_id INTEGER REFERENCES work_schedules(id) ON DELETE SET NULL,
  employee_status_id INTEGER REFERENCES employee_statuses(id) ON DELETE SET NULL,
  employee_level_id INTEGER REFERENCES employee_levels(id) ON DELETE SET NULL,
  supervisor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,   -- Direct Supervisor (level 1 approver)
  manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,      -- Direct Manager (level 2 approver / HR)
  employee_nik VARCHAR(255) NULL,
  username VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(255),
  face_photo_url VARCHAR(255), -- Dedicated face photo for recognition comparison (separate from avatar)
  corporate_id INTEGER REFERENCES corporates(id) ON DELETE SET NULL, -- For corporate_admin users
  active_company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL, -- Hotel aktif untuk absensi multi-hotel
  role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'superadmin', 'corporate_admin')),
  is_active BOOLEAN DEFAULT TRUE,
  join_date DATE,
  contract_start_date DATE, -- Tanggal mulai kontrak saat ini
  contract_end_date DATE,   -- Tanggal akhir kontrak saat ini
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_user_company CHECK (
    (role = 'superadmin' AND company_id IS NULL AND corporate_id IS NULL) OR
    (role = 'corporate_admin' AND corporate_id IS NOT NULL AND company_id IS NULL) OR
    (role IN ('user', 'admin') AND company_id IS NOT NULL)
  ),
  UNIQUE(company_id, employee_nik) -- NIK must be unique within a company
);

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(255),
  phone_number VARCHAR(20),
  date_of_birth DATE,
  gender gender_type,  
  marital_status_id INTEGER REFERENCES marital_statuses(id) ON DELETE SET NULL,
  religion VARCHAR(50),
  address TEXT,
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(20),
  annual_leave_adjustment INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Track employees assigned to multiple hotels within a corporate
CREATE TABLE IF NOT EXISTS user_company_assignments (
    id SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE, -- mirrors users.company_id (read-only reference)
    started_at DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, company_id)
);

-- Create daily_schedule_assignments table
CREATE TABLE IF NOT EXISTS daily_schedule_assignments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    assignment_date DATE NOT NULL,
    work_schedule_id INTEGER REFERENCES work_schedules(id) ON DELETE SET NULL,
    absence_type_id INTEGER REFERENCES absence_types(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Membuat setiap jadwal harian per karyawan menjadi unik
    UNIQUE(company_id, user_id, assignment_date),
    -- Memastikan hanya salah satu dari work_schedule_id atau absence_type_id yang terisi
    CONSTRAINT check_single_assignment_type CHECK (num_nonnulls(work_schedule_id, absence_type_id) <= 1)
);


-- Create attendance table (Refactored for SaaS)
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE, -- For partitioning and performance
  check_in_time TIMESTAMP WITH TIME ZONE,
  check_out_time TIMESTAMP WITH TIME ZONE,
  status attendance_status NOT NULL, -- Using ENUM for consistency
  notes TEXT, -- For remarks, e.g., reason for being late
  selfie_url TEXT, -- Selfie photo taken at clock-in for anti-cheating verification
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create requests table (New)
CREATE TABLE IF NOT EXISTS requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  request_type request_type NOT NULL,
  status request_status NOT NULL DEFAULT 'pending',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  attachment_url VARCHAR(255), -- URL to the uploaded attachment file
  absence_type_id INTEGER REFERENCES absence_types(id) ON DELETE SET NULL, -- Link to the specific type of leave/absence
  processed_by INTEGER REFERENCES users(id) ON DELETE SET NULL, -- The admin/manager who processed the request
  processed_at TIMESTAMP WITH TIME ZONE,
  processor_notes TEXT, -- Optional notes from the processor
  -- Change schedule specific fields
  target_date DATE,
  target_schedule_id INTEGER REFERENCES work_schedules(id) ON DELETE SET NULL,
  colleague_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  level1_approver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  level1_status VARCHAR(20), -- pending/approved/rejected/skipped
  level1_processed_at TIMESTAMP WITH TIME ZONE,
  level1_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_leave_request_details CHECK (request_type != 'leave' OR absence_type_id IS NOT NULL) -- If it's a leave request, absence_type_id must be provided
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- Invoice amount as a whole number for IDR
  description TEXT,
  due_date DATE NOT NULL,
  status invoice_status_type NOT NULL DEFAULT 'draft',
  payment_date DATE,
  payment_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create support_chats table
CREATE TABLE IF NOT EXISTS support_chats (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_role VARCHAR(50) NOT NULL, -- 'superadmin' or 'admin'
  message TEXT,
  attachment_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_message_or_attachment CHECK (message IS NOT NULL OR attachment_url IS NOT NULL)
);


-- Create a reusable function to update the 'updated_at' timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to the absence_types table
CREATE TRIGGER set_timestamp_absence_types
BEFORE UPDATE ON absence_types
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Apply the trigger to the invoices table
CREATE TRIGGER set_timestamp_invoices
BEFORE UPDATE ON invoices
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Optional: Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_company_id ON attendance(company_id);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_support_chats_company_id ON support_chats(company_id);
CREATE INDEX IF NOT EXISTS idx_daily_schedule_assignments_user_date ON daily_schedule_assignments (company_id, user_id, assignment_date);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_company_id ON positions(company_id);
CREATE INDEX IF NOT EXISTS idx_departments_company_id ON departments(company_id);
CREATE INDEX IF NOT EXISTS idx_roles_company_id ON roles(company_id);
CREATE INDEX IF NOT EXISTS idx_work_schedules_company_id ON work_schedules(company_id);
CREATE INDEX IF NOT EXISTS idx_employee_statuses_company_id ON employee_statuses(company_id);
CREATE INDEX IF NOT EXISTS idx_employee_levels_company_id ON employee_levels(company_id);
CREATE INDEX IF NOT EXISTS idx_marital_statuses_company_id ON marital_statuses(company_id);
CREATE INDEX IF NOT EXISTS idx_absence_types_company_id ON absence_types(company_id);
CREATE INDEX IF NOT EXISTS idx_requests_level1_approver ON requests(level1_approver_id, level1_status) WHERE level1_status = 'pending';


-- Insert a default company and an admin user for it, matching the 'Add New Company' form fields.
INSERT INTO companies (name, address, whatsapp, subscription_start_date, subscription_end_date, price_per_employee, max_employees, office_latitude, office_longitude, office_radius) VALUES 
('PT. Inovasi Digital', 'Jl. Jendral Sudirman No. 1, Jakarta', '081298765432', '2023-01-01', '2024-01-01', 19000, 10, -6.2088, 106.8456, 100)
ON CONFLICT (name) DO UPDATE SET
  address = EXCLUDED.address,
  whatsapp = EXCLUDED.whatsapp,
  subscription_start_date = EXCLUDED.subscription_start_date,
  subscription_end_date = EXCLUDED.subscription_end_date,
  price_per_employee = EXCLUDED.price_per_employee,
  max_employees = EXCLUDED.max_employees,
  office_latitude = EXCLUDED.office_latitude,
  office_longitude = EXCLUDED.office_longitude,
  office_radius = EXCLUDED.office_radius;

-- Create an 'admin' user for 'PT. Inovasi Digital'.
-- Admin Username: admin_inovasi, Password: password123
INSERT INTO users (company_id, username, email, password, role, join_date, is_active)
SELECT id, 'admin_inovasi', 'admin@inovasi.digital', '$2a$08$kfreE/.d5gvjKxIhf3tLd.m5L3T3i2c1G.s4H5i6J7k8L9m0N1o2', 'admin', CURRENT_DATE, TRUE
FROM companies WHERE name = 'PT. Inovasi Digital'
ON CONFLICT (email) DO NOTHING;

-- Insert default roles for the new company, matching the frontend permissions
INSERT INTO roles (company_id, name, permissions)
SELECT id, 'admin', '["view_dashboard", "view_employees", "manage_employees", "view_schedule", "manage_schedule", "view_attendance_log", "view_settings", "manage_users", "manage_roles", "manage_positions", "manage_departments", "manage_work_schedules", "manage_absence_types", "manage_employee_status", "manage_employee_levels", "manage_marital_status"]'::jsonb
FROM companies WHERE name = 'PT. Inovasi Digital'
ON CONFLICT (company_id, name) DO UPDATE SET permissions = EXCLUDED.permissions;

INSERT INTO roles (company_id, name, permissions)
SELECT id, 'user', '["view_dashboard"]'::jsonb
FROM companies WHERE name = 'PT. Inovasi Digital'
ON CONFLICT (company_id, name) DO NOTHING;

-- === CONTOH DATA UNTUK PERUSAHAAN ===
-- Pastikan ini dijalankan setelah perusahaan 'PT. Inovasi Digital' dibuat.
DO $$
DECLARE
    v_company_id INTEGER;
    v_dept_fo_id INTEGER;
    v_dept_hk_id INTEGER;
    v_dept_fb_id INTEGER;
    v_dept_hr_id INTEGER;
    v_pos_fda_id INTEGER;
    v_pos_ra_id INTEGER;
    v_pos_waiter_id INTEGER;
    v_pos_hrm_id INTEGER;
    v_ws_pagi_id INTEGER;
    v_ws_siang_id INTEGER;
    v_ws_malam_id INTEGER;
    v_ws_office_id INTEGER;
    v_status_pkwt_id INTEGER;
    v_status_dw_id INTEGER;
    v_marital_tk_id INTEGER;
    v_marital_k0_id INTEGER;
    v_level_staff_id INTEGER;
    v_level_mgr_id INTEGER;
BEGIN
    -- Dapatkan ID dari 'PT. Inovasi Digital'
    SELECT id INTO v_company_id FROM companies WHERE name = 'PT. Inovasi Digital' LIMIT 1;

    -- Hanya jalankan jika perusahaan ditemukan
    IF v_company_id IS NOT NULL THEN
        -- 1. Contoh Departemen
        INSERT INTO departments (company_id, name) VALUES
        (v_company_id, 'Front Office'),
        (v_company_id, 'Housekeeping'),
        (v_company_id, 'Food & Beverage'),
        (v_company_id, 'Human Resources')
        ON CONFLICT (company_id, name) DO NOTHING;

        -- 2. Contoh Jabatan
        INSERT INTO positions (company_id, name) VALUES
        (v_company_id, 'General Manager'),
        (v_company_id, 'Front Desk Agent'),
        (v_company_id, 'Room Attendant'),
        (v_company_id, 'Waiter/Waitress'),
        (v_company_id, 'HR Manager')
        ON CONFLICT (company_id, name) DO NOTHING;

        -- 3. Contoh Jam Kerja
        INSERT INTO work_schedules (company_id, code, name, start_time, end_time) VALUES
        (v_company_id, 'PAGI', 'Shift Pagi', '07:00:00', '15:00:00'),
        (v_company_id, 'SIANG', 'Shift Siang', '15:00:00', '23:00:00'),
        (v_company_id, 'MALAM', 'Shift Malam', '23:00:00', '07:00:00'),
        (v_company_id, 'OFFICE', 'Jam Kantor', '09:00:00', '17:00:00')
        ON CONFLICT (company_id, code) DO NOTHING;

        -- 4. Contoh Status Karyawan
        INSERT INTO employee_statuses (company_id, name, description) VALUES
        (v_company_id, 'PKWT', 'Perjanjian Kerja Waktu Tertentu'),
        (v_company_id, 'DW', 'Daily Worker'),
        (v_company_id, 'CASUAL', 'Casual Employee')
        ON CONFLICT (company_id, name) DO NOTHING;

        -- 5. Contoh Level Karyawan
        INSERT INTO employee_levels (company_id, name, description) VALUES
        (v_company_id, 'Level 1 (Staff)', 'Staff level employee'),
        (v_company_id, 'Level 2 (Supervisor)', 'Supervisor level employee'),
        (v_company_id, 'Level 3 (Manager)', 'Manager level employee')
        ON CONFLICT (company_id, name) DO NOTHING;

        -- 6. Contoh Status Perkawinan
        INSERT INTO marital_statuses (company_id, name, description) VALUES
        (v_company_id, 'TK', 'Not Married'),
        (v_company_id, 'K/0', 'Married'),
        (v_company_id, 'K/1', 'Married with 1 Child'),
        (v_company_id, 'K/2', 'Married with 2 Children'),
        (v_company_id, 'K/3', 'Married with 3 Children')
        ON CONFLICT (company_id, name) DO NOTHING;

        -- 7. Contoh Absence Types
        INSERT INTO absence_types (company_id, code, name, description, category) VALUES
        (v_company_id, 'OFF', 'Day Off', 'Scheduled day off', 'off_day'),
        (v_company_id, 'AL', 'Annual Leave', 'Employee annual leave', 'leave'),
        (v_company_id, 'SL', 'Sick Leave', 'Employee sick leave', 'leave'),
        (v_company_id, 'UL', 'Unpaid Leave', 'Employee unpaid leave', 'leave')
        ON CONFLICT (company_id, code) DO NOTHING;

        -- Dapatkan ID untuk marital status 'TK' (Tidak Kawin)
        SELECT id INTO v_marital_tk_id FROM marital_statuses WHERE company_id = v_company_id AND name = 'TK' LIMIT 1;
        SELECT id INTO v_marital_k0_id FROM marital_statuses WHERE company_id = v_company_id AND name = 'K/0' LIMIT 1;

        -- 8. Contoh Pengguna Karyawan
        -- Dapatkan ID untuk departemen, jabatan, dan jam kerja yang akan digunakan
        SELECT id INTO v_dept_fo_id FROM departments WHERE company_id = v_company_id AND name = 'Front Office';
        SELECT id INTO v_dept_hk_id FROM departments WHERE company_id = v_company_id AND name = 'Housekeeping';
        SELECT id INTO v_dept_fb_id FROM departments WHERE company_id = v_company_id AND name = 'Food & Beverage';
        SELECT id INTO v_dept_hr_id FROM departments WHERE company_id = v_company_id AND name = 'Human Resources';
        SELECT id INTO v_pos_fda_id FROM positions WHERE company_id = v_company_id AND name = 'Front Desk Agent';
        SELECT id INTO v_pos_ra_id FROM positions WHERE company_id = v_company_id AND name = 'Room Attendant';
        SELECT id INTO v_pos_waiter_id FROM positions WHERE company_id = v_company_id AND name = 'Waiter/Waitress';
        SELECT id INTO v_pos_hrm_id FROM positions WHERE company_id = v_company_id AND name = 'HR Manager';
        SELECT id INTO v_ws_pagi_id FROM work_schedules WHERE company_id = v_company_id AND code = 'PAGI';
        SELECT id INTO v_ws_siang_id FROM work_schedules WHERE company_id = v_company_id AND code = 'SIANG';
        SELECT id INTO v_ws_malam_id FROM work_schedules WHERE company_id = v_company_id AND code = 'MALAM';
        SELECT id INTO v_ws_office_id FROM work_schedules WHERE company_id = v_company_id AND code = 'OFFICE';
        SELECT id INTO v_status_pkwt_id FROM employee_statuses WHERE company_id = v_company_id AND name = 'PKWT';
        SELECT id INTO v_status_dw_id FROM employee_statuses WHERE company_id = v_company_id AND name = 'DW';
        SELECT id INTO v_level_staff_id FROM employee_levels WHERE company_id = v_company_id AND name = 'Level 1 (Staff)';
        SELECT id INTO v_level_mgr_id FROM employee_levels WHERE company_id = v_company_id AND name = 'Level 3 (Manager)';

        -- Buat user 'john.doe' dan langsung tetapkan ke departemen, jabatan, dan jam kerjanya
        WITH new_user AS (
          INSERT INTO users (company_id, department_id, position_id, work_schedule_id, employee_status_id, employee_level_id, username, email, password, role, join_date, contract_start_date, contract_end_date, is_active)
          VALUES (
            v_company_id,
            v_dept_fo_id,
            v_pos_fda_id,
            v_ws_pagi_id,
            v_status_pkwt_id,
            v_level_staff_id,
            'John Doe',
            'john.doe@example.com',
            '$2a$08$kfreE/.d5gvjKxIhf3tLd.m5L3T3i2c1G.s4H5i6J7k8L9m0N1o2', -- password is 'password123'
            'user',
            '2023-01-15', -- Tanggal join awal
            '2024-04-01', -- Contoh tanggal mulai kontrak baru
            '2025-03-31', -- Contoh tanggal akhir kontrak
            TRUE
        )
        ON CONFLICT (email) DO NOTHING
        RETURNING id
        )
        INSERT INTO user_profiles (user_id, full_name, phone_number, date_of_birth, gender, marital_status_id, religion, address)
        SELECT
            id,
            'John Doe',
            '081234567890',
            '1995-05-10',
            'Laki-laki',
            v_marital_tk_id,
            'Islam',
            'Jl. Contoh No. 123, Jakarta'
        FROM new_user;

        -- Karyawan 2: Jane Smith (Housekeeping)
        WITH new_user AS (
          INSERT INTO users (company_id, department_id, position_id, work_schedule_id, employee_status_id, employee_level_id, username, email, password, role, join_date, is_active)
          VALUES (v_company_id, v_dept_hk_id, v_pos_ra_id, v_ws_siang_id, v_status_pkwt_id, v_level_staff_id, 'Jane Smith', 'jane.smith@example.com', '$2a$08$kfreE/.d5gvjKxIhf3tLd.m5L3T3i2c1G.s4H5i6J7k8L9m0N1o2', 'user', '2023-03-01', TRUE)
          ON CONFLICT (email) DO NOTHING RETURNING id
        )
        INSERT INTO user_profiles (user_id, full_name, phone_number, date_of_birth, gender, marital_status_id, religion, address)
        SELECT id, 'Jane Smith', '081234567891', '1998-08-20', 'Perempuan', v_marital_tk_id, 'Kristen', 'Jl. Mawar No. 45, Bandung' FROM new_user;

        -- Karyawan 3: Budi Santoso (Food & Beverage)
        WITH new_user AS (
          INSERT INTO users (company_id, department_id, position_id, work_schedule_id, employee_status_id, employee_level_id, username, email, password, role, join_date, is_active)
          VALUES (v_company_id, v_dept_fb_id, v_pos_waiter_id, v_ws_pagi_id, v_status_dw_id, v_level_staff_id, 'Budi Santoso', 'budi.santoso@example.com', '$2a$08$kfreE/.d5gvjKxIhf3tLd.m5L3T3i2c1G.s4H5i6J7k8L9m0N1o2', 'user', '2023-05-11', TRUE)
          ON CONFLICT (email) DO NOTHING RETURNING id
        )
        INSERT INTO user_profiles (user_id, full_name, phone_number, date_of_birth, gender, marital_status_id, religion, address)
        SELECT id, 'Budi Santoso', '081234567892', '2000-01-15', 'Laki-laki', v_marital_tk_id, 'Islam', 'Jl. Melati No. 10, Surabaya' FROM new_user;

        -- Karyawan 4: Siti Aminah (Human Resources)
        WITH new_user AS (
          INSERT INTO users (company_id, department_id, position_id, work_schedule_id, employee_status_id, employee_level_id, username, email, password, role, join_date, is_active)
          VALUES (v_company_id, v_dept_hr_id, v_pos_hrm_id, v_ws_office_id, v_status_pkwt_id, v_level_mgr_id, 'Siti Aminah', 'siti.aminah@example.com', '$2a$08$kfreE/.d5gvjKxIhf3tLd.m5L3T3i2c1G.s4H5i6J7k8L9m0N1o2', 'user', '2022-11-20', TRUE)
          ON CONFLICT (email) DO NOTHING RETURNING id
        )
        INSERT INTO user_profiles (user_id, full_name, phone_number, date_of_birth, gender, marital_status_id, religion, address)
        SELECT id, 'Siti Aminah', '081234567893', '1992-04-02', 'Perempuan', v_marital_k0_id, 'Islam', 'Jl. Anggrek No. 7, Jakarta' FROM new_user;

        -- Karyawan 5: Michael Chen (Front Office, Shift Malam)
        WITH new_user AS (
          INSERT INTO users (company_id, department_id, position_id, work_schedule_id, employee_status_id, employee_level_id, username, email, password, role, join_date, is_active)
          VALUES (v_company_id, v_dept_fo_id, v_pos_fda_id, v_ws_malam_id, v_status_dw_id, v_level_staff_id, 'Michael Chen', 'michael.chen@example.com', '$2a$08$kfreE/.d5gvjKxIhf3tLd.m5L3T3i2c1G.s4H5i6J7k8L9m0N1o2', 'user', '2023-09-01', TRUE)
          ON CONFLICT (email) DO NOTHING RETURNING id
        )
        INSERT INTO user_profiles (user_id, full_name, phone_number, date_of_birth, gender, marital_status_id, religion, address)
        SELECT id, 'Michael Chen', '081234567894', '1999-12-30', 'Laki-laki', v_marital_tk_id, 'Buddha', 'Jl. Gajah Mada No. 88, Jakarta' FROM new_user;

        -- Karyawan 6: Rina Wati (Inactive)
        WITH new_user AS (
          INSERT INTO users (company_id, department_id, position_id, work_schedule_id, employee_status_id, employee_level_id, username, email, password, role, join_date, is_active)
          VALUES (v_company_id, v_dept_hk_id, v_pos_ra_id, v_ws_pagi_id, v_status_pkwt_id, v_level_staff_id, 'Rina Wati', 'rina.wati@example.com', '$2a$08$kfreE/.d5gvjKxIhf3tLd.m5L3T3i2c1G.s4H5i6J7k8L9m0N1o2', 'user', '2022-08-15', FALSE)
          ON CONFLICT (email) DO NOTHING RETURNING id
        )
        INSERT INTO user_profiles (user_id, full_name, phone_number, date_of_birth, gender, marital_status_id, religion, address)
        SELECT id, 'Rina Wati', '081234567895', '1997-07-07', 'Perempuan', v_marital_tk_id, 'Islam', 'Jl. Kenanga No. 12, Bekasi' FROM new_user;

        -- Contoh Jadwal untuk beberapa karyawan
        -- Jadwalkan John Doe untuk bekerja Shift Pagi selama 5 hari ke depan
        INSERT INTO daily_schedule_assignments (user_id, company_id, assignment_date, work_schedule_id)
        SELECT u.id, v_company_id, d.day, v_ws_pagi_id
        FROM users u, generate_series(CURRENT_DATE, CURRENT_DATE + interval '4 days', '1 day') d(day)
        WHERE u.email = 'john.doe@example.com'
        ON CONFLICT (company_id, user_id, assignment_date) DO NOTHING;

        -- Jadwalkan John Doe libur (OFF) 2 hari setelahnya
        INSERT INTO daily_schedule_assignments (user_id, company_id, assignment_date, absence_type_id)
        SELECT u.id, v_company_id, d.day, (SELECT id FROM absence_types WHERE company_id = v_company_id AND code = 'OFF')
        FROM users u, generate_series(CURRENT_DATE + interval '5 days', CURRENT_DATE + interval '6 days', '1 day') d(day)
        WHERE u.email = 'john.doe@example.com'
        ON CONFLICT (company_id, user_id, assignment_date) DO NOTHING;

        -- Jadwalkan Jane Smith untuk bekerja Shift Siang selama 5 hari ke depan
        INSERT INTO daily_schedule_assignments (user_id, company_id, assignment_date, work_schedule_id)
        SELECT u.id, v_company_id, d.day, v_ws_siang_id
        FROM users u, generate_series(CURRENT_DATE, CURRENT_DATE + interval '4 days', '1 day') d(day)
        WHERE u.email = 'jane.smith@example.com'
        ON CONFLICT (company_id, user_id, assignment_date) DO NOTHING;

        -- Jadwalkan Budi Santoso untuk bekerja Shift Pagi selama 6 hari, lalu libur 1 hari
        INSERT INTO daily_schedule_assignments (user_id, company_id, assignment_date, work_schedule_id)
        SELECT u.id, v_company_id, d.day, v_ws_pagi_id
        FROM users u, generate_series(CURRENT_DATE, CURRENT_DATE + interval '5 days', '1 day') d(day)
        WHERE u.email = 'budi.santoso@example.com'
        ON CONFLICT (company_id, user_id, assignment_date) DO NOTHING;

        INSERT INTO daily_schedule_assignments (user_id, company_id, assignment_date, absence_type_id)
        SELECT u.id, v_company_id, CURRENT_DATE + interval '6 days', (SELECT id FROM absence_types WHERE company_id = v_company_id AND code = 'OFF')
        FROM users u
        WHERE u.email = 'budi.santoso@example.com'
        ON CONFLICT (company_id, user_id, assignment_date) DO NOTHING;

        -- Jadwalkan Siti Aminah (HR) untuk bekerja jam kantor dari Senin-Jumat untuk 2 minggu ke depan
        INSERT INTO daily_schedule_assignments (user_id, company_id, assignment_date, work_schedule_id)
        SELECT u.id, v_company_id, d.day, v_ws_office_id
        FROM users u, generate_series(CURRENT_DATE, CURRENT_DATE + interval '13 days', '1 day') d(day)
        WHERE u.email = 'siti.aminah@example.com' AND EXTRACT(ISODOW FROM d.day) BETWEEN 1 AND 5 -- Senin (1) sampai Jumat (5)
        ON CONFLICT (company_id, user_id, assignment_date) DO NOTHING;

        INSERT INTO daily_schedule_assignments (user_id, company_id, assignment_date, absence_type_id)
        SELECT u.id, v_company_id, d.day, (SELECT id FROM absence_types WHERE company_id = v_company_id AND code = 'OFF')
        FROM users u, generate_series(CURRENT_DATE, CURRENT_DATE + interval '13 days', '1 day') d(day)
        WHERE u.email = 'siti.aminah@example.com' AND EXTRACT(ISODOW FROM d.day) IN (6, 7) -- Sabtu (6) dan Minggu (7)
        ON CONFLICT (company_id, user_id, assignment_date) DO NOTHING;

        -- Jadwalkan Michael Chen untuk bekerja Shift Malam dengan pola 5 hari kerja, 2 hari libur (dengan offset)
        INSERT INTO daily_schedule_assignments (user_id, company_id, assignment_date, work_schedule_id)
        SELECT u.id, v_company_id, d.day, v_ws_malam_id
        FROM users u, generate_series(CURRENT_DATE + interval '2 days', CURRENT_DATE + interval '6 days', '1 day') d(day)
        WHERE u.email = 'michael.chen@example.com'
        ON CONFLICT (company_id, user_id, assignment_date) DO NOTHING;

        -- Contoh Absensi untuk John Doe
        INSERT INTO attendance (user_id, company_id, check_in_time, check_out_time, status)
        SELECT id, v_company_id, NOW() - interval '1 day' + time '07:05:00', NOW() - interval '1 day' + time '15:02:00', 'present'
        FROM users WHERE email = 'john.doe@example.com'
        ON CONFLICT DO NOTHING;

        INSERT INTO attendance (user_id, company_id, check_in_time, check_out_time, status)
        SELECT id, v_company_id, NOW() - interval '2 days' + time '06:58:00', NOW() - interval '2 days' + time '15:00:00', 'present'
        FROM users WHERE email = 'john.doe@example.com'
        ON CONFLICT DO NOTHING;

        -- Contoh Pengajuan Cuti untuk Budi Santoso
        INSERT INTO requests (user_id, company_id, request_type, status, start_date, end_date, reason, absence_type_id)
        SELECT u.id, v_company_id, 'leave', 'pending', CURRENT_DATE + interval '10 days', CURRENT_DATE + interval '10 days', 'Acara keluarga', at.id
        FROM users u, absence_types at
        WHERE u.email = 'budi.santoso@example.com' AND at.company_id = v_company_id AND at.code = 'AL'
        ON CONFLICT DO NOTHING;
    END IF;

    -- 9. Contoh Invoices (diasumsikan v_company_id masih ada dari blok sebelumnya)
    IF v_company_id IS NOT NULL THEN
        -- Hapus data invoice lama untuk perusahaan ini agar tidak duplikat saat re-run
        DELETE FROM invoices WHERE company_id = v_company_id;
        
        -- Masukkan data invoice baru yang lebih dinamis dan menunjukkan histori
        -- Asumsi tagihan bulanan adalah 190,000 (10 karyawan * 19,000)
        INSERT INTO invoices (company_id, amount, due_date, status, created_at) VALUES
        (v_company_id, 190000, NOW() + interval '14 days', 'due', NOW() - interval '1 day'),      -- Tagihan bulan ini, baru dibuat
        (v_company_id, 190000, NOW() - interval '16 days', 'paid', NOW() - interval '31 days'),   -- Tagihan bulan lalu, sudah lunas
        (v_company_id, 190000, NOW() - interval '46 days', 'paid', NOW() - interval '61 days'),   -- Tagihan 2 bulan lalu, sudah lunas
        (v_company_id, 190000, NOW() - interval '76 days', 'paid', NOW() - interval '91 days'),   -- Tagihan 3 bulan lalu, sudah lunas
        (v_company_id, 190000, NOW() - interval '106 days', 'paid', NOW() - interval '121 days'), -- Tagihan 4 bulan lalu, sudah lunas
        (v_company_id, 190000, NOW() - interval '166 days', 'overdue', NOW() - interval '181 days'); -- Tagihan lama yang terlewat (overdue)
    END IF;
END $$;

-- Insert default SaaS settings
INSERT INTO saas_settings (key, value) VALUES
('saas_company_name', 'SaaS Corp.'),
('saas_company_address', 'Jl. Teknologi No. 1, Jakarta, Indonesia'),
('saas_npwp', '01.234.567.8-901.000'),
('saas_bank_account', 'BCA - 1234567890 a/n SaaS Corp.'),
('saas_invoice_signature_text', 'Hormat kami,'),
('saas_invoice_signature_name', 'Finance Manager'),
('saas_tax_ppn_rate', '11'),
('saas_tax_pph23_rate', '2')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
