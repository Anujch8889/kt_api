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
    ssl: { rejectUnauthorized: false }
});

// Debug middleware for requests
app.use((req, res, next) => {
    console.log(`🔍 ${req.method} ${req.url} - ${new Date().toISOString()}`);
    if (req.method === 'POST' || req.method === 'PUT') {
        console.log("Headers:", req.headers);
        console.log("Body:", req.body);
    }
    next();
});

// Enhanced table creation with detailed logging
(async () => {
    try {
        console.log("🔄 Checking and creating table...");
        
        // Create table if not exists (safer approach)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS courses (
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
        
        console.log("✅ Table ready");
        
    } catch (err) {
        console.error("❌ Table creation error:", err.message);
    }
})();

// Root route
app.get("/", (req, res) => {
    res.json({
        message: "Hello, I am live with Anuj!",
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

// GET single course by ID
app.get("/courses/:id", async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`📥 GET /courses/${id} request received`);
        
        const result = await pool.query("SELECT * FROM courses WHERE id = $1", [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: "Course not found",
                id: id
            });
        }
        
        console.log(`✅ Found course with id ${id}`);
        res.json(result.rows[0]);
    } catch (error) {
        console.error(`❌ GET /courses/${req.params.id} error:`, error);
        res.status(500).json({ error: "Database query failed" });
    }
});

// POST new course
app.post("/courses", async (req, res) => {
    try {
        console.log("📨 POST /courses request received");
        console.log("Request Body:", JSON.stringify(req.body, null, 2));

        const { title, description, long_description, duration, price, level, image_url } = req.body;

        console.log("Extracted values:", {
            title: title || "MISSING",
            description: description || "MISSING",
            long_description: long_description || "MISSING",
            duration: duration || "MISSING",
            price: price || "MISSING",
            level: level || "MISSING",
            image_url: image_url || "MISSING"
        });

        if (!title || title.trim() === '') {
            console.log("❌ Validation failed: Title is required");
            return res.status(400).json({ 
                error: "Title is required",
                received: { title }
            });
        }

        console.log("💾 Attempting database insert...");
        
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
        console.error("❌ POST /courses error:", error);
        res.status(500).json({ 
            error: "Failed to add course",
            details: error.message,
            code: error.code,
            success: false
        });
    }
});

// PUT update course by ID - ⭐ यह route missing था
app.put("/courses/:id", async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`📝 PUT /courses/${id} request received`);
        console.log("Request Body:", JSON.stringify(req.body, null, 2));

        const { title, description, long_description, duration, price, level, image_url } = req.body;

        // Validation
        if (!title || title.trim() === '') {
            console.log("❌ Validation failed: Title is required");
            return res.status(400).json({ 
                error: "Title is required",
                received: { title }
            });
        }

        // Check if course exists
        const existingCourse = await pool.query("SELECT * FROM courses WHERE id = $1", [id]);
        
        if (existingCourse.rows.length === 0) {
            return res.status(404).json({ 
                error: "Course not found",
                id: id
            });
        }

        console.log("💾 Attempting database update...");
        
        const result = await pool.query(
            `UPDATE courses 
             SET title = $1, description = $2, long_description = $3, 
                 duration = $4, price = $5, level = $6, image_url = $7
             WHERE id = $8 RETURNING *`,
            [title, description, long_description, duration, price, level, image_url, id]
        );

        console.log("✅ Database update successful:", result.rows[0]);

        res.json({
            message: "Course updated successfully",
            data: result.rows[0],
            success: true
        });
        
    } catch (error) {
        console.error(`❌ PUT /courses/${req.params.id} error:`, error);
        res.status(500).json({ 
            error: "Failed to update course",
            details: error.message,
            success: false
        });
    }
});

// DELETE course by ID - ⭐ यह route भी missing था
app.delete("/courses/:id", async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🗑️ DELETE /courses/${id} request received`);

        // Check if course exists
        const existingCourse = await pool.query("SELECT * FROM courses WHERE id = $1", [id]);
        
        if (existingCourse.rows.length === 0) {
            return res.status(404).json({ 
                error: "Course not found",
                id: id
            });
        }

        console.log("💾 Attempting database delete...");
        
        const result = await pool.query(
            "DELETE FROM courses WHERE id = $1 RETURNING *",
            [id]
        );

        console.log("✅ Database delete successful:", result.rows[0]);

        res.json({
            message: "Course deleted successfully",
            data: result.rows[0],
            success: true
        });
        
    } catch (error) {
        console.error(`❌ DELETE /courses/${req.params.id} error:`, error);
        res.status(500).json({ 
            error: "Failed to delete course",
            details: error.message,
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
    console.log(`❌ 404 - Route not found: ${req.method} ${req.url}`);
    res.status(404).json({
        error: "Route not found",
        method: req.method,
        url: req.url,
        timestamp: new Date().toISOString(),
        availableRoutes: [
            "GET /",
            "GET /health", 
            "GET /test-connection",
            "GET /courses",
            "GET /courses/:id",
            "POST /courses",
            "PUT /courses/:id",
            "DELETE /courses/:id"
        ]
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
    console.log('📋 Available routes:');
    console.log('   GET    /');
    console.log('   GET    /health');
    console.log('   GET    /test-connection');
    console.log('   GET    /courses');
    console.log('   GET    /courses/:id');
    console.log('   POST   /courses');
    console.log('   PUT    /courses/:id');
    console.log('   DELETE /courses/:id');
});

