import express from "express";
const router = express.Router();
import paymentMomoController from "../controllers/paymentmomo_controller.js";

// Route tạo đơn thanh toán MoMo
router.post("/create-payment", paymentMomoController.createMomoPayment);

// Route nhận webhook MoMo
router.post("/webhook", paymentMomoController.momoWebhook);

router.get("/check-status", paymentMomoController.checkMomoStatus);

export default router;
