export async function findFirebaseIdentity(db, uid, email) {
  if (typeof uid !== "string" || !uid || typeof email !== "string") return null;
  const user = await db.first("SELECT * FROM users WHERE firebase_uid=? AND auth_provider='FIREBASE' AND is_active=1", uid);
  return user?.email === email.toLowerCase() ? user : null;
}
