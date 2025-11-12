// backend/server.js
import express from "express";
import cors from "cors";
import router from "./routes/index.js";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// ✅ Enable JSON parsing for POST requests
app.use(express.json());
const allowedOrigins = [
  "https://spark-frontend-olive.vercel.app"
];

app.use(cors({
  origin: "https://spark-frontend-olive.vercel.app",
  methods: ["GET", "POST", "OPTIONS"]
}));

// Optionally handle preflight requests globally
// app.options("*", cors());


// Middleware
app.use("/", router);

// ✅ Connect to MongoDB (Spark database)
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log("MongoDB connected ✅"))
.catch(err => console.error("MongoDB connection error:", err));


// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
