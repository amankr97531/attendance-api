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

  try {
    const result = await pool.query(
  `SELECT u.id as user_id, u.email, u.role, u.approved, e.id as employee_id
   FROM users u
   LEFT JOIN employees e ON u.id = e.user_id
   WHERE u.email=$1 AND u.password=$2`,
  [email, password]
);


    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];

    if (user.role === "employee" && user.approved === false) {
      return res.status(403).json({ message: "Admin approval pending" });
    }

    res.json({ message: "Login successful", user });
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

// EMPLOYEE REGISTER
app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  try {
    const userResult = await pool.query(
      "INSERT INTO users (email, password, role, approved) VALUES ($1,$2,'employee',false) RETURNING id",
      [email, password]
    );

    const userId = userResult.rows[0].id;

    await pool.query(
      "INSERT INTO employees (user_id) VALUES ($1)",
      [userId]
    );

    res.json({ message: "Registration successful. Wait for admin approval." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LIST PENDING EMPLOYEES
app.get("/admin/pending", async (req, res) => {
  const result = await pool.query(
    "SELECT id, email FROM users WHERE role='employee' AND approved=false"
  );
  res.json(result.rows);
});

// APPROVE EMPLOYEE
app.post("/admin/approve", async (req, res) => {
  const { user_id } = req.body;

  await pool.query(
    "UPDATE users SET approved=true WHERE id=$1",
    [user_id]
  );

  res.json({ message: "Employee approved" });
});






// Server start
const PORT = 3000;
app.listen(PORT, () => {
  console.log("Server running on http://localhost:" + PORT);
});
