
require("node:dns").setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Lead Schema
const leadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    company: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    status: {
      type: String,
      enum: ["New", "Contacted", "Qualified", "Won", "Lost"],
      default: "New",
    },

    // Day 4: Follow-up & Reminders
    followUpAt: {
      type: Date,
      default: null,
    },
    followUpNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    // Day 4: Estimated deal value in INR
    dealValue: {
      type: Number,
      min: 0,
      default: 0,
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

// Get One Lead
app.get("/api/leads/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead ID.",
      });
    }

    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found.",
      });
    }

    res.json({
      success: true,
      data: lead,
    });
  } catch (error) {
    console.error("Fetch lead error:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not fetch lead.",
    });
  }
});

// Add a Lead
app.post("/api/leads", async (req, res) => {
  try {
    const {
      name,
      company,
      email,
      status,
      followUpAt,
      followUpNotes,
      dealValue,
    } = req.body;

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

    if (
      dealValue !== undefined &&
      (dealValue === "" ||
        !Number.isFinite(Number(dealValue)) ||
        Number(dealValue) < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Deal value must be a valid non-negative number.",
      });
    }

    if (
      followUpAt !== undefined &&
      followUpAt !== null &&
      followUpAt !== ""
    ) {
      const date = new Date(followUpAt);

      if (Number.isNaN(date.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid follow-up date.",
        });
      }
    }

    const lead = await Lead.create({
      name,
      company,
      email,
      status: status || "New",
      followUpAt: followUpAt || null,
      followUpNotes: followUpNotes || "",
      dealValue:
        dealValue === undefined || dealValue === ""
          ? 0
          : Number(dealValue),
    });

    res.status(201).json({
      success: true,
      message: "Lead created successfully.",
      data: lead,
    });
  } catch (error) {
    console.error("Create lead error:", error.message);

    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid lead data. Check the submitted fields.",
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

    const allowedFields = [
      "name",
      "company",
      "email",
      "status",
      "followUpAt",
      "followUpNotes",
      "dealValue",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (
      updates.name !== undefined &&
      (typeof updates.name !== "string" || !updates.name.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Name cannot be empty.",
      });
    }

    if (
      updates.company !== undefined &&
      (typeof updates.company !== "string" || !updates.company.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Company cannot be empty.",
      });
    }

    if (
      updates.email !== undefined &&
      (typeof updates.email !== "string" || !updates.email.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Email cannot be empty.",
      });
    }

    if (
      updates.dealValue !== undefined &&
      (updates.dealValue === "" ||
        !Number.isFinite(Number(updates.dealValue)) ||
        Number(updates.dealValue) < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Deal value must be a valid non-negative number.",
      });
    }

    if (updates.dealValue !== undefined) {
      updates.dealValue = Number(updates.dealValue);
    }

    if (updates.followUpAt !== undefined) {
      if (updates.followUpAt === "" || updates.followUpAt === null) {
        updates.followUpAt = null;
      } else {
        const date = new Date(updates.followUpAt);

        if (Number.isNaN(date.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Please provide a valid follow-up date.",
          });
        }

        updates.followUpAt = date;
      }
    }

    if (updates.followUpNotes !== undefined) {
      if (typeof updates.followUpNotes !== "string") {
        return res.status(400).json({
          success: false,
          message: "Follow-up notes must be text.",
        });
      }

      updates.followUpNotes = updates.followUpNotes.trim();
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

    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid lead data. Check the submitted fields.",
      });
    }

    res.status(500).json({
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
      console.log(`Enterprise CRM API running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

startServer();