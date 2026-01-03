require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

// DB connection
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false }
});

// Test route
app.get("/", (req, res) => {
  res.send("Attendance API is running");
});

// LOGIN API
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email & password required" });
  }

  try {
    const result = await pool.query(
      "SELECT id, email, role FROM users WHERE email=$1 AND password=$2",
      [email, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.json({
      message: "Login successful",
      user: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Attendance In API
app.post("/attendance/in", async (req, res) => {
  const { employee_id } = req.body;

  try {
    const today = new Date().toISOString().split("T")[0];
    const time = new Date().toTimeString().split(" ")[0];

    await pool.query(
      `INSERT INTO attendance (employee_id, attendance_date, in_time)
       VALUES ($1, $2, $3)`,
      [employee_id, today, time]
    );

    res.json({ message: "Attendance IN marked" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Attendance Out API
app.post("/attendance/out", async (req, res) => {
  const { employee_id } = req.body;

  try {
    const outTime = new Date().toTimeString().split(" ")[0];

    // Get IN time
    const result = await pool.query(
      `SELECT in_time 
       FROM attendance 
       WHERE employee_id=$1 AND attendance_date=CURRENT_DATE`,
      [employee_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Attendance IN not found" });
    }

    const inTime = result.rows[0].in_time;

    // Calculate working hours
    const inDate = new Date(`1970-01-01T${inTime}`);
    const outDate = new Date(`1970-01-01T${outTime}`);
    const hours = (outDate - inDate) / (1000 * 60 * 60);

    await pool.query(
      `UPDATE attendance
       SET out_time=$1, working_hours=$2
       WHERE employee_id=$3 AND attendance_date=CURRENT_DATE`,
      [outTime, hours.toFixed(2), employee_id]
    );

    res.json({
      message: "Attendance OUT marked",
      working_hours: hours.toFixed(2)
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




// Server start
const PORT = 3000;
app.listen(PORT, () => {
  console.log("Server running on http://localhost:" + PORT);
});
