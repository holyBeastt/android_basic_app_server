import express from 'express';
import user_controller from '../controllers/user_controller.js';
import avatarUpload from '../middleware/avatarUpload.middleware.js';
const router = express.Router();

// Lấy thông tin người dùng
router.get("/:userId/get-user-info", user_controller.getUserInfo);
// Cập nhật thông tin người dùng    
router.put('/update/:userId', avatarUpload, user_controller.updateUserInfo);

export default router;