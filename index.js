const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3000;
const dataFilePath = path.join(__dirname, "data.json");

// Helper function to load data
function loadData() {
    const rawData = fs.readFileSync(dataFilePath);
    return JSON.parse(rawData);
}

// Helper function to save data
function saveData(data) {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
}

app.get("/", (req, res) => {
    res.send("Hello i am live");
});

// GET all courses
app.get("/courses", (req, res) => {
    const data = loadData();
    res.send(data);
});

// POST new course
app.post("/courses", (req, res) => {
    const courses = loadData();

    // Auto increment ID
    const newId = (Math.max(...courses.map(c => Number(c.id))) + 1).toString();

    const newCourse = { id: newId, ...req.body };
    courses.push(newCourse);

    // Save to file
    saveData(courses);

    res.status(201).send({
        message: "Course added successfully",
        data: newCourse
    });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
