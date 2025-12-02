const pool = require("./db").pool;
const { Resend } = require("resend");

require("dotenv").config();

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);


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

        // Send OTP via email using Resend
        resend.emails.send({
            from: "ERS Recovery <onboarding@resend.dev>",
            to: email,
            replyTo: "group1.ers.recovery@gmail.com",
            subject: "Your OTP Code",
            html: `<p>Your OTP code is <strong>${otp}</strong>. It is valid for 5 minutes.</p>`,
        }).then(() => {
            console.log("OTP email sent successfully to", email);
        }).catch((err) => {
            console.error("Error sending email:", err.message);
        });

        res.status(200).json({ message: "OTP sent successfully"});

    } catch (error) {
        console.error("Error storing OTP in database:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}


async function verifyOTP(req, res) {
    const { email, otp } = req.body;

    try {
        const result = await pool.query(
            "SELECT * FROM otps WHERE email = $1 AND code = $2",
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