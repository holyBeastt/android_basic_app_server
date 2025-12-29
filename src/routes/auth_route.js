// routes/auth_routes.js
import express from "express";
import auth_controller from "../controllers/auth_controller.js";

const router = express.Router();

router.post("/user/login", auth_controller.login);
router.post("/user/signup", auth_controller.register);
router.post("/user/google-login", auth_controller.googleLogin);

// Route này công khai để App có thể đổi token mới
router.post("/user/refresh-token", auth_controller.requestRefreshToken);

// Route xác thực mã mở khóa
router.post("/user/verify-unlock-code", auth_controller.verifyUnlockCode);
router.post("/user/resend-unlock-code", auth_controller.resendUnlockCode);

// Route quên mật khẩu
router.post("/user/forgot-password", auth_controller.forgotPassword);
router.post("/user/verify-reset-code", auth_controller.verifyResetCode);
router.post("/user/reset-password", auth_controller.resetPassword);

export default router;
