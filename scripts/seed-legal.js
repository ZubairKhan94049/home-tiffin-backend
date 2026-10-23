// Seeds starter text for the three legal documents.
//
// These are drafts that set out the right structure for a home-cooked food
// marketplace — they are NOT reviewed legal advice. Replace the wording with
// your lawyer's before launch; the admin can edit all three from Settings.
require("dotenv").config();
const pool = require("../config/db");

const PRIVACY_POLICY = `# Privacy Policy

This policy explains what we collect when you use Home Tiffin, why we collect it, and what you can ask us to do with it.

# What we collect

- Your name, phone number and email address, so we can identify your account and reach you about orders.
- Your kitchen's address, so riders can collect orders and customers can see whether you deliver to them.
- Your CNIC and bank details, which we are required to hold to verify you and to pay you.
- Order history, ratings and messages sent through the app.
- Device and app information, such as crash reports, used to keep the app working.

# Why we collect it

- To run your kitchen on the platform: taking orders, assigning riders and paying you each week.
- To verify who you are before money is sent to a bank account.
- To support you when something goes wrong with an order.
- To meet our legal and tax obligations.

We do not sell your personal information.

# Who sees it

- Customers see your kitchen name, your menu, your ratings and the area you cook in. They do not see your CNIC, your bank details or your home address.
- Riders see the pickup address and your contact number for the order they are collecting.
- Our staff see what they need to support you and to verify your account.
- Banks and payment partners receive what is needed to send your payout.
- Authorities receive information where the law requires it.

# How long we keep it

We keep your account information while your kitchen is active and for as long afterwards as tax and accounting rules require. Order records are kept for the same period.

# Your choices

- You can see and correct your details in the app under Profile.
- You can ask us to delete your account. Records we are legally required to keep will remain.
- You can turn off notifications on your device at any time.

# Keeping it safe

Access to bank details is limited to staff who need it, and changes to a payout account must be approved by us rather than made in the app. No system is perfect; tell us immediately if you think your account has been used by someone else.

# Contact

Questions about this policy can go to our support number in the app.`;

const TERMS = `# Terms and Conditions

These terms apply to everyone using Home Tiffin. By creating an account you agree to them.

# Your account

- You must be old enough to enter a contract and give accurate information about yourself.
- You are responsible for what happens under your account. Keep your password to yourself.
- We may suspend an account we believe is being used fraudulently or unsafely.

# Orders

- Prices shown in the app include any tax the cook has told us about.
- Orders are paid in cash to the rider on delivery unless we say otherwise.
- A cook may decline an order they cannot fulfil. A customer may cancel before the kitchen starts cooking.

# Food safety

Cooks are responsible for preparing food safely and for describing it accurately, including anything a customer might be allergic to. We do not cook the food and cannot check every kitchen every day.

# Delivery

Delivery times are estimates. Traffic, weather and kitchen load all affect them.

# Our role

Home Tiffin connects customers with home cooks and arranges delivery. The contract for the food itself is between the customer and the cook.

# Money

- We take a commission on each delivered order; the rate is shown in your agreement.
- Cooks are paid weekly by bank transfer to the account we have verified.
- Riders hand collected cash to us on the schedule we have agreed with them.

# Ending it

You can stop using the platform at any time. We can end your access if these terms are broken, and we will tell you why unless the law stops us.

# Changes

We may update these terms. We will tell you in the app when we do, and the date below will change.

# Disputes

These terms are governed by the laws of Pakistan.`;

const PARTNER_CONTRACT = `# Partner Agreement

This agreement is between Home Tiffin and you, the cook, for selling home-cooked food through the platform.

# What you agree to do

- Cook and pack orders you have accepted, within the prep time shown on each item.
- Keep your menu accurate: what is in each dish, what it costs, and how much it serves.
- Tell customers about ingredients that commonly cause allergies.
- Keep your kitchen clean and your food handling safe.
- Keep your operating hours and daily capacity up to date, and close your kitchen rather than let orders go unanswered.
- Give us accurate CNIC and bank details, and tell us when they change.

# What we agree to do

- List your kitchen and menu to customers in your area.
- Pass orders to you and arrange a rider to collect them.
- Collect payment from customers and pay you weekly.
- Give you the figures behind every payout.

# Commission and payment

- We take a commission on the value of each delivered order. The rate is shown in the app and we will tell you before it changes.
- Payouts are made weekly by bank transfer to the account you have verified with us. Cancelled orders are not paid.
- Payout accounts are changed by us, not in the app, and only after we have checked a cheque book or statement for the new account.

# Independence

You are not our employee. You decide when to cook, what to cook and how much to take. You are responsible for your own tax.

# Quality

Repeated late orders, rejected orders or complaints about food may lead us to pause your kitchen while we talk to you about it.

# Ending the agreement

Either of us can end this agreement with seven days' notice. We can suspend a kitchen immediately where there is a risk to customers. Orders already accepted must still be fulfilled, and we will pay you what you are owed.

# Changes

We will tell you in the app before changing this agreement, and you can end it if you do not accept the change.`;

const main = async () => {
  const [[row]] = await pool.query(
    "SELECT privacy_policy, terms_conditions, partner_contract FROM tblsettings WHERE id = 1"
  );
  const force = process.argv.includes("--force");
  if (!force && (row?.privacy_policy || row?.terms_conditions || row?.partner_contract)) {
    console.log("Legal documents already exist — pass --force to overwrite.");
    await pool.end();
    return;
  }

  await pool.query(
    `UPDATE tblsettings
        SET privacy_policy = ?, terms_conditions = ?, partner_contract = ?,
            legal_updated_at = NOW()
      WHERE id = 1`,
    [PRIVACY_POLICY, TERMS, PARTNER_CONTRACT]
  );
  console.log("Seeded privacy policy, terms and partner agreement.");
  await pool.end();
};

main().catch((err) => {
  console.error("Failed to seed legal documents:", err.message);
  process.exit(1);
});
