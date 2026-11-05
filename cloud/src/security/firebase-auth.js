const apiBase = "https://identitytoolkit.googleapis.com/v1";
const tokenBase = "https://securetoken.googleapis.com/v1";

export class FirebaseAuthError extends Error {
  constructor(code = "AUTH_UNAVAILABLE") {
    super("No se pudo completar la operación de autenticación.");
    this.name = "FirebaseAuthError";
    this.code = code;
  }
}

function required(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${name} requerido.`);
  return value.trim();
}

async function call(fetcher, url, body, form = false) {
  let response;
  try {
    response = await fetcher(url, {
      method: "POST",
      headers: { "content-type": form ? "application/x-www-form-urlencoded" : "application/json" },
      body: form ? new URLSearchParams(body).toString() : JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new FirebaseAuthError();
  }
  let data;
  try { data = await response.json(); } catch { throw new FirebaseAuthError(); }
  if (!response.ok) throw new FirebaseAuthError();
  return data;
}

const identity = (value) => ({
  uid: value.localId ?? value.user_id,
  email: typeof value.email === "string" ? value.email.toLowerCase() : null,
  idToken: value.idToken ?? value.id_token,
  refreshToken: value.refreshToken ?? value.refresh_token,
  expiresIn: Number(value.expiresIn ?? value.expires_in),
});

export function firebaseAuth({ projectId, apiKey, fetcher = fetch }) {
  const project = required(projectId, "FIREBASE_PROJECT_ID");
  const key = required(apiKey, "FIREBASE_API_KEY");
  const endpoint = (method) => `${apiBase}/accounts:${method}?key=${encodeURIComponent(key)}`;
  return {
    async signUp(email, password) {
      const data = await call(fetcher, endpoint("signUp"), { email: required(email, "email"), password: required(password, "password"), returnSecureToken: true });
      const result = identity(data);
      if (!result.uid || !result.idToken || !result.refreshToken) throw new FirebaseAuthError();
      return result;
    },
    async signIn(email, password) {
      const data = await call(fetcher, endpoint("signInWithPassword"), { email: required(email, "email"), password: required(password, "password"), returnSecureToken: true });
      const result = identity(data);
      if (!result.uid || !result.idToken || !result.refreshToken) throw new FirebaseAuthError();
      return result;
    },
    async lookup(idToken) {
      const data = await call(fetcher, endpoint("lookup"), { idToken: required(idToken, "idToken") });
      const user = data.users?.[0];
      if (!user?.localId) throw new FirebaseAuthError();
      return { uid: user.localId, email: user.email?.toLowerCase() ?? null, emailVerified: user.emailVerified === true, disabled: user.disabled === true, validSince: user.validSince ?? null };
    },
    async refresh(refreshToken) {
      const data = await call(fetcher, `${tokenBase}/token?key=${encodeURIComponent(key)}`, { grant_type: "refresh_token", refresh_token: required(refreshToken, "refreshToken") }, true);
      const result = identity(data);
      if (!result.uid || !result.idToken || !result.refreshToken) throw new FirebaseAuthError();
      return result;
    },
    async sendEmailChange(idToken, newEmail, continueUrl) {
      return call(fetcher, endpoint("sendOobCode"), { requestType: "VERIFY_AND_CHANGE_EMAIL", idToken: required(idToken, "idToken"), newEmail: required(newEmail, "newEmail"), ...(continueUrl ? { continueUrl } : {}) });
    },
    async inspectEmailChangeCode(oobCode) {
      const data = await call(fetcher, endpoint("resetPassword"), { oobCode: required(oobCode, "oobCode") });
      return { email: data.email?.toLowerCase() ?? null, newEmail: data.newEmail?.toLowerCase() ?? null, requestType: data.requestType };
    },
    async applyEmailChange(oobCode) {
      const data = await call(fetcher, endpoint("update"), { oobCode: required(oobCode, "oobCode") });
      return { uid: data.localId, email: data.email?.toLowerCase() ?? null };
    },
    async changePassword(idToken, password) {
      const data = await call(fetcher, endpoint("update"), { idToken: required(idToken, "idToken"), password: required(password, "password"), returnSecureToken: true });
      return identity(data);
    },
    async deleteAccount(idToken) {
      await call(fetcher, endpoint("delete"), { idToken: required(idToken, "idToken") });
    },
    projectId: project,
  };
}
