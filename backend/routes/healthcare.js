'use strict';

const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

let initPromise = null;
function ensureHealthcareSchema() {
  if (!initPromise) {
    initPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS healthcare_doctors (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          specialty TEXT NOT NULL,
          experience_years INTEGER NOT NULL DEFAULT 0,
          city TEXT NOT NULL,
          consultation_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
          rating NUMERIC(3,2) NOT NULL DEFAULT 4.5,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS healthcare_patients (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          age INTEGER NOT NULL,
          condition TEXT NOT NULL,
          phone TEXT NOT NULL,
          email TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS healthcare_appointments (
          id SERIAL PRIMARY KEY,
          patient_id INTEGER NOT NULL REFERENCES healthcare_patients(id) ON DELETE CASCADE,
          doctor_id INTEGER NOT NULL REFERENCES healthcare_doctors(id) ON DELETE CASCADE,
          appointment_date DATE NOT NULL,
          slot TIME NOT NULL,
          consult_type TEXT NOT NULL CHECK (consult_type IN ('Video', 'Clinic')),
          status TEXT NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Completed', 'Cancelled', 'No Show')),
          created_by TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      const doctorCount = await pool.query('SELECT COUNT(*)::int AS count FROM healthcare_doctors');
      if (!doctorCount.rows[0].count) {
        await pool.query(`
          INSERT INTO healthcare_doctors(name, specialty, experience_years, city, consultation_fee, rating) VALUES
          ('Dr. Priya Nair', 'Dermatology', 11, 'Bangalore', 700, 4.8),
          ('Dr. Ethan Brooks', 'Cardiology', 14, 'New York', 140, 4.7),
          ('Dr. Kavya Iyer', 'Pediatrics', 9, 'Hyderabad', 550, 4.9)
        `);
      }

      const patientCount = await pool.query('SELECT COUNT(*)::int AS count FROM healthcare_patients');
      if (!patientCount.rows[0].count) {
        await pool.query(`
          INSERT INTO healthcare_patients(name, age, condition, phone, email) VALUES
          ('Riya Sharma', 29, 'Migraine', '+91-9000000001', 'riya@example.com'),
          ('Michael Reed', 41, 'Type 2 Diabetes', '+1-555-555-1024', 'mike@example.com')
        `);
      }
    })();
  }

  return initPromise;
}

router.use(requireAuth);
router.use(async (_req, res, next) => {
  try {
    await ensureHealthcareSchema();
    next();
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/overview', async (_req, res) => {
  try {
    const [doctors, patients, appointments] = await Promise.all([
      pool.query('SELECT id, name, specialty, experience_years AS "experienceYears", city, consultation_fee AS "consultationFee", rating FROM healthcare_doctors ORDER BY rating DESC, id DESC'),
      pool.query('SELECT id, name, age, condition, phone, email FROM healthcare_patients ORDER BY id DESC'),
      pool.query(`
        SELECT a.id, a.appointment_date AS date, to_char(a.slot, 'HH24:MI') AS slot, a.consult_type AS type, a.status,
               a.patient_id AS "patientId", p.name AS "patientName",
               a.doctor_id AS "doctorId", d.name AS "doctorName", d.specialty
        FROM healthcare_appointments a
        JOIN healthcare_patients p ON p.id = a.patient_id
        JOIN healthcare_doctors d ON d.id = a.doctor_id
        ORDER BY a.appointment_date ASC, a.slot ASC
      `),
    ]);

    res.json({
      ok: true,
      doctors: doctors.rows,
      patients: patients.rows,
      appointments: appointments.rows,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/doctors', async (req, res) => {
  try {
    const { name, specialty, experienceYears = 0, city, consultationFee = 0, rating = 4.5 } = req.body || {};
    if (!name || !specialty || !city) return res.status(400).json({ ok: false, error: 'name, specialty, city required' });

    const { rows } = await pool.query(
      `INSERT INTO healthcare_doctors(name, specialty, experience_years, city, consultation_fee, rating)
       VALUES($1,$2,$3,$4,$5,$6)
       RETURNING id, name, specialty, experience_years AS "experienceYears", city, consultation_fee AS "consultationFee", rating`,
      [name, specialty, Number(experienceYears) || 0, city, Number(consultationFee) || 0, Number(rating) || 4.5]
    );

    res.status(201).json({ ok: true, doctor: rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/patients', async (req, res) => {
  try {
    const { name, age, condition, phone, email = null } = req.body || {};
    if (!name || !age || !condition || !phone) return res.status(400).json({ ok: false, error: 'name, age, condition, phone required' });

    const { rows } = await pool.query(
      `INSERT INTO healthcare_patients(name, age, condition, phone, email)
       VALUES($1,$2,$3,$4,$5)
       RETURNING id, name, age, condition, phone, email`,
      [name, Number(age), condition, phone, email]
    );

    res.status(201).json({ ok: true, patient: rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/appointments', async (req, res) => {
  try {
    const { patientId, doctorId, date, slot, type = 'Video', status = 'Scheduled' } = req.body || {};
    if (!patientId || !doctorId || !date || !slot) {
      return res.status(400).json({ ok: false, error: 'patientId, doctorId, date, slot required' });
    }

    const clash = await pool.query(
      `SELECT id FROM healthcare_appointments
       WHERE doctor_id = $1 AND appointment_date = $2 AND slot = $3 AND status = 'Scheduled'
       LIMIT 1`,
      [Number(doctorId), date, slot]
    );

    if (clash.rowCount > 0) {
      return res.status(409).json({ ok: false, error: 'Doctor already has an appointment in this slot' });
    }

    const { rows } = await pool.query(
      `INSERT INTO healthcare_appointments(patient_id, doctor_id, appointment_date, slot, consult_type, status, created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, appointment_date AS date, to_char(slot, 'HH24:MI') AS slot, consult_type AS type, status, patient_id AS "patientId", doctor_id AS "doctorId"`,
      [Number(patientId), Number(doctorId), date, slot, type, status, req.user?.email || null]
    );

    res.status(201).json({ ok: true, appointment: rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.patch('/appointments/:id/status', async (req, res) => {
  try {
    const valid = ['Scheduled', 'Completed', 'Cancelled', 'No Show'];
    const status = String(req.body?.status || '');
    if (!valid.includes(status)) return res.status(400).json({ ok: false, error: 'Invalid status' });

    const { rows } = await pool.query(
      `UPDATE healthcare_appointments
       SET status = $1
       WHERE id = $2
       RETURNING id, appointment_date AS date, to_char(slot, 'HH24:MI') AS slot, consult_type AS type, status, patient_id AS "patientId", doctor_id AS "doctorId"`,
      [status, Number(req.params.id)]
    );

    if (!rows[0]) return res.status(404).json({ ok: false, error: 'Appointment not found' });
    res.json({ ok: true, appointment: rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
