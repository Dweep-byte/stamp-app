const { razorpay, keyId, isConfigured } = require('./_razorpay');

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  try {
    const { amount, phone } = req.body || {};
    const parsedAmount = Number(amount);

    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount < 100) {
      res.status(400).json({
        error: 'Invalid amount. Minimum payment amount to earn a stamp is ₹100.',
      });
      return;
    }

    const amountInPaise = Math.round(parsedAmount * 100);

    if (isConfigured && razorpay) {
      const options = {
        amount: amountInPaise,
        currency: 'INR',
        receipt: `stamp_${Date.now().toString().slice(-8)}`,
        notes: {
          phone: phone || '',
          purpose: 'Digital Loyalty Stamp Card Payment',
        },
      };

      const order = await razorpay.orders.create(options);
      res.status(200).json({
        success: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: keyId,
        isMock: false,
      });
    } else {
      // Mock order for sandbox / local development before adding live Razorpay keys
      const mockOrderId = `order_test_${Date.now()}`;
      res.status(200).json({
        success: true,
        orderId: mockOrderId,
        amount: amountInPaise,
        currency: 'INR',
        keyId: keyId || 'rzp_test_placeholder',
        isMock: true,
        note: 'Razorpay keys not configured yet in .env - running in developer test mode',
      });
    }
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({
      error: 'Failed to create payment order',
      details: error.message,
    });
  }
};
