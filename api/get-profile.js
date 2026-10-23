const { supabase, mockStore, isConfigured: isSupabaseConfigured } = require('./_supabase');

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const phone = (req.query.phone || (req.body && req.body.phone) || '').trim();
  const userId = (req.query.userId || (req.body && req.body.userId) || '').trim();

  if (!phone && !userId) {
    res.status(400).json({ error: 'Phone or userId is required' });
    return;
  }

  try {
    if (isSupabaseConfigured && supabase) {
      let profileQuery = supabase.from('profiles').select('*');
      if (userId) {
        profileQuery = profileQuery.eq('id', userId);
      } else {
        profileQuery = profileQuery.eq('phone', phone);
      }
      const { data: profile } = await profileQuery.maybeSingle();

      const resolvedUserId = profile ? profile.id : userId;

      // Fetch user's rewards
      let rewards = [];
      if (resolvedUserId || phone) {
        let rewardQuery = supabase.from('rewards').select('*').order('created_at', { ascending: false });
        if (resolvedUserId) {
          rewardQuery = rewardQuery.eq('user_id', resolvedUserId);
        } else {
          rewardQuery = rewardQuery.eq('phone', phone);
        }
        const { data: rewardData } = await rewardQuery;
        rewards = rewardData || [];
      }

      // Fetch user's payments
      let payments = [];
      if (resolvedUserId || phone) {
        let payQuery = supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(10);
        if (resolvedUserId) {
          payQuery = payQuery.eq('user_id', resolvedUserId);
        } else {
          payQuery = payQuery.eq('phone', phone);
        }
        const { data: payData } = await payQuery;
        payments = payData || [];
      }

      res.status(200).json({
        phone: profile ? profile.phone : phone,
        stampCount: profile ? Number(profile.stamp_count || 0) : 0,
        totalStampsEarned: profile ? Number(profile.total_stamps_earned || 0) : 0,
        rewards,
        recentPayments: payments,
      });
    } else {
      // Mock dev store
      const user = mockStore.users.get(phone) || {
        phone,
        stamp_count: 0,
        total_stamps_earned: 0,
        rewards: [],
      };

      const userPayments = mockStore.payments.filter((p) => p.phone === phone);

      res.status(200).json({
        phone: user.phone,
        stampCount: user.stamp_count,
        totalStampsEarned: user.total_stamps_earned,
        rewards: user.rewards,
        recentPayments: userPayments,
      });
    }
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile', details: error.message });
  }
};
