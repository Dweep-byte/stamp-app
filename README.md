# ☕ Digital Stamp Loyalty Web App

A modern, mobile-first digital punch-card web application designed for cafes, restaurants, and retail shops. Customers scan a table QR code or visit the link, log in seamlessly via mobile number & OTP (no passwords), collect stamps upon paying a minimum bill amount (₹100+), and unlock a free food item / gift at 6 stamps with party popper animations.

---

## 🌟 Key Features

1. **Passwordless Phone OTP Login**:
   - Clean, mobile-friendly OTP verification powered by **Supabase Auth**.
   - Zero-cost development testing with **Supabase Test Phone Numbers** (no SMS charges!).
   - One-click test button for instant developer login.

2. **Tactile Digital Stamp Ticket (6 Slots)**:
   - Authentic paper ticket aesthetics with perforated notches, luxury ink styling, and smooth rubber-stamp press animations.
   - Circles 1 to 5: Animated stamp ticks.
   - Circle 6: Glowing golden gift box 🎁.

3. **Online Bill Payment via Razorpay**:
   - Supports preset chips (₹100, ₹200, ₹350, ₹500) and custom bill amounts.
   - Minimum payment amount validation (₹100). Every bill payment of ₹100 or more awards **1 stamp**.
   - Razorpay Checkout modal (Test Mode) with server-side HMAC SHA256 cryptographic signature verification.

4. **Party Poppers & Free Food Item Celebration (Stamp 6)**:
   - Confetti particle popper cannon explosion when the 6th stamp lands!
   - Celebration modal displaying:
     - 🍔 **Free Food Item Reward**
     - Unique voucher code (e.g., `GIFT-HBW4SC`)
     - Prominent call-to-action: **"👉 SHOW THIS SCREEN TO STAFF MEMBER TO AVAIL"**
   - Staff verification dialog to confirm reward handover and automatically reset the card to 0 stamps for the customer's next cycle.

5. **Printable Table Standee / QR Code Generator**:
   - Built-in `/qr-generator.html` tool to preview and print table standees with the app's QR code.

---

## 🚀 Quick Start (Local Development)

The local dev server is ready to run out of the box with zero setup:

```bash
# 1. Install dependencies
npm install

# 2. Start local server
npm run dev
```

Open your browser at: **[http://localhost:3000](http://localhost:3000)**

> **Pro Tip:** In developer mode, you can immediately test the full flow even before adding your keys. Click **"⚡ Fill +91 99999 99999 (OTP: 123456)"**, then test the payments and popper celebrations!

---

## 🛠️ Configuration & Credentials

Copy `.env.example` to `.env` and fill in your keys:

```env
# Supabase Configuration (Free Plan)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_public_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_secret_key

# Razorpay Configuration (Test Mode)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxx

# App Settings
PORT=3000
MIN_PAYMENT_AMOUNT=100
STAMPS_REQUIRED=6
REWARD_NAME="Free Deluxe Food Combo"
```

---

## 🗄️ Supabase Setup Guide (Free Plan)

### Step 1: Create Database Tables & Policies
1. Log in to [Supabase](https://app.supabase.com) and create a free project.
2. Go to **SQL Editor** on the left menu.
3. Click **New Query**, paste the complete contents of [`supabase-schema.sql`](file:///c:/stamp-app/supabase-schema.sql), and click **Run**.
4. This creates the `profiles`, `payments`, and `rewards` tables with Row Level Security (RLS) policies and automatic triggers.

### Step 2: Enable Test Phone Numbers (Zero SMS Cost)
1. In your Supabase project, go to **Authentication** -> **Providers** -> **Phone**.
2. Turn ON **Enable Phone Provider**.
3. Under **Test Phone Numbers**, add:
   - **Phone Number:** `+919999999999`
   - **OTP:** `123456`
4. Click **Save**.
5. Go to **Project Settings** -> **API** to copy your **Project URL**, **anon key**, and **service_role key** into your `.env` file.

---

## 💳 Razorpay Test Mode Setup

1. Sign up or log in at [Razorpay Dashboard](https://dashboard.razorpay.com).
2. Toggle the switch at top right to **Test Mode**.
3. Navigate to **Account & Settings** -> **API Keys**.
4. Click **Generate Test Key** and copy:
   - **Key Id** (`rzp_test_...`)
   - **Key Secret**
5. Paste both into your `.env` file under `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.

---

## ☁️ Deployment to Vercel

This repository is built with standard Vercel zero-config architecture (`public/` static frontend + `api/` Node.js serverless functions):

### Option A: Via Vercel Web Dashboard (Recommended)
1. Push your repository to GitHub or GitLab.
2. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Import your repository.
4. Under **Environment Variables**, add:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - `MIN_PAYMENT_AMOUNT` = `100`
   - `STAMPS_REQUIRED` = `6`
   - `REWARD_NAME` = `Free Deluxe Food Combo`
5. Click **Deploy**!

### Option B: Via Vercel CLI
```bash
npm i -g vercel
vercel
```

---

## 📁 Project Structure

```
c:\stamp-app\
├── api/
│   ├── _supabase.js          # Supabase server client & dev fallback
│   ├── _razorpay.js          # Razorpay server client & dev fallback
│   ├── config.js             # Public API configuration endpoint
│   ├── create-order.js       # Creates Razorpay order for amounts >= ₹100
│   ├── verify-payment.js     # Cryptographic signature validation & stamp awards
│   ├── get-profile.js        # Fetches user stamp count, rewards & history
│   └── redeem-reward.js      # Staff redemption endpoint
├── public/
│   ├── index.html            # Mobile-first ticket interface & OTP login
│   ├── style.css             # Tactile ticket aesthetics, poppers, & animations
│   ├── app.js                # Frontend state, Supabase auth, Razorpay checkout
│   └── qr-generator.html     # Table QR Code printable standee tool
├── dev-server.js             # Local Node.js server matching Vercel's API routing
├── supabase-schema.sql       # Production SQL schema & RLS policies
├── test-flow.js              # Automated end-to-end verification script
├── .env.example              # Environment variables template
├── vercel.json               # Vercel deployment routing configuration
└── package.json              # Project dependencies & scripts
```

---

## 🧪 Testing the Flow

Run the automated end-to-end test anytime:

```bash
node test-flow.js
```

This verifies:
1. Public configuration endpoint
2. Profile lookup
3. Order creation with ₹150 bill
4. Stamping cycles from 1 to 6
5. Voucher code generation & celebration trigger
6. Staff verification & card reset
