import crypto from "node:crypto";

function parseScryptHash(value) {
  const [scheme, n, r, p, salt, hash] = String(value).split("$");
  if (scheme !== "scrypt" || !n || !r || !p || !salt || !hash) {
    throw new Error("APP_AUTH_PASSWORD_HASH must use scrypt$N$r$p$salt$hash format");
  }
  return {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    salt,
    hash,
  };
}

function timingSafeEqualStrings(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function verifyPassword(password, encodedHash, parsedHash = parseScryptHash(encodedHash)) {
  const { N, r, p, salt, hash } = parsedHash;
  if (![N, r, p].every(Number.isFinite)) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = crypto.scryptSync(String(password), salt, expected.length, { N, r, p });
  return crypto.timingSafeEqual(actual, expected);
}

export function createSessionAuth({
  appAuthUser,
  appAuthPasswordHash,
  cookieName = "nas_linker_session",
  sessionTtlMs = 12 * 60 * 60 * 1000,
  sessionIdleMs = 2 * 60 * 60 * 1000,
} = {}) {
  if (Boolean(appAuthUser) !== Boolean(appAuthPasswordHash)) {
    throw new Error("APP_AUTH_USER and APP_AUTH_PASSWORD_HASH must be set together");
  }

  const parsedHash =
    appAuthUser && appAuthPasswordHash
      ? parseScryptHash(appAuthPasswordHash)
      : null;
  const sessions = new Map();

  function sessionConfigured() {
    return Boolean(appAuthUser && appAuthPasswordHash);
  }

  function setNoStore(res) {
    res.set("Cache-Control", "no-store");
  }

  function isSecureRequest(req) {
    const proto = (req.get("x-forwarded-proto") || "").split(",")[0].trim().toLowerCase();
    return req.secure || proto === "https";
  }

  function serializeCookie(name, value, {
    path = "/",
    httpOnly = true,
    sameSite = "Strict",
    secure = false,
    maxAge = null,
    expires = null,
  } = {}) {
    const parts = [`${name}=${value}`];
    if (path) parts.push(`Path=${path}`);
    if (httpOnly) parts.push("HttpOnly");
    if (sameSite) parts.push(`SameSite=${sameSite}`);
    if (secure) parts.push("Secure");
    if (maxAge != null) parts.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
    if (expires) parts.push(`Expires=${expires.toUTCString()}`);
    return parts.join("; ");
  }

  function setSessionCookie(req, res, sessionId) {
    res.append("Set-Cookie", serializeCookie(cookieName, encodeURIComponent(sessionId), {
      secure: isSecureRequest(req),
      maxAge: Math.floor(sessionTtlMs / 1000),
    }));
  }

  function clearSessionCookie(req, res) {
    res.append("Set-Cookie", serializeCookie(cookieName, "", {
      secure: isSecureRequest(req),
      maxAge: 0,
      expires: new Date(0),
    }));
  }

  function parseCookies(req) {
    const raw = req.get("cookie");
    if (!raw) return {};
    const cookies = {};
    for (const entry of raw.split(";")) {
      const idx = entry.indexOf("=");
      if (idx < 0) continue;
      const key = entry.slice(0, idx).trim();
      const value = entry.slice(idx + 1).trim();
      cookies[key] = value;
    }
    return cookies;
  }

  function createSession() {
    const id = crypto.randomBytes(32).toString("hex");
    const now = Date.now();
    const session = {
      id,
      createdAt: now,
      lastSeenAt: now,
    };
    sessions.set(id, session);
    return session;
  }

  function isExpired(session, now = Date.now()) {
    if (!session) return true;
    if (now - session.createdAt > sessionTtlMs) return true;
    if (now - session.lastSeenAt > sessionIdleMs) return true;
    return false;
  }

  function getSession(req, res) {
    if (!sessionConfigured()) return null;
    const cookieValue = parseCookies(req)[cookieName];
    if (!cookieValue) return null;
    const sessionId = decodeURIComponent(cookieValue);
    const session = sessions.get(sessionId);
    if (!session) {
      clearSessionCookie(req, res);
      return null;
    }
    if (isExpired(session)) {
      sessions.delete(sessionId);
      clearSessionCookie(req, res);
      return null;
    }
    session.lastSeenAt = Date.now();
    return session;
  }

  function attachSession(req, res, next) {
    req.appSession = getSession(req, res);
    next();
  }

  function requireSession(req, res, next) {
    if (!sessionConfigured()) return next();
    if (req.appSession) return next();
    setNoStore(res);
    res.set("X-NAS-Linker-Auth", "session");
    return res.status(401).json({ ok: false, error: "session required" });
  }

  function login(req, res) {
    if (!sessionConfigured()) {
      return res.json({ ok: true, authenticated: true, mode: "disabled" });
    }

    const username = typeof req.body?.username === "string" ? req.body.username : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!username || !password) {
      setNoStore(res);
      return res.status(400).json({ ok: false, error: "username and password required" });
    }
    if (!timingSafeEqualStrings(username, appAuthUser)) {
      setNoStore(res);
      res.set("X-NAS-Linker-Auth", "session");
      return res.status(401).json({ ok: false, error: "invalid credentials" });
    }
    if (!verifyPassword(password, appAuthPasswordHash, parsedHash)) {
      setNoStore(res);
      res.set("X-NAS-Linker-Auth", "session");
      return res.status(401).json({ ok: false, error: "invalid credentials" });
    }

    const session = createSession();
    setNoStore(res);
    setSessionCookie(req, res, session.id);
    return res.json({ ok: true, authenticated: true });
  }

  function logout(req, res) {
    if (req.appSession?.id) {
      sessions.delete(req.appSession.id);
    }
    setNoStore(res);
    clearSessionCookie(req, res);
    return res.json({ ok: true, authenticated: false });
  }

  function sessionInfo(req, res) {
    setNoStore(res);
    if (!sessionConfigured()) {
      return res.json({ ok: true, authenticated: true, mode: "disabled" });
    }
    return res.json({ ok: true, authenticated: Boolean(req.appSession) });
  }

  function isAuthenticated(req) {
    return !sessionConfigured() || Boolean(req.appSession);
  }

  return {
    sessionConfigured,
    attachSession,
    requireSession,
    login,
    logout,
    sessionInfo,
    isAuthenticated,
  };
}

export function createTokenAuth(runToken) {
  return function auth(req, res, next) {
    const got = req.get("x-run-token");
    if (got !== runToken) return res.status(401).send("Unauthorized");
    next();
  };
}
