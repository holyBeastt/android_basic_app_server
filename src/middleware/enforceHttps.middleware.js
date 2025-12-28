/**
 * Middleware Bắt Buộc HTTPS
 * 
 * Đảm bảo tất cả request API phải dùng HTTPS trong môi trường production.
 * Trả về lỗi 403 nếu request không qua HTTPS.
 */

const enforceHttps = (req, res, next) => {
    // Bỏ qua kiểm tra trong môi trường development
    if (process.env.NODE_ENV !== "production") {
        return next();
    }

    // Kiểm tra header X-Forwarded-Proto (được set bởi reverse proxy của Render)
    if (req.headers["x-forwarded-proto"] !== "https") {
        // Với API: trả về lỗi 403, không redirect (mobile app phải dùng HTTPS trực tiếp)
        return res.status(403).json({
            error: "HTTPS required",
            message: "API này chỉ chấp nhận kết nối HTTPS"
        });
    }
    next();
};

export default enforceHttps;
