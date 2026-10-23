require('dotenv').config();

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID || '';

  const isSupabaseConfigured = Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your-project-id')
  );

  const isRazorpayConfigured = Boolean(
    razorpayKeyId &&
    process.env.RAZORPAY_KEY_SECRET &&
    !razorpayKeyId.includes('yourKeyId')
  );

  res.status(200).json({
    supabase: {
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      isConfigured: isSupabaseConfigured,
    },
    razorpay: {
      keyId: razorpayKeyId,
      isConfigured: isRazorpayConfigured,
    },
    minPaymentAmount: Number(process.env.MIN_PAYMENT_AMOUNT || 100),
    stampsRequired: Number(process.env.STAMPS_REQUIRED || 6),
    rewardName: process.env.REWARD_NAME || 'Free Deluxe Food Combo',
  });
};
