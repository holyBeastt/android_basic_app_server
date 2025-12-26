// routes/auth_routes.js
import express from "express";
import auth_controller from "../controllers/auth_controller.js";

const router = express.Router();

router.post("/user/login", auth_controller.login);
router.post("/user/signup", auth_controller.register);
router.post("/user/google-login", auth_controller.googleLogin);

// Route này công khai để App có thể đổi token mới
router.post("/user/refresh-token", auth_controller.requestRefreshToken);

export default router;
