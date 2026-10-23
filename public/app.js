// ==============================================================================
// DIGITAL STAMP LOYALTY CARD - FRONTEND CLIENT
// ==============================================================================

const TOTAL_STAMPS = 6;
let appConfig = null;
let supabase = null;
let currentUser = null;
let currentPhone = null;
let currentStampCount = 0;
let currentReward = null;
let countdownTimer = null;

// DOM Elements
const authView = document.getElementById('auth-view');
const stampView = document.getElementById('stamp-view');
const userNavActions = document.getElementById('user-nav-actions');
const navPhoneText = document.getElementById('nav-phone-text');
const logoutBtn = document.getElementById('logout-btn');

// Auth Form Elements
const stepPhone = document.getElementById('step-phone');
const stepOtp = document.getElementById('step-otp');
const phoneInput = document.getElementById('phone-input');
const sendOtpBtn = document.getElementById('send-otp-btn');
const sendOtpSpinner = document.getElementById('send-otp-spinner');
const fillTestPhoneBtn = document.getElementById('fill-test-phone-btn');
const otpInput = document.getElementById('otp-input');
const otpSentTo = document.getElementById('otp-sent-to');
const editPhoneBtn = document.getElementById('edit-phone-btn');
const verifyOtpBtn = document.getElementById('verify-otp-btn');
const verifyOtpSpinner = document.getElementById('verify-otp-spinner');
const countdownText = document.getElementById('countdown-text');
const countdownSec = document.getElementById('countdown-sec');
const resendOtpBtn = document.getElementById('resend-otp-btn');

// Stamp & Payment Elements
const ticketCustomerPhone = document.getElementById('ticket-customer-phone');
const stampsContainer = document.getElementById('stamps-container');
const stampProgressBar = document.getElementById('stamp-progress-bar');
const statusText = document.getElementById('status-text');
const rewardBanner = document.getElementById('reward-banner');
const rewardItemTitle = document.getElementById('reward-item-title');
const rewardVoucherCode = document.getElementById('reward-voucher-code');
const staffRedeemTrigger = document.getElementById('staff-redeem-trigger');
const billAmountInput = document.getElementById('bill-amount-input');
const payNowBtn = document.getElementById('pay-now-btn');
const payBtnLabel = document.getElementById('pay-btn-label');
const paySpinner = document.getElementById('pay-spinner');
const amountChips = document.querySelectorAll('.chip');
const refreshStampsBtn = document.getElementById('refresh-stamps-btn');

// Modals
const celebrationModal = document.getElementById('celebration-modal');
const modalRewardName = document.getElementById('modal-reward-name');
const modalVoucherCode = document.getElementById('modal-voucher-code');
const closeCelebrationBtn = document.getElementById('close-celebration-btn');

const staffModal = document.getElementById('staff-modal');
const staffSummaryPhone = document.getElementById('staff-summary-phone');
const staffSummaryCode = document.getElementById('staff-summary-code');
const confirmStaffRedeemBtn = document.getElementById('confirm-staff-redeem-btn');
const staffRedeemSpinner = document.getElementById('staff-redeem-spinner');
const cancelStaffRedeemBtn = document.getElementById('cancel-staff-redeem-btn');
const closeStaffModal = document.getElementById('close-staff-modal');

const toastContainer = document.getElementById('toast-container');

// ==============================================================================
// INITIALIZATION
// ==============================================================================

async function initApp() {
  buildStampCardSlots();
  setupEventListeners();

  try {
    const res = await fetch('/api/config');
    appConfig = await res.json();

    if (appConfig.supabase && appConfig.supabase.isConfigured && window.supabase) {
      supabase = window.supabase.createClient(
        appConfig.supabase.url,
        appConfig.supabase.anonKey
      );

      // Check active Supabase Auth session
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.user) {
        currentUser = session.user;
        currentPhone = session.user.phone;
        onLoginSuccess();
        return;
      }
    }
  } catch (err) {
    console.warn('Config fetch notice:', err);
  }

  // Check Local Session fallback (for development before Supabase keys configured)
  const savedPhone = localStorage.getItem('stamp_app_phone');
  if (savedPhone) {
    currentPhone = savedPhone;
    onLoginSuccess();
  }
}

// ==============================================================================
// STAMP CARD RENDERING
// ==============================================================================

function buildStampCardSlots() {
  stampsContainer.innerHTML = '';
  for (let i = 1; i <= TOTAL_STAMPS; i++) {
    const circle = document.createElement('div');
    circle.className = `stamp stamp-slot-${i}`;
    circle.setAttribute('data-index', i - 1);

    const isLast = i === TOTAL_STAMPS;
    const label = isLast
      ? '<span class="stamp-gift">🎁</span>'
      : `<span class="stamp-number">${i}</span>`;

    // SVG animated checkmark path
    circle.innerHTML =
      label +
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path pathLength="1" d="M5 12.5 L10 17.5 L19 7"/></svg>';

    stampsContainer.appendChild(circle);
  }
}

function renderStamps(newestIndex = -1) {
  const circles = stampsContainer.children;

  for (let i = 0; i < circles.length; i++) {
    const isFilled = i < currentStampCount;
    circles[i].classList.toggle('filled', isFilled);
    circles[i].classList.toggle('just-filled', i === newestIndex);
  }

  // Progress Bar
  const percentage = Math.min(100, Math.round((currentStampCount / TOTAL_STAMPS) * 100));
  stampProgressBar.style.width = `${percentage}%`;

  const isComplete = currentStampCount >= TOTAL_STAMPS;
  const remaining = TOTAL_STAMPS - currentStampCount;

  // Status Text
  if (isComplete) {
    statusText.textContent = '🎉 All 6 stamps collected! Free food reward unlocked!';
  } else if (currentStampCount === 0) {
    statusText.textContent = 'No stamps yet. Spend ₹100 or more to get your first stamp.';
  } else {
    statusText.textContent = `${currentStampCount} of ${TOTAL_STAMPS} stamps collected • ${remaining} more for free gift.`;
  }

  // Handle Reward Banner
  if (isComplete && currentReward) {
    rewardBanner.classList.remove('hidden');
    rewardItemTitle.textContent = currentReward.reward_title || appConfig?.rewardName || 'Free Deluxe Food Item';
    rewardVoucherCode.textContent = currentReward.voucher_code || 'GIFT-FREE';
  } else {
    rewardBanner.classList.add('hidden');
  }

  // Disable / Enable Pay button if card is full
  if (isComplete) {
    payNowBtn.disabled = true;
    payBtnLabel.textContent = 'Redeem Free Gift First';
  } else {
    payNowBtn.disabled = false;
    updatePayButtonLabel();
  }
}

function updatePayButtonLabel() {
  if (currentStampCount >= TOTAL_STAMPS) return;
  const amount = billAmountInput.value || '100';
  payBtnLabel.textContent = `Pay ₹${amount} with Razorpay`;
}

// ==============================================================================
// DATA FETCHING (PROFILE & STAMPS)
// ==============================================================================

async function fetchUserProfile() {
  if (!currentPhone) return;

  try {
    const userId = currentUser ? currentUser.id : '';
    const res = await fetch(`/api/get-profile?phone=${encodeURIComponent(currentPhone)}&userId=${encodeURIComponent(userId)}`);
    const data = await res.json();

    if (data && data.stampCount !== undefined) {
      currentStampCount = Number(data.stampCount);
      // Find latest unlocked reward if any
      if (data.rewards && data.rewards.length > 0) {
        currentReward = data.rewards.find((r) => r.status === 'unlocked') || null;
      } else {
        currentReward = null;
      }
      renderStamps();
    }
  } catch (err) {
    console.error('Error fetching profile:', err);
  }
}

// ==============================================================================
// AUTHENTICATION FLOW (MOBILE NO + OTP)
// ==============================================================================

async function handleSendOtp() {
  const rawPhone = phoneInput.value.trim().replace(/\D/g, '');
  if (rawPhone.length !== 10) {
    showToast('Please enter a valid 10-digit mobile number.', 'error');
    phoneInput.focus();
    return;
  }

  const fullPhone = `+91${rawPhone}`;
  currentPhone = fullPhone;

  sendOtpBtn.disabled = true;
  sendOtpSpinner.classList.remove('hidden');

  try {
    if (supabase) {
      const { error } = await supabase.auth.signInWithOtp({
        phone: fullPhone,
      });

      if (error) {
        console.warn('Supabase signInWithOtp notice:', error.message);
        // If developer is using test phone or custom setup
        showToast(error.message, 'error');
      } else {
        showToast(`Verification code sent to ${fullPhone}!`, 'success');
      }
    } else {
      // Dev mode without live Supabase keys
      showToast(`Development Mode: OTP sent! (Use 123456)`, 'success');
    }

    // Switch to Step 2 (OTP)
    otpSentTo.textContent = `${fullPhone}`;
    stepPhone.classList.add('hidden');
    stepOtp.classList.remove('hidden');
    otpInput.value = '';
    otpInput.focus();
    startCountdown();
  } catch (err) {
    showToast(`Failed to send OTP: ${err.message}`, 'error');
  } finally {
    sendOtpBtn.disabled = false;
    sendOtpSpinner.classList.add('hidden');
  }
}

async function handleVerifyOtp() {
  const otp = otpInput.value.trim();
  if (otp.length < 4) {
    showToast('Please enter the verification code.', 'error');
    otpInput.focus();
    return;
  }

  verifyOtpBtn.disabled = true;
  verifyOtpSpinner.classList.remove('hidden');

  try {
    if (supabase) {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: currentPhone,
        token: otp,
        type: 'sms',
      });

      if (error) {
        showToast(`Verification failed: ${error.message}`, 'error');
        verifyOtpBtn.disabled = false;
        verifyOtpSpinner.classList.add('hidden');
        return;
      }

      currentUser = data.user;
      currentPhone = data.user.phone || currentPhone;
    }

    // Remember in localStorage for quick reconnect
    localStorage.setItem('stamp_app_phone', currentPhone);
    showToast('Logged in successfully!', 'success');
    onLoginSuccess();
  } catch (err) {
    showToast(`Verification error: ${err.message}`, 'error');
  } finally {
    verifyOtpBtn.disabled = false;
    verifyOtpSpinner.classList.add('hidden');
  }
}

function onLoginSuccess() {
  authView.classList.add('hidden');
  stampView.classList.remove('hidden');
  userNavActions.classList.remove('hidden');

  navPhoneText.textContent = currentPhone;
  ticketCustomerPhone.textContent = currentPhone;

  fetchUserProfile();
}

function handleLogout() {
  if (supabase) {
    supabase.auth.signOut();
  }
  localStorage.removeItem('stamp_app_phone');
  currentUser = null;
  currentPhone = null;
  currentStampCount = 0;
  currentReward = null;

  userNavActions.classList.add('hidden');
  stampView.classList.add('hidden');
  authView.classList.remove('hidden');
  stepOtp.classList.add('hidden');
  stepPhone.classList.remove('hidden');
  phoneInput.value = '';
  otpInput.value = '';
  clearInterval(countdownTimer);

  showToast('Logged out.', 'info');
}

function startCountdown() {
  clearInterval(countdownTimer);
  let sec = 30;
  countdownSec.textContent = sec;
  countdownText.classList.remove('hidden');
  resendOtpBtn.classList.add('hidden');

  countdownTimer = setInterval(() => {
    sec--;
    countdownSec.textContent = sec;
    if (sec <= 0) {
      clearInterval(countdownTimer);
      countdownText.classList.add('hidden');
      resendOtpBtn.classList.remove('hidden');
    }
  }, 1000);
}

// ==============================================================================
// RAZORPAY PAYMENT & STAMP AWARD
// ==============================================================================

async function handlePayNow() {
  const rawAmount = billAmountInput.value;
  const parsedAmount = Number(rawAmount);

  if (!parsedAmount || isNaN(parsedAmount) || parsedAmount < 100) {
    showToast('Minimum payment amount to earn a stamp is ₹100.', 'error');
    billAmountInput.focus();
    return;
  }

  payNowBtn.disabled = true;
  paySpinner.classList.remove('hidden');

  try {
    // 1. Create order on backend
    const orderRes = await fetch('/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: parsedAmount,
        phone: currentPhone,
      }),
    });

    const orderData = await orderRes.json();
    if (!orderRes.ok || !orderData.orderId) {
      throw new Error(orderData.error || 'Failed to initialize payment');
    }

    // 2. Open Razorpay Checkout or Developer Test Simulation
    if (orderData.isMock || !appConfig?.razorpay?.isConfigured) {
      // Mock / Dev Test Mode Simulation
      const confirmPay = confirm(
        `[DEVELOPER TEST MODE]\nRazorpay keys are in test setup.\n\nSimulate successful payment of ₹${parsedAmount} for ${currentPhone}?`
      );

      if (confirmPay) {
        await verifyPaymentOnServer({
          razorpay_order_id: orderData.orderId,
          razorpay_payment_id: `pay_mock_${Date.now()}`,
          razorpay_signature: 'mock_signature_approved',
          amount: parsedAmount,
          phone: currentPhone,
          userId: currentUser ? currentUser.id : null,
          isMock: true,
        });
      } else {
        showToast('Payment simulation cancelled.', 'info');
      }
    } else {
      // Official Razorpay Checkout Modal
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'Cafe Delight Loyalty Club',
        description: `Bill Payment (Min ₹100 for Stamp) - ₹${parsedAmount}`,
        order_id: orderData.orderId,
        prefill: {
          contact: currentPhone,
        },
        theme: {
          color: '#192562',
        },
        modal: {
          ondismiss: function () {
            showToast('Payment window closed.', 'info');
          },
        },
        handler: async function (response) {
          // Response contains razorpay_payment_id, razorpay_order_id, razorpay_signature
          await verifyPaymentOnServer({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            amount: parsedAmount,
            phone: currentPhone,
            userId: currentUser ? currentUser.id : null,
            isMock: false,
          });
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        showToast(`Payment failed: ${response.error.description}`, 'error');
      });
      rzp.open();
    }
  } catch (err) {
    showToast(`Payment error: ${err.message}`, 'error');
  } finally {
    payNowBtn.disabled = false;
    paySpinner.classList.add('hidden');
  }
}

async function verifyPaymentOnServer(payload) {
  payNowBtn.disabled = true;
  paySpinner.classList.remove('hidden');

  try {
    const res = await fetch('/api/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Payment verification failed');
    }

    const previousStampCount = currentStampCount;
    currentStampCount = Number(data.stampCount);

    if (data.reward) {
      currentReward = data.reward;
    }

    // Render with stamp bounce animation on the new stamp
    renderStamps(currentStampCount - 1);

    if (data.rewardUnlocked) {
      // Trigger party poppers & confetti!
      triggerPartyPoppers();
      showCelebrationModal(data.reward);
    } else {
      showToast(`Payment verified! Stamp #${currentStampCount} earned! ☕`, 'success');
    }
  } catch (err) {
    showToast(`Verification failed: ${err.message}`, 'error');
  } finally {
    payNowBtn.disabled = false;
    paySpinner.classList.add('hidden');
  }
}

// ==============================================================================
// POPPERS & CONFETTI CELEBRATION (STAMP 6)
// ==============================================================================

function triggerPartyPoppers() {
  if (typeof window.confetti === 'function') {
    // Cannon Left
    window.confetti({
      particleCount: 60,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: ['#f5b73d', '#192562', '#e04a43', '#10b981', '#ffffff'],
    });

    // Cannon Right
    window.confetti({
      particleCount: 60,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: ['#f5b73d', '#192562', '#e04a43', '#10b981', '#ffffff'],
    });

    // Big central shower
    setTimeout(() => {
      window.confetti({
        particleCount: 100,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#ffd166', '#06d6a0', '#118ab2', '#ef476f'],
      });
    }, 250);
  }
}

function showCelebrationModal(reward) {
  modalRewardName.textContent = reward?.reward_title || 'Free Deluxe Food Item';
  modalVoucherCode.textContent = reward?.voucher_code || 'GIFT-FREE';
  celebrationModal.classList.remove('hidden');
}

// ==============================================================================
// STAFF REDEMPTION
// ==============================================================================

function openStaffModal() {
  if (!currentReward) return;
  staffSummaryPhone.textContent = currentPhone;
  staffSummaryCode.textContent = currentReward.voucher_code;
  staffModal.classList.remove('hidden');
}

async function handleConfirmStaffRedeem() {
  if (!currentReward) return;

  confirmStaffRedeemBtn.disabled = true;
  staffRedeemSpinner.classList.remove('hidden');

  try {
    const res = await fetch('/api/redeem-reward', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voucherCode: currentReward.voucher_code,
        phone: currentPhone,
        userId: currentUser ? currentUser.id : null,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to redeem reward');
    }

    currentStampCount = 0;
    currentReward = null;
    renderStamps();

    staffModal.classList.add('hidden');
    showToast('Reward claimed by staff! A new stamp card has been started.', 'success');
  } catch (err) {
    showToast(`Redemption error: ${err.message}`, 'error');
  } finally {
    confirmStaffRedeemBtn.disabled = false;
    staffRedeemSpinner.classList.add('hidden');
  }
}

// ==============================================================================
// EVENT LISTENERS
// ==============================================================================

function setupEventListeners() {
  // Auth
  sendOtpBtn.addEventListener('click', handleSendOtp);
  verifyOtpBtn.addEventListener('click', handleVerifyOtp);
  logoutBtn.addEventListener('click', handleLogout);

  editPhoneBtn.addEventListener('click', () => {
    stepOtp.classList.add('hidden');
    stepPhone.classList.remove('hidden');
    clearInterval(countdownTimer);
  });

  resendOtpBtn.addEventListener('click', handleSendOtp);

  // Quick fill test button
  fillTestPhoneBtn.addEventListener('click', () => {
    phoneInput.value = '9999999999';
    handleSendOtp();
    setTimeout(() => {
      otpInput.value = '123456';
    }, 600);
  });

  // Amount preset chips
  amountChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      amountChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      const val = chip.getAttribute('data-amount');
      billAmountInput.value = val;
      updatePayButtonLabel();
    });
  });

  billAmountInput.addEventListener('input', () => {
    const entered = billAmountInput.value;
    amountChips.forEach((c) => {
      c.classList.toggle('active', c.getAttribute('data-amount') === entered);
    });
    updatePayButtonLabel();
  });

  // Payment
  payNowBtn.addEventListener('click', handlePayNow);

  // Staff and Modals
  staffRedeemTrigger.addEventListener('click', openStaffModal);
  closeStaffModal.addEventListener('click', () => staffModal.classList.add('hidden'));
  cancelStaffRedeemBtn.addEventListener('click', () => staffModal.classList.add('hidden'));
  confirmStaffRedeemBtn.addEventListener('click', handleConfirmStaffRedeem);

  closeCelebrationBtn.addEventListener('click', () => {
    celebrationModal.classList.add('hidden');
  });

  refreshStampsBtn.addEventListener('click', async () => {
    await fetchUserProfile();
    showToast('Stamp card refreshed!', 'info');
  });
}

// ==============================================================================
// TOAST HELPER
// ==============================================================================

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '⚠️';

  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Start Application
document.addEventListener('DOMContentLoaded', initApp);