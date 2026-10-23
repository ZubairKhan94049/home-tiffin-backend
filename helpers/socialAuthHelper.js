const crypto = require("crypto");
const jwt = require("jsonwebtoken");

/**
 * Verifies a sign-in token with the provider that issued it, and returns
 * `{ provider_user_id, email, name }`.
 *
 * Verification happens here rather than trusting what the app sends, because
 * a client can claim any email it likes. Every provider is asked directly.
 *
 * Configure with:
 *   GOOGLE_CLIENT_IDS   comma-separated iOS / Android / Web client ids
 *   APPLE_CLIENT_IDS    comma-separated bundle ids (and your services id)
 *   FACEBOOK_APP_ID / FACEBOOK_APP_SECRET
 */

const list = (value) =>
  `${value ?? ""}`
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

class SocialAuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.status = status;
  }
}

const notConfigured = (provider, vars) =>
  new SocialAuthError(
    `${provider} sign-in is not configured on the server (set ${vars}).`,
    503
  );

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------

const verifyGoogle = async (idToken) => {
  const audiences = list(process.env.GOOGLE_CLIENT_IDS);
  if (!audiences.length) throw notConfigured("Google", "GOOGLE_CLIENT_IDS");

  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
  );
  if (!response.ok) throw new SocialAuthError("Google rejected that sign-in");

  const payload = await response.json();
  // The audience check is what stops a token minted for another app being
  // replayed at ours.
  if (!audiences.includes(payload.aud)) {
    throw new SocialAuthError("That Google token was issued for another app");
  }
  if (payload.email_verified === "false") {
    throw new SocialAuthError("Verify your Google email address first");
  }

  return {
    provider_user_id: payload.sub,
    email: payload.email || null,
    name: payload.name || null,
  };
};

// ---------------------------------------------------------------------------
// Apple
// ---------------------------------------------------------------------------

let appleKeysCache = { keys: [], fetchedAt: 0 };

const appleKeys = async () => {
  const anHour = 60 * 60 * 1000;
  if (appleKeysCache.keys.length && Date.now() - appleKeysCache.fetchedAt < anHour) {
    return appleKeysCache.keys;
  }
  const response = await fetch("https://appleid.apple.com/auth/keys");
  if (!response.ok) throw new SocialAuthError("Could not reach Apple");
  const { keys } = await response.json();
  appleKeysCache = { keys: keys || [], fetchedAt: Date.now() };
  return appleKeysCache.keys;
};

const verifyApple = async (identityToken, fallbackName) => {
  const audiences = list(process.env.APPLE_CLIENT_IDS);
  if (!audiences.length) throw notConfigured("Apple", "APPLE_CLIENT_IDS");

  const decoded = jwt.decode(identityToken, { complete: true });
  if (!decoded?.header?.kid) {
    throw new SocialAuthError("That Apple token could not be read");
  }

  const key = (await appleKeys()).find((k) => k.kid === decoded.header.kid);
  if (!key) throw new SocialAuthError("Apple did not recognise that token");

  // Node turns the JWK straight into a public key; no extra dependency.
  const publicKey = crypto.createPublicKey({ key, format: "jwk" });

  let payload;
  try {
    payload = jwt.verify(identityToken, publicKey, {
      algorithms: ["RS256"],
      issuer: "https://appleid.apple.com",
      audience: audiences,
    });
  } catch (error) {
    throw new SocialAuthError(`Apple rejected that sign-in: ${error.message}`);
  }

  return {
    provider_user_id: payload.sub,
    email: payload.email || null,
    // Apple only sends the name on the very first sign-in, so the app passes
    // it along and we keep whatever we are given.
    name: fallbackName || null,
  };
};

// ---------------------------------------------------------------------------
// Facebook
// ---------------------------------------------------------------------------

const verifyFacebook = async (accessToken) => {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) {
    throw notConfigured("Facebook", "FACEBOOK_APP_ID and FACEBOOK_APP_SECRET");
  }

  const debugResponse = await fetch(
    `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}` +
      `&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`
  );
  const debug = await debugResponse.json();
  const info = debug?.data;
  // Without this check any Facebook token at all would get someone in.
  if (!info?.is_valid || `${info.app_id}` !== `${appId}`) {
    throw new SocialAuthError("Facebook rejected that sign-in");
  }

  const profileResponse = await fetch(
    `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`
  );
  if (!profileResponse.ok) {
    throw new SocialAuthError("Could not read your Facebook profile");
  }
  const profile = await profileResponse.json();

  return {
    provider_user_id: profile.id,
    // Facebook accounts without a confirmed email send nothing here.
    email: profile.email || null,
    name: profile.name || null,
  };
};

const PROVIDERS = {
  google: verifyGoogle,
  apple: verifyApple,
  facebook: verifyFacebook,
};

const verifySocialToken = async (provider, token, fallbackName) => {
  const verify = PROVIDERS[provider];
  if (!verify) {
    throw new SocialAuthError(
      `Unknown sign-in provider: ${provider}. Use google, apple or facebook.`,
      400
    );
  }
  if (!token) throw new SocialAuthError("No sign-in token was sent", 400);
  return verify(token, fallbackName);
};

module.exports = {
  verifySocialToken,
  SocialAuthError,
  availableProviders: () =>
    Object.keys(PROVIDERS).filter((provider) => {
      if (provider === "google") return list(process.env.GOOGLE_CLIENT_IDS).length > 0;
      if (provider === "apple") return list(process.env.APPLE_CLIENT_IDS).length > 0;
      return Boolean(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);
    }),
};
