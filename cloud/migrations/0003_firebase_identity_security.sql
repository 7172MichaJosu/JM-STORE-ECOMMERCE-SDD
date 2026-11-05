ALTER TABLE users ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'LOCAL' CHECK(auth_provider IN('LOCAL','FIREBASE'));
ALTER TABLE users ADD COLUMN firebase_uid TEXT;
CREATE UNIQUE INDEX users_firebase_uid ON users(firebase_uid) WHERE firebase_uid IS NOT NULL;

ALTER TABLE sessions ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'LOCAL' CHECK(auth_provider IN('LOCAL','FIREBASE'));
ALTER TABLE sessions ADD COLUMN firebase_uid TEXT;
ALTER TABLE sessions ADD COLUMN firebase_id_token_ciphertext TEXT;
ALTER TABLE sessions ADD COLUMN firebase_refresh_token_ciphertext TEXT;

CREATE TABLE email_claims(
  email TEXT PRIMARY KEY CHECK(length(email)<=254 AND email=lower(trim(email))),
  claim_kind TEXT NOT NULL CHECK(claim_kind IN('ACCOUNT','IMPORTED','REGISTRATION','EMAIL_CHANGE')),
  user_id INTEGER REFERENCES users(id),
  firebase_uid TEXT,
  operation_id TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  CHECK((claim_kind IN('ACCOUNT','IMPORTED') AND user_id IS NOT NULL AND operation_id IS NULL AND expires_at IS NULL)
     OR (claim_kind IN('REGISTRATION','EMAIL_CHANGE') AND operation_id IS NOT NULL AND expires_at IS NOT NULL))
);
CREATE INDEX email_claim_expiry ON email_claims(expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE credential_operations(
  id TEXT PRIMARY KEY CHECK(length(id) BETWEEN 20 AND 128),
  user_id INTEGER NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK(kind IN('VERIFY_AND_CHANGE_EMAIL','CHANGE_PASSWORD')),
  current_email TEXT,
  pending_email TEXT,
  firebase_uid TEXT,
  firebase_id_token_ciphertext TEXT,
  firebase_refresh_token_ciphertext TEXT,
  state TEXT NOT NULL CHECK(state IN('PENDING','APPLYING','COMPLETED','CANCELLED','FAILED')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK((kind='VERIFY_AND_CHANGE_EMAIL' AND current_email IS NOT NULL AND pending_email IS NOT NULL) OR (kind='CHANGE_PASSWORD' AND current_email IS NULL AND pending_email IS NULL))
);
CREATE UNIQUE INDEX one_open_credential_operation ON credential_operations(user_id) WHERE state IN('PENDING','APPLYING');
