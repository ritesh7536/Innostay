const router = require('express').Router();
const nodemailer = require('nodemailer');

// Store OTPs in memory for this demo (production would use Redis/DB)
const otpStore = new Map();

// Configure Nodemailer
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Helper to send email
const sendEmailOTP = async (email, otp) => {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('----------------------------------------');
        console.log(`[OTP SYSTEM] Email configuration missing.`);
        console.log(`[OTP SYSTEM] OTP for ${email}: ${otp}`);
        console.log('----------------------------------------');
        return true; // Simulate success
    }

    try {
        await transporter.sendMail({
            from: process.env.MAIL_FROM || 'InnoStay <no-reply@innostay.local>',
            to: email,
            subject: 'Your Verification Code - InnoStay',
            text: `Your verification code is: ${otp}. It expires in 5 minutes.`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #4361ee;">Verify Your Email</h2>
                    <p>Thank you for choosing InnoStay. Please use the following One-Time Password (OTP) to verify your email address:</p>
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; border: 1px solid #e1e5ee;">
                        ${otp}
                    </div>
                    <p>This code will expire in 5 minutes.</p>
                    <p style="color: #6c757d; font-size: 12px; margin-top: 30px;">If you didn't request this code, please ignore this email.</p>
                </div>
            `
        });
        return true;
    } catch (error) {
        console.error('Email sending failed:', error);
        if (process.env.EMAIL_DEV_MODE === 'true' || process.env.NODE_ENV === 'development') {
            console.log('----------------------------------------');
            console.log(`[OTP SYSTEM] DEV MODE FALLBACK - Email send failed. Using console OTP.`);
            console.log(`[OTP SYSTEM] OTP for ${email}: ${otp}`);
            console.log('----------------------------------------');
            return true; // Treat as success in dev
        }
        return false;
    }
};

router.post('/generate-otp', (req, res) => {
    const { aadhaarNumber } = req.body;
    
    if (!aadhaarNumber || aadhaarNumber.length !== 12) {
        return res.status(400).json({ message: 'Invalid Aadhaar number' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP with expiration (5 minutes)
    otpStore.set(aadhaarNumber, {
        otp,
        expires: Date.now() + 5 * 60 * 1000
    });

    // Log to console as requested
    console.log('----------------------------------------');
    console.log(`[OTP SYSTEM] Generated OTP for Aadhaar ${aadhaarNumber}: ${otp}`);
    console.log('----------------------------------------');

    res.json({ message: 'OTP sent successfully', success: true });
});

router.post('/generate-email-otp', async (req, res) => {
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
        return res.status(400).json({ message: 'Invalid email address' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP with expiration (5 minutes)
    otpStore.set(email, {
        otp,
        expires: Date.now() + 5 * 60 * 1000
    });

    const sent = await sendEmailOTP(email, otp);

    if (sent) {
        res.json({ message: 'OTP sent to your email', success: true });
    } else {
        res.status(500).json({ message: 'Failed to send OTP email' });
    }
});

router.post('/check-otp', (req, res) => {
    const { aadhaarNumber, otp } = req.body;
    
    const storedData = otpStore.get(aadhaarNumber);

    if (!storedData) {
        return res.status(400).json({ message: 'No OTP generated for this Aadhaar number' });
    }

    if (Date.now() > storedData.expires) {
        otpStore.delete(aadhaarNumber);
        return res.status(400).json({ message: 'OTP expired' });
    }

    if (storedData.otp === otp) {
        otpStore.delete(aadhaarNumber); // Clear after successful use
        return res.json({ message: 'Verification successful', success: true });
    } else {
        return res.status(400).json({ message: 'Invalid OTP' });
    }
});

router.post('/verify-email-otp', (req, res) => {
    const { email, otp } = req.body;
    
    const storedData = otpStore.get(email);

    if (!storedData) {
        return res.status(400).json({ message: 'No OTP generated for this email' });
    }

    if (Date.now() > storedData.expires) {
        otpStore.delete(email);
        return res.status(400).json({ message: 'OTP expired' });
    }

    if (storedData.otp === otp) {
        otpStore.delete(email); // Clear after successful use
        return res.json({ message: 'Email verified successfully', success: true });
    } else {
        return res.status(400).json({ message: 'Invalid OTP' });
    }
});

module.exports = router;
