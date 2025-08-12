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

// ✅ SAFE TABLE CREATION - Data preserve रहेगा
(async () => {
    try {
        console.log("🔄 Ensuring table exists...");
        
        // ✅ CREATE TABLE IF NOT EXISTS - यह existing data को delete नहीं करता
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
        
        console.log("✅ Table ready (existing data preserved)");
        
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

// PUT update course by ID
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

// DELETE course by ID
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

// Reset ID sequence route
app.post("/courses/reset-sequence", async (req, res) => {
    try {
        console.log("🔄 Resetting course ID sequence...");
        
        // Get current courses ordered by creation time
        const coursesResult = await pool.query("SELECT * FROM courses ORDER BY created_at ASC");
        const courses = coursesResult.rows;
        
        if (courses.length === 0) {
            // If no courses, just reset sequence to 1
            await pool.query("ALTER SEQUENCE courses_id_seq RESTART WITH 1");
            return res.json({
                message: "ID sequence reset successfully (no courses found)",
                success: true
            });
        }
        
        // Temporarily drop the constraint to allow ID updates
        await pool.query("ALTER TABLE courses DROP CONSTRAINT courses_pkey");
        
        // Update IDs sequentially
        for (let i = 0; i < courses.length; i++) {
            const newId = i + 1;
            const oldId = courses[i].id;
            
            await pool.query("UPDATE courses SET id = $1 WHERE id = $2", [newId, oldId]);
        }
        
        // Recreate the primary key constraint
        await pool.query("ALTER TABLE courses ADD CONSTRAINT courses_pkey PRIMARY KEY (id)");
        
        // Reset the sequence to start from the next number
        await pool.query(`ALTER SEQUENCE courses_id_seq RESTART WITH ${courses.length + 1}`);
        
        console.log("✅ ID sequence reset successful");
        
        res.json({
            message: "Course IDs reorganized successfully",
            success: true,
            totalCourses: courses.length,
            nextId: courses.length + 1
        });
        
    } catch (error) {
        console.error("❌ Sequence reset error:", error);
        
        // Try to restore the primary key if something went wrong
        try {
            await pool.query("ALTER TABLE courses ADD CONSTRAINT courses_pkey PRIMARY KEY (id)");
        } catch (restoreError) {
            console.error("❌ Failed to restore primary key:", restoreError);
        }
        
        res.status(500).json({ 
            error: "Failed to reset sequence",
            details: error.message,
            success: false
        });
    }
});

// ✅ BONUS: Emergency table recreation route (केवल जरूरत पड़ने पर use करें)
app.post("/courses/recreate-table", async (req, res) => {
    try {
        console.log("🚨 EMERGENCY: Recreating table (THIS WILL DELETE ALL DATA!)...");
        
        // Drop table if exists
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
        
        res.json({
            message: "⚠️ Table recreated successfully (ALL DATA DELETED)",
            success: true,
            warning: "This action deleted all existing courses!"
        });
        
    } catch (error) {
        console.error("❌ Table recreation error:", error);
        res.status(500).json({ 
            error: "Failed to recreate table",
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
            "DELETE /courses/:id",
            "POST /courses/reset-sequence",
            "POST /courses/recreate-table (EMERGENCY ONLY)"
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
    console.log('   POST   /courses/reset-sequence');
    console.log('   POST   /courses/recreate-table (EMERGENCY)');
});
