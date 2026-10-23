-- ==============================================================================
-- SUPABASE DATABASE SCHEMA FOR DIGITAL STAMP LOYALTY CARD
-- ==============================================================================
-- Run this script in the Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. Enable UUID Extension (usually enabled by default in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create the PROFILES table (stores user loyalty stamp status)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone TEXT UNIQUE NOT NULL,
    stamp_count INTEGER NOT NULL DEFAULT 0 CHECK (stamp_count >= 0 AND stamp_count <= 6),
    total_stamps_earned INTEGER NOT NULL DEFAULT 0 CHECK (total_stamps_earned >= 0),
    total_rewards_claimed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create the PAYMENTS table (records every Razorpay transaction)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    phone TEXT NOT NULL,
    razorpay_order_id TEXT NOT NULL,
    razorpay_payment_id TEXT UNIQUE NOT NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 100),
    stamps_awarded INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'paid',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create the REWARDS table (records free gifts / food items unlocked at 6 stamps)
CREATE TABLE IF NOT EXISTS public.rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    reward_title TEXT NOT NULL DEFAULT 'Free Deluxe Food Combo',
    voucher_code TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'unlocked' CHECK (status IN ('unlocked', 'claimed')),
    claimed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Automatically create profile when a user logs in via Supabase Phone OTP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, phone, stamp_count, total_stamps_earned)
    VALUES (
        NEW.id,
        COALESCE(NEW.phone, ''),
        0,
        0
    )
    ON CONFLICT (id) DO UPDATE
    SET phone = EXCLUDED.phone,
        updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if already exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies
-- Profiles: Users can view and update their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Payments: Users can view their own payment records
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
CREATE POLICY "Users can view own payments"
    ON public.payments FOR SELECT
    USING (auth.uid() = user_id);

-- Rewards: Users can view their own rewards
DROP POLICY IF EXISTS "Users can view own rewards" ON public.rewards;
CREATE POLICY "Users can view own rewards"
    ON public.rewards FOR SELECT
    USING (auth.uid() = user_id);

-- Allow service role full access (Backend Serverless functions use service role)
-- Supabase service_role key automatically bypasses RLS in Postgres.

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_rewards_user_id ON public.rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_rewards_voucher_code ON public.rewards(voucher_code);

-- ==============================================================================
-- NOTE: TO SETUP SUPABASE TEST PHONE NUMBERS (NO SMS COST):
-- 1. Go to Supabase Dashboard -> Authentication -> Providers -> Phone
-- 2. Turn ON "Enable Phone Provider"
-- 3. Under "Test Phone Numbers", add:
--    Phone Number: +919999999999
--    OTP: 123456
-- 4. Save changes. You can now log in instantly with this number and OTP!
-- ==============================================================================
