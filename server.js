const express = require("express");
const cors = require('cors')
const {sendOTP, verifyOTP} = require("./otpController.js");
require("dotenv").config();

const app = express();

app.use(cors())
app.use(express.json());

// Routes
app.post("/send-otp", sendOTP);
app.post("/verify-otp", verifyOTP); 

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 

