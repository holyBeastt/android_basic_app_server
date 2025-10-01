import { createPayment } from "./momo.js";
import supabase from "../config/supabase.js";// Đường dẫn tới kết nối Supabase của bạn

const paymentMomoController = {
  // Tạo đơn thanh toán, đồng thời lưu bản ghi vào Supabase
  createMomoPayment: async (req, res) => {
    const {
      amount,
      orderId,
      orderInfo,
      returnUrl,
      notifyUrl,
      user_id,
      course_id,
    } = req.body;
    console.log("Create MoMo payment===========================:", req.body);
    try {
      const result = await createPayment({
        amount,
        orderId,
        user_id,
        course_id,
        orderInfo,
        returnUrl,
        notifyUrl,
      });

      // Thêm bản ghi vào bảng payments trên Supabase
      const { error } = await supabase.from("payments").insert([
        {
          order_id: orderId,
          user_id,
          course_id,
          amount,
          status: "PENDING",
          created_at: new Date().toISOString(),
          payment_method: "momo",
          // Thêm trường khác nếu cần
        },
      ]);

      if (error)
        return res.status(500).json({ success: false, error: error.message });

      res.json({
        success: true,
        qrData: result.qrCodeUrl,
        payUrl: result.payUrl,
        message: result.message,
        orderId,
        data: result,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  // Webhook: MoMo gọi về khi thanh toán thành công
  momoWebhook: async (req, res) => {
    try {
      console.log("MoMo webhook:", req.body);
      const { orderId, resultCode, message } = req.body;
      if (resultCode === 0 && orderId) {
        // Update trạng thái đơn hàng trên Supabase
        const { data, error } = await supabase
          .from("payments")
          .update({
            status: "PAID",
            paid_at: new Date().toISOString(),
            momo_message: message,
          })
          .eq("order_id", orderId)
          .select();

        console.log("Update result:", { data, error });

        if (!data || data.length === 0) {
          console.error("Không tìm thấy bản ghi để update!");
        }
      }
      console.log(
        "Updated payment status to PAID for orderId=============:",
        orderId
      );
      res.json({ received: true });
    } catch (err) {
      res.status(500).json({ received: false, error: err.message });
    }
  },
  checkMomoStatus: async (req, res) => {
    const { orderId } = req.query;
    console.log("Check MoMo status for orderId:", orderId);
    if (!orderId)
      return res.status(400).json({ success: false, message: "Thiếu orderId" });
    const { data, error } = await supabase
      .from("payments")
      .select("status")
      .eq("order_id", orderId)
      .maybeSingle();

    // ====> Viết log NGAY SAU truy vấn ở đây:
    console.log(
      "checkMomoStatus orderId:",
      orderId,
      "data:",
      data,
      "error:",
      error
    );

    if (error)
      return res.status(500).json({ success: false, error: error.message });
    if (data && data.status === "PAID") {
      console.log("Payment status for orderId========", orderId, "is PAID");
      return res.json({ success: true, paid: true });
    }
    return res.json({ success: true, paid: false });
  },
};

export default paymentMomoController;

