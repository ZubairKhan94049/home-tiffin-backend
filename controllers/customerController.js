const userModel = require('../models/userModel');
const settingsModel = require('../models/settingsModel');
const reviewModel = require('../models/reviewModel');

const publicUser = user => Object.fromEntries(['id','name','email','phone','role','status','profile_image','created_at'].map(key => [key, user[key] ?? null]));
const failure = (res, error) => res.status(error.code === 'ER_DUP_ENTRY' ? 409 : error.status || 500).json({ success: false,
  message: error.code === 'ER_DUP_ENTRY' ? 'That phone number or email address is already in use.' : error.status ? error.message : 'We could not complete that request. Please try again.' });

async function getProfile(req, res) {
  try {
    const user = await userModel.getUserById(req.user.id);
    if (!user) return res.status(404).json({ success:false, message:'Account not found.' });
    if (user.status === 'blocked') return res.status(403).json({ success:false, message:'Your account is blocked. Please contact support.' });
    return res.json({ success:true, data:publicUser(user) });
  } catch (error) { return failure(res, error); }
}

function validateProfile(body, current) {
  const allowed = ['name','email','phone'];
  if (Object.keys(body).some(key => !allowed.includes(key))) throw Object.assign(new Error('Only your name, email and phone can be updated here.'), {status:400});
  const data = {};
  for (const key of allowed) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== 'string' && body[key] !== null) throw Object.assign(new Error(`Enter a valid ${key}.`), {status:400});
    data[key] = String(body[key] || '').trim() || null;
  }
  const next = {...current, ...data};
  if (!next.name || next.name.length > 100) throw Object.assign(new Error('Enter a name between 1 and 100 characters.'), {status:400});
  if (next.email && (next.email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email))) throw Object.assign(new Error('Enter a valid email address.'), {status:400});
  if (next.phone && (next.phone.length > 20 || !/^\+?[\d\s()-]{7,20}$/.test(next.phone))) throw Object.assign(new Error('Enter a valid phone number.'), {status:400});
  if (!next.email && !next.phone) throw Object.assign(new Error('Keep at least one phone number or email address so you can sign in.'), {status:400});
  return data;
}

async function updateProfile(req, res) {
  try {
    const current = await userModel.getUserById(req.user.id);
    if (!current) return res.status(404).json({ success:false, message:'Account not found.' });
    if (current.status === 'blocked') return res.status(403).json({ success:false, message:'Your account is blocked. Please contact support.' });
    const data = validateProfile(req.body || {}, current);
    for (const key of ['phone','email']) {
      if (!data[key]) continue;
      const existing = await userModel.findUserByPhoneOrEmail(key === 'phone' ? data[key] : null, key === 'email' ? data[key] : null);
      if (existing && Number(existing.id) !== Number(req.user.id)) return res.status(409).json({success:false,message:`That ${key} is already in use.`});
    }
    if (Object.keys(data).length) await userModel.updateUser(req.user.id, data);
    return res.json({success:true, data:publicUser(await userModel.getUserById(req.user.id)), message:'Your profile is updated.'});
  } catch (error) { return failure(res, error); }
}

async function getSettings(req, res) {
  try {
    const settings = await settingsModel.getSettings();
    if (!settings) return res.status(503).json({success:false,message:'Customer settings are unavailable.'});
    let areas = settings.service_areas;
    if (typeof areas === 'string') { try { areas = JSON.parse(areas); } catch { areas = []; } }
    const data = Object.fromEntries(['support_phone','delivery_fee','tax_pct','discount_threshold','discount_amount'].map(key => [key, settings[key] ?? null]));
    return res.json({success:true,data:{...data,service_areas:Array.isArray(areas) ? areas : []}});
  } catch (error) { return failure(res, error); }
}

async function getReviews(req, res) {
  try { return res.json({success:true,data:await reviewModel.listByCustomer(req.user.id)}); }
  catch (error) { return failure(res, error); }
}
module.exports = {getProfile,updateProfile,getSettings,getReviews,validateProfile,publicUser};
