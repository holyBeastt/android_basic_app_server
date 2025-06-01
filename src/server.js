import express from "express";
import "dotenv/config";

const port = process.env.PORT || 3000;
const hostname = process.env.HOST_NAME || localhost;

const app = express();
app.use(express.json());


// Lấy Routes
import auth_routes from "./routes/auth_route.js";

import courses_routes from "./routes/courses_route.js";

import user_routes from "./routes/users_route.js";
// Sử dụng Routes
app.use("/api/auth", auth_routes);
app.use("/api/courses", courses_routes);
app.use("/api/users", user_routes);
app.listen(port, hostname, () => {
  console.log(`Server running on http://${hostname}:${port}`);
});
