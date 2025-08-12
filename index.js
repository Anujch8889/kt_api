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
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS courses (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                long_description TEXT,
                duration TEXT,
                price NUMERIC,
                level TEXT,
                image_url TEXT
            );
        `);
        console.log("✅ Table ready");
    } catch (err) {
        console.error("❌ Error creating table:", err);
    }
})();

// Root route
app.get("/", (req, res) => {
    res.send("Hello, I am live with PostgreSQL!");
});

// GET all courses
app.get("/courses", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM courses ORDER BY id ASC");
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Database query failed" });
    }
});

// POST new course
app.post("/courses", async (req, res) => {
    try {
        const { title, description, long_description, duration, price, level, image_url } = req.body;

        if (!title) {
            return res.status(400).json({ error: "Title is required" });
        }

        const result = await pool.query(
            `INSERT INTO courses (title, description, long_description, duration, price, level, image_url) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [title, description, long_description, duration, price, level, image_url]
        );

        res.status(201).json({
            message: "Course added successfully",
            data: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to add course" });
    }
});

app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});
