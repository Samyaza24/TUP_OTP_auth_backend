const express = require("express");
const cors = require('cors')
const {sendOTP, verifyOTP} = require("./otpController.js");
require("dotenv").config();

const app = express();

app.use(cors())
app.use(express.json());

app.get("/", (req, res) => {
    res.send("OTP Service is running");
});

// Routes
app.post("/send-otp", (req, res, next) => {
    console.log("POST /send-otp - Request received", req.body);
    sendOTP(req, res, next);
});

app.post("/verify-otp", (req, res, next) => {
    console.log("POST /verify-otp - Request received", req.body);
    verifyOTP(req, res, next);
});

// Test route
app.get("/test", (req, res) => {
    res.json({ message: "Test route works!", timestamp: new Date() });
}); 

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 

