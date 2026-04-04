const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Razorpay instance
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});


// ✅ CREATE ORDER (FIXED + SECURE)
router.post('/create-order', async (req, res) => {
    try {
        const { roomPrice, nights } = req.body;

        // ❌ Don't trust frontend blindly
        if (!roomPrice || !nights) {
            return res.status(400).json({ message: "Invalid booking details" });
        }

        // ✅ Calculate total on backend (SECURE)
        const totalAmount = roomPrice * nights;

        console.log("Total amount (₹):", totalAmount);

        const options = {
            amount: Math.round(totalAmount * 100), // 🔥 convert to paise
            currency: "INR",
            receipt: "receipt_" + Date.now()
        };

        const order = await razorpay.orders.create(options);

        res.json({
            success: true,
            order,
            key_id: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.error('Razorpay Error:', error);
        res.status(500).json({ message: 'Payment initialization failed' });
    }
});


// ✅ VERIFY PAYMENT (IMPORTANT)
router.post('/verify', async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        const sign = razorpay_order_id + "|" + razorpay_payment_id;

        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature === expectedSign) {
            console.log("Payment verified ✅");

            // ✅ You can save booking here in DB

            return res.json({
                success: true,
                message: "Payment verified successfully"
            });
        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid signature"
            });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Verification failed"
        });
    }
});

module.exports = router;