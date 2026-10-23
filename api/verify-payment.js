const crypto = require('crypto');
const { keySecret, isConfigured: isRazorpayConfigured } = require('./_razorpay');
const { supabase, mockStore, isConfigured: isSupabaseConfigured } = require('./_supabase');

function generateVoucherCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'GIFT-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

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
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount,
      phone,
      userId,
      isMock,
    } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id) {
      res.status(400).json({ error: 'Missing payment identifiers' });
      return;
    }

    const cleanPhone = (phone || '').trim();
    if (!cleanPhone) {
      res.status(400).json({ error: 'Customer phone number is required' });
      return;
    }

    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount < 100) {
      res.status(400).json({ error: 'Amount must be at least ₹100 to earn a stamp' });
      return;
    }

    // 1. Verify Razorpay cryptographic signature if live mode
    if (isRazorpayConfigured && !isMock) {
      const generatedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        res.status(400).json({ error: 'Payment signature verification failed. Invalid transaction.' });
        return;
      }
    }

    let currentStampCount = 0;
    let totalStamps = 0;
    let rewardUnlocked = false;
    let newReward = null;

    // 2. Database persistence
    if (isSupabaseConfigured && supabase) {
      // Find or create profile by phone or userId
      let profile = null;
      if (userId) {
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        profile = data;
      }
      if (!profile && cleanPhone) {
        const { data } = await supabase.from('profiles').select('*').eq('phone', cleanPhone).maybeSingle();
        profile = data;
      }

      if (!profile && userId) {
        const { data, error } = await supabase.from('profiles').insert([
          { id: userId, phone: cleanPhone, stamp_count: 0, total_stamps_earned: 0 }
        ]).select().single();
        if (!error) profile = data;
      }

      currentStampCount = profile ? Number(profile.stamp_count || 0) : 0;
      totalStamps = profile ? Number(profile.total_stamps_earned || 0) : 0;

      // Rule: Every transaction >= 100 awards 1 stamp
      // If user already has 6 stamps, they must redeem their reward first to start a new card
      if (currentStampCount < 6) {
        currentStampCount += 1;
        totalStamps += 1;
      }

      // Check if 6th stamp just reached
      if (currentStampCount === 6) {
        rewardUnlocked = true;
        const voucherCode = generateVoucherCode();
        const rewardTitle = process.env.REWARD_NAME || 'Free Deluxe Food Item';

        // Insert reward record
        const { data: rewardData } = await supabase.from('rewards').insert([
          {
            user_id: profile ? profile.id : userId,
            phone: cleanPhone,
            reward_title: rewardTitle,
            voucher_code: voucherCode,
            status: 'unlocked',
          }
        ]).select().single();

        newReward = rewardData || {
          reward_title: rewardTitle,
          voucher_code: voucherCode,
          status: 'unlocked',
        };
      }

      // Update profile
      if (profile) {
        await supabase
          .from('profiles')
          .update({
            stamp_count: currentStampCount,
            total_stamps_earned: totalStamps,
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.id);
      }

      // Record payment
      await supabase.from('payments').insert([
        {
          user_id: profile ? profile.id : (userId || null),
          phone: cleanPhone,
          razorpay_order_id,
          razorpay_payment_id,
          amount: parsedAmount,
          stamps_awarded: 1,
          status: 'paid',
        }
      ]);
    } else {
      // In-Memory Dev Store
      let user = mockStore.users.get(cleanPhone) || {
        id: userId || `user_${Date.now()}`,
        phone: cleanPhone,
        stamp_count: 0,
        total_stamps_earned: 0,
        rewards: [],
      };

      currentStampCount = Number(user.stamp_count || 0);
      totalStamps = Number(user.total_stamps_earned || 0);

      if (currentStampCount < 6) {
        currentStampCount += 1;
        totalStamps += 1;
      }

      if (currentStampCount === 6) {
        rewardUnlocked = true;
        newReward = {
          id: `rew_${Date.now()}`,
          phone: cleanPhone,
          reward_title: process.env.REWARD_NAME || 'Free Deluxe Food Item',
          voucher_code: generateVoucherCode(),
          status: 'unlocked',
          created_at: new Date().toISOString(),
        };
        user.rewards.unshift(newReward);
      }

      user.stamp_count = currentStampCount;
      user.total_stamps_earned = totalStamps;
      mockStore.users.set(cleanPhone, user);

      mockStore.payments.push({
        phone: cleanPhone,
        razorpay_order_id,
        razorpay_payment_id,
        amount: parsedAmount,
        stamps_awarded: 1,
        created_at: new Date().toISOString(),
      });
    }

    res.status(200).json({
      success: true,
      stampCount: currentStampCount,
      totalStampsEarned: totalStamps,
      rewardUnlocked,
      reward: newReward,
      message: rewardUnlocked
        ? 'Congratulations! You completed your 6-stamp card and unlocked a Free Food Item!'
        : `Payment verified! Stamp #${currentStampCount} earned!`,
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      error: 'Failed to verify payment',
      details: error.message,
    });
  }
};
