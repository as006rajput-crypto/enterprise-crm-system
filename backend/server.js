
require("node:dns").setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Lead Schema
const leadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    company: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["New", "Contacted", "Qualified", "Won", "Lost"],
      default: "New",
    },
  },
  { timestamps: true }
);

const Lead = mongoose.model("Lead", leadSchema);

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Enterprise CRM System API is running!",
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected",
  });
});

// Get All Leads
app.get("/api/leads", async (req, res) => {
  try {
    const leads = await Lead.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      count: leads.length,
      data: leads,
    });
  } catch (error) {
    console.error("Fetch leads error:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not fetch leads.",
    });
  }
});

// Add a Lead
app.post("/api/leads", async (req, res) => {
  try {
    const { name, company, email, status } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof company !== "string" ||
      !company.trim() ||
      typeof email !== "string" ||
      !email.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, company, and email are required.",
      });
    }

    const lead = await Lead.create({
      name,
      company,
      email,
      status: status || "New",
    });

    res.status(201).json({
      success: true,
      message: "Lead created successfully.",
      data: lead,
    });
  } catch (error) {
    console.error("Create lead error:", error.message);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Invalid lead data or status.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Could not create lead.",
    });
  }
});

// Update a Lead
app.put("/api/leads/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead ID.",
      });
    }

    const allowedFields = ["name", "company", "email", "status"];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      updates,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found.",
      });
    }

    res.json({
      success: true,
      message: "Lead updated successfully.",
      data: lead,
    });
  } catch (error) {
    console.error("Update lead error:", error.message);

    res.status(400).json({
      success: false,
      message: "Could not update lead.",
    });
  }
});

// Delete a Lead
app.delete("/api/leads/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead ID.",
      });
    }

    const lead = await Lead.findByIdAndDelete(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found.",
      });
    }

    res.json({
      success: true,
      message: "Lead deleted successfully.",
    });
  } catch (error) {
    console.error("Delete lead error:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not delete lead.",
    });
  }
});

// Start Server After Database Connection
async function startServer() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI missing. Check your backend/.env file.");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB connected successfully!");

    app.listen(PORT, () => {
      console.log(
        `Enterprise CRM API running at http://localhost:${PORT}`
      );
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

startServer();

