import express from 'express';
import user_controller from '../controllers/user_controller.js';
const router = express.Router();

// Lấy thông tin người dùng
router.get('/infor/:userId', user_controller.getUserInfo);
// Cập nhật thông tin người dùng    
router.put('/update/:userId', user_controller.updateUserInfo);

export default router;