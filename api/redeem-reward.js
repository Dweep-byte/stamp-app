const { supabase, mockStore, isConfigured: isSupabaseConfigured } = require('./_supabase');

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

  const { voucherCode, phone, userId } = req.body || {};

  if (!voucherCode || (!phone && !userId)) {
    res.status(400).json({ error: 'voucherCode and phone/userId are required' });
    return;
  }

  try {
    if (isSupabaseConfigured && supabase) {
      // Find the reward
      const { data: reward, error: rError } = await supabase
        .from('rewards')
        .select('*')
        .eq('voucher_code', voucherCode)
        .eq('status', 'unlocked')
        .maybeSingle();

      if (rError || !reward) {
        res.status(404).json({ error: 'Valid unlocked reward voucher not found or already redeemed.' });
        return;
      }

      // Mark reward claimed
      await supabase
        .from('rewards')
        .update({
          status: 'claimed',
          claimed_at: new Date().toISOString(),
        })
        .eq('id', reward.id);

      // Reset user's stamp count to 0 so they can collect their next card
      if (reward.user_id) {
        await supabase
          .from('profiles')
          .update({
            stamp_count: 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', reward.user_id);
      } else if (phone) {
        await supabase
          .from('profiles')
          .update({
            stamp_count: 0,
            updated_at: new Date().toISOString(),
          })
          .eq('phone', phone);
      }

      res.status(200).json({
        success: true,
        message: 'Reward successfully claimed! A fresh stamp card is ready.',
        stampCount: 0,
      });
    } else {
      // Mock dev store
      const user = mockStore.users.get(phone);
      if (!user) {
        res.status(404).json({ error: 'User not found in development store' });
        return;
      }

      const reward = user.rewards.find(
        (r) => r.voucher_code === voucherCode && r.status === 'unlocked'
      );

      if (!reward) {
        res.status(404).json({ error: 'Valid unlocked reward not found' });
        return;
      }

      reward.status = 'claimed';
      reward.claimed_at = new Date().toISOString();
      user.stamp_count = 0; // reset to 0 for next card

      res.status(200).json({
        success: true,
        message: 'Reward claimed by staff! A new stamp card has been started.',
        stampCount: 0,
      });
    }
  } catch (error) {
    console.error('Error redeeming reward:', error);
    res.status(500).json({ error: 'Failed to redeem reward', details: error.message });
  }
};
