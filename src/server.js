import express from "express";
import cors from "cors";
import "dotenv/config";

const port = process.env.PORT || 3000;
const hostname = process.env.HOST_NAME || "localhost";

const app = express();

// Configure CORS
app.use(cors({
  origin: ['http://localhost:8888'], // Add your frontend URLs
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());

// Lấy Routes
import auth_routes from "./routes/auth_route.js";

import courses_routes from "./routes/courses_route.js";

import user_routes from "./routes/users_route.js";

import personal_courses_routes from "./routes/personal_courses_route.js";

import quiz_routes from "./routes/quiz_route.js";

import instructorNestedRoutes from "./routes/instructor/instructorRoutes.js";

// Sử dụng Routes
app.use("/api/auth", auth_routes);
app.use("/api/courses", courses_routes);
app.use("/api/users", user_routes);
app.use("/api/instructor", instructorNestedRoutes);
app.use("/", personal_courses_routes);
app.use("/", quiz_routes);
app.listen(port, hostname, () => {
  console.log(`Server running on http://${hostname}:${port}`);
});
