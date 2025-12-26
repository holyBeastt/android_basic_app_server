import express from "express";
import cors from "cors";
import "dotenv/config";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import logger from "./utils/logger.js";

const port = process.env.PORT || 3000;
const hostname = process.env.HOST_NAME || "0.0.0.0";

const app = express();

// ========== 1. Trust Proxy (Render uses reverse proxy) ==========
// Required for correct IP detection and HTTPS enforcement behind proxy
app.set("trust proxy", 1);

// ========== 2. HTTPS Enforcement Middleware ==========
const enforceHttps = (req, res, next) => {
  // Skip in development
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  // Check X-Forwarded-Proto header (set by Render's proxy)
  if (req.headers["x-forwarded-proto"] !== "https") {
    // For API: reject with 403, do not redirect (mobile apps should use HTTPS directly)
    return res.status(403).json({
      error: "HTTPS required",
      message: "This API only accepts HTTPS connections"
    });
  }
  next();
};
app.use(enforceHttps);

// ========== 3. Security Headers (Helmet) ==========
app.use(
  helmet({
    hsts: {
      maxAge: 31536000, // 1 year in seconds
      includeSubDomains: true,
      preload: true
    },
    contentSecurityPolicy: false // Disable CSP for API-only backend
  })
);

// ========== 4. CORS Configuration ==========
// For mobile API: no CORS needed (mobile apps don't send Origin header)
// Rejecting all web origins for security
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman, etc.)
      if (!origin) return callback(null, true);

      // Reject all web browser origins (security for API-only backend)
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
  })
);

app.use(express.json());

// ========== 5. Rate Limiting for Auth Routes ==========
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per windowMs per IP
  message: {
    error: "Too many requests",
    message: "Quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút."
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Lấy Routes
import auth_routes from "./routes/auth_route.js";

import courses_routes from "./routes/courses_route.js";

import user_routes from "./routes/users_route.js";

import personal_courses_routes from "./routes/personal_courses_route.js";

import quiz_routes from "./routes/quiz_route.js";
import enrollment_routes from "./routes/enrollment_route.js";
import progress_routes from "./routes/progress_route.js";

import instructorNestedRoutes from "./routes/instructor/instructorRoutes.js";
import paymentMomoRoutes from "./routes/payment_route.js";

// Sử dụng Routes
app.use("/api/momo", paymentMomoRoutes);
app.use("/api/enrollments", enrollment_routes);
app.use("/api/auth", authLimiter, auth_routes); // Rate-limited auth routes
app.use("/api/courses", courses_routes);
app.use("/api/users", user_routes);
app.use("/api/instructor", instructorNestedRoutes);
app.use("/", personal_courses_routes);
app.use("/", quiz_routes);
app.use("/", progress_routes);

app.listen(port, hostname, () => {
  logger.info(`Server running on port ${port}`);
});
