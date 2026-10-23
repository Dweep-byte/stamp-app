const Razorpay = require('razorpay');
require('dotenv').config();

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

let razorpay = null;

if (keyId && keySecret && !keyId.includes('yourKeyId')) {
  razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

module.exports = {
  razorpay,
  keyId: keyId || '',
  keySecret: keySecret || '',
  isConfigured: !!razorpay,
};
