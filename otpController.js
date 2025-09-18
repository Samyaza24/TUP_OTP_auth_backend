const pool = require("./db").pool;
const nodemailer = require("nodemailer");

require("dotenv").config();

// Create a transporter for sending emails
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});


async function sendOTP(req, res) {
    const { email } = req.body;

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // OTP valid for 5 minutes

    try {
        // Insert or update the OTP in the database
        await pool.query(
            "INSERT INTO otps (email, code, expires_at) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at",
            [email, otp, otpExpiry]
        );

        // Send OTP via email
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Your OTP Code",
            text: `Your OTP code is ${otp}. It is valid for 5 minutes.`,
        });

    } catch (error) {
        console.error("Error storing OTP in database:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
    res.status(200).json({ message: "OTP sent successfully" });
}


async function verifyOTP(req, res) {
    const { email, otp } = req.body;

    try {
        const result = await pool.query(
            "SELECT * FROM otps WHERE email = $1 AND code::text = $2",
            [email.trim(), String(otp).trim()]
        );
        if (result.rows.length === 0) {
            return res.status(400).json({ message: "Invalid OTP" });
        }

        const otpData = result.rows[0];
        if (new Date() > otpData.expires_at) {
            return res.status(400).json({ message: "OTP has expired" });
        }
        // OTP is valid, delete it from the database
        await pool.query("DELETE FROM otps WHERE email = $1", [otpData.email]);

        res.status(200).json({ message: "OTP verified successfully" });

    } catch (error) {
        console.error("Error verifying OTP:", error);
        res.status(500).json({ error: "verification failed" });
    }
}

module.exports = { sendOTP, verifyOTP };