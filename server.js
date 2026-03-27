require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const Groq = require("groq-sdk");

const app = express();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/studyplanner")
.then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// Schema & Model
const SubjectSchema = new mongoose.Schema({
  name: String,
  difficulty: String,
  hours: Number,
  createdAt: { type: Date, default: Date.now }
});

const Subject = mongoose.model("Subject", SubjectSchema);

// Add a subject
app.post("/addSubject", async (req, res) => {
  try {
    const { name, difficulty, hours } = req.body;
    if (!name || !difficulty || !hours) {
      return res.status(400).json({ error: "name, difficulty, and hours are required" });
    }
    const subject = new Subject({ name, difficulty, hours });
    await subject.save();
    res.json({ message: "Subject saved successfully", subject });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all subjects
app.get("/subjects", async (req, res) => {
  try {
    const subjects = await Subject.find().sort({ createdAt: -1 });
    res.json(subjects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a subject
app.delete("/subjects/:id", async (req, res) => {
  try {
    await Subject.findByIdAndDelete(req.params.id);
    res.json({ message: "Subject deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate AI Study Plan using Groq (FREE)
app.post("/generatePlan", async (req, res) => {
  try {
    const subjects = await Subject.find();

    if (subjects.length === 0) {
      return res.status(400).json({ error: "No subjects found. Please add subjects first." });
    }

    const { totalDays, studyHoursPerDay, startDate } = req.body;

    const subjectList = subjects.map(s =>
      `- ${s.name}: Difficulty = ${s.difficulty}, Available Hours = ${s.hours}`
    ).join("\n");

    const prompt = `You are an expert study planner. Create a detailed, personalized study schedule.

Student's subjects:
${subjectList}

Planning details:
- Total study days available: ${totalDays || 7}
- Study hours per day: ${studyHoursPerDay || 4}
- Start date: ${startDate || new Date().toDateString()}

Rules:
1. Allocate MORE sessions/time to Hard subjects, MEDIUM to Medium, LESS to Easy
2. Spread subjects across all days — don't bunch one subject together
3. Each session should be 1-2 hours max (for focus)
4. Include short breaks between sessions
5. Give realistic daily time slots (e.g., 9:00 AM - 11:00 AM)

Respond ONLY with a valid JSON object in this exact format (no markdown, no extra text):
{
  "summary": "Brief 1-2 sentence overview of the plan",
  "totalHours": 20,
  "plan": [
    {
      "day": 1,
      "date": "Monday, Mar 18",
      "sessions": [
        {
          "time": "9:00 AM - 11:00 AM",
          "subject": "subject name",
          "topic": "what to focus on",
          "duration": "2 hours",
          "difficulty": "Hard"
        }
      ]
    }
  ],
  "tips": ["tip1", "tip2", "tip3"]
}`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 2000,
    });

    const rawText = completion.choices[0].message.content;
    const cleanText = rawText.replace(/```json|```/g, "").trim();
    const studyPlan = JSON.parse(cleanText);

    res.json({ success: true, studyPlan });

  } catch (err) {
    console.error("Error generating plan:", err);
    res.status(500).json({ error: err.message });
  }
});

// Start Server
app.listen(5000, () => {
  console.log("🚀 Server running on http://localhost:5000");
});