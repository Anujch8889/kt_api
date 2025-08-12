const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3000;

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Render PostgreSQL ke liye zaroori
});

// Create table if not exists
(async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS courses (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT
        );
    `);
})();

// Root route
app.get("/", (req, res) => {
    res.send("Hello, I am live with PostgreSQL!");
});

// GET all courses
app.get("/courses", async (req, res) => {
    const result = await pool.query("SELECT * FROM courses ORDER BY id ASC");
    res.json(result.rows);
});

// POST new course
app.post("/courses", async (req, res) => {
    const { name, description } = req.body;
    const result = await pool.query(
        "INSERT INTO courses (name, description) VALUES ($1, $2) RETURNING *",
        [name, description]
    );
    res.status(201).json({
        message: "Course added successfully",
        data: result.rows[0]
    });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
