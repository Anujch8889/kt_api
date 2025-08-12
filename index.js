const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

// Enhanced CORS configuration
app.use(cors({
    origin: ['http://localhost:19006', 'exp://'], // Add Expo origins
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Enhanced JSON parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const port = process.env.PORT || 3000;

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Render PostgreSQL ke liye zaroori
});

// Debug middleware for POST requests
app.use((req, res, next) => {
    if (req.method === 'POST' && req.url === '/courses') {
        console.log("🔍 Debug POST /courses:");
        console.log("Headers:", req.headers);
        console.log("Body:", req.body);
        console.log("Body type:", typeof req.body);
        console.log("Content-Length:", req.headers['content-length']);
    }
    next();
});

// Enhanced table creation with detailed logging
(async () => {
    try {
        console.log("🔄 Dropping and recreating table...");
        
        // Drop table if exists (be careful - this will delete existing data)
        await pool.query(`DROP TABLE IF EXISTS courses;`);
        
        // Create fresh table
        await pool.query(`
            CREATE TABLE courses (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                long_description TEXT,
                duration TEXT,
                price NUMERIC,
                level TEXT,
                image_url TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        
        console.log("✅ Table recreated successfully");
        
    } catch (err) {
        console.error("❌ Table recreation error:", err.message);
    }
})();

// Root route
app.get("/", (req, res) => {
    res.json({
        message: "Hello, I am live with PostgreSQL!",
        timestamp: new Date().toISOString(),
        status: "running"
    });
});

// Database connection test route
app.get("/test-connection", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW(), version()");
        res.json({ 
            success: true, 
            time: result.rows[0].now,
            version: result.rows[0].version,
            message: "Database connected successfully!"
        });
    } catch (error) {
        console.error("❌ Database test failed:", error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            message: "Database connection failed"
        });
    }
});

// GET all courses
app.get("/courses", async (req, res) => {
    try {
        console.log("📥 GET /courses request received");
        const result = await pool.query("SELECT * FROM courses ORDER BY id ASC");
        console.log(`✅ Found ${result.rows.length} courses`);
        res.json(result.rows);
    } catch (error) {
        console.error("❌ GET /courses error:", error);
        res.status(500).json({ error: "Database query failed" });
    }
});

// POST new course - Enhanced with detailed debugging
app.post("/courses", async (req, res) => {
    try {
        // Log incoming request data
        console.log("📨 POST /courses request received");
        console.log("Request Body:", JSON.stringify(req.body, null, 2));
        console.log("Content-Type:", req.headers['content-type']);

        const { title, description, long_description, duration, price, level, image_url } = req.body;

        // Log extracted values
        console.log("Extracted values:", {
            title: title || "MISSING",
            description: description || "MISSING",
            long_description: long_description || "MISSING",
            duration: duration || "MISSING",
            price: price || "MISSING",
            level: level || "MISSING",
            image_url: image_url || "MISSING"
        });

        // Enhanced validation
        if (!title || title.trim() === '') {
            console.log("❌ Validation failed: Title is required");
            return res.status(400).json({ 
                error: "Title is required",
                received: { title }
            });
        }

        console.log("💾 Attempting database insert...");
        console.log("SQL Values:", [title, description, long_description, duration, price, level, image_url]);
        
        const result = await pool.query(
            `INSERT INTO courses (title, description, long_description, duration, price, level, image_url) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [title, description, long_description, duration, price, level, image_url]
        );

        console.log("✅ Database insert successful:", result.rows[0]);

        res.status(201).json({
            message: "Course added successfully",
            data: result.rows[0],
            success: true
        });
        
    } catch (error) {
        // Detailed error logging
        console.error("❌ POST /courses error:");
        console.error("Error message:", error.message);
        console.error("Error code:", error.code);
        console.error("Error detail:", error.detail);
        console.error("Error hint:", error.hint);
        console.error("Error stack:", error.stack);
        
        res.status(500).json({ 
            error: "Failed to add course",
            details: error.message,
            code: error.code,
            success: false
        });
    }
});

// Health check route
app.get("/health", (req, res) => {
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: "Route not found",
        method: req.method,
        url: req.url,
        timestamp: new Date().toISOString()
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error("🔥 Unhandled error:", err);
    res.status(500).json({
        error: "Internal server error",
        message: err.message,
        timestamp: new Date().toISOString()
    });
});

app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Database URL configured: ${!!process.env.DATABASE_URL}`);
});

