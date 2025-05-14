// routes/auth_routes.js
import express from "express";
import auth_controller from "../controllers/auth_controller.js";

const router = express.Router();

router.post("/user/login", auth_controller.login);
router.post("/user/signup", auth_controller.register);

export default router;
