const express = require("express");
const cors = require("cors");
require("dotenv").config();
const authRoutes = require("./routes/authRoutes");
const dbConnect = require("./config/dbConnection");
const chatRoutes = require("./routes/chatRoutes");

const port = process.env.port;
const app = express();

// Add this middleware to parse JSON requests
app.use(express.json());

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true 
}));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/chats", chatRoutes);

// Default Route
app.get("/", (req, res) => {
  res.send("Hello, world!");
});

// Database Connection
dbConnect().then(() => {
  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
});
