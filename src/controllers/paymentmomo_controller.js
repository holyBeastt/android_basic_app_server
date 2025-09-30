import { createPayment } from "./momo.js";

const paymentMomoController = {
  createMomoPayment: async (req, res) => {
    const { amount, orderId, orderInfo, returnUrl, notifyUrl } = req.body;
    console.log("Create MoMo payment===========================:", req.body);
    try {
      const result = await createPayment({
        amount,
        orderId,
        orderInfo,
        returnUrl,
        notifyUrl,
      });
      res.json({
        success: true,
        payUrl: result.payUrl, // Link web chứa mã QR MoMo
        message: result.message,
        data: result,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  momoWebhook: (req, res) => {
    // Xử lý thông tin thanh toán trả về từ MoMo
    // req.body: transactionId, orderId, resultCode, message, ...
    console.log("MoMo webhook:", req.body);
    // Cập nhật trạng thái đơn hàng nếu cần
    res.json({ received: true });
  }
};

export default paymentMomoController;