import express from 'express';
import user_controller from '../controllers/user_controller.js';
import avatarUpload from '../middleware/avatarUpload.middleware.js';
import authMiddleware from '../middleware/auth.middleware.js';
const router = express.Router();

// Lấy thông tin người dùng
router.get("/:userId/get-user-info", authMiddleware.authenticateToken, user_controller.getUserInfo);

// router.get(
//     "/:userId/get-user-info",
//     authMiddleware.authenticateToken,
//     authMiddleware.authorizeSelf,
//     user_controller.getUserInfo
// );

// Cập nhật thông tin người dùng    
// router.put('/update/:userId', avatarUpload, user_controller.updateUserInfo);

router.put(
    '/update',
    authMiddleware.authenticateToken,
    avatarUpload,
    user_controller.updateUserInfo
);


// router.put(
//     "/update/:userId",
//     authMiddleware.authenticateToken,
//     authMiddleware.authorizeSelf,
//     avatarUpload,
//     user_controller.updateUserInfo
// );


export default router;