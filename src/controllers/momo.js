import crypto from "crypto";
import axios from "axios";


export async function createPayment({
  amount,
  orderId,
  orderInfo,
  returnUrl,
  notifyUrl,
}) {
  const endpoint = "https://test-payment.momo.vn/v2/gateway/api/create";
  // Thay bằng thông tin merchant MoMo của bạn
  const partnerCode = "MOMO";
  const accessKey = "F8BBA842ECF85";
  const secretKey = "K951B6PE1waDMi640xX08PD3vg6EkVlz";

  const rawSignature =
    `accessKey=${accessKey}&amount=${amount}&extraData=&ipnUrl=${notifyUrl}` +
    `&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}` +
    `&redirectUrl=${returnUrl}&requestId=${orderId}&requestType=captureWallet`;

  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(rawSignature)
    .digest("hex");

  const body = {
    partnerCode,
    accessKey,
    requestId: orderId,
    amount,
    orderId,
    orderInfo,
    redirectUrl: returnUrl,
    ipnUrl: notifyUrl,
    extraData: "",
    requestType: "captureWallet",
    signature,
    lang: "vi",
  };

    const { data } = await axios.post(endpoint, body);
    console.log("MoMo response:", data);
  return data; // data.payUrl là link web MoMo chứa mã QR
  
}
