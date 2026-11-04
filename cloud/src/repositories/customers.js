import {
  fields,
  text,
  version,
  notFound,
} from "../../../shared/domain/index.js";
import { safeUser } from "../security/sessions.js";
import { mutate } from "./mutations.js";
export const addressFields = [
  "recipient",
  "phone",
  "region",
  "province",
  "district",
  "street",
  "reference",
];
export function addressInput(b) {
  return {
    recipient: text(b.recipient, "recipient", 2, 100),
    phone: text(b.phone, "phone", 7, 20),
    region: text(b.region, "region", 2, 100),
    province: text(b.province, "province", 2, 100),
    district: text(b.district, "district", 2, 100),
    street: text(b.street, "street", 5, 200),
    reference: b.reference ? text(b.reference, "reference", 0, 200) : null,
  };
}
export async function profile(req) {
  fields(req.body, ["name", "phone"]);
  const name = text(req.body.name, "name", 2, 100),
    phone = req.body.phone ? text(req.body.phone, "phone", 7, 20) : null;
  await mutate(
    req,
    "PROFILE",
    "1",
    [],
    [
      req.db.stmt(
        "UPDATE users SET name=?,phone=?,version=version+1,updated_at=? WHERE id=?",
        name,
        phone,
        new Date().toISOString(),
        req.user.id,
      ),
    ],
  );
  return safeUser(req.db, req.user.id);
}
export const addresses = (req) =>
  req.db.all(
    "SELECT * FROM addresses WHERE user_id=? AND is_active=1 ORDER BY id",
    req.user.id,
  );
export async function createAddress(req) {
  fields(req.body, addressFields);
  const a = addressInput(req.body);
  // The row is created as one validated INSERT; session identity is checked in the same batch.
  const result = await mutate(
    req,
    "ADDRESS",
    "1",
    [],
    [
      req.db.stmt(
        "INSERT INTO addresses(user_id,recipient,phone,region,province,district,street,reference) VALUES(?,?,?,?,?,?,?,?) RETURNING *",
        req.user.id,
        ...Object.values(a),
      ),
    ],
  );
  return result[1].results[0];
}
export async function changeAddress(req, remove = false) {
  fields(req.body, remove ? ["version"] : [...addressFields, "version"]);
  const a = await req.db.first(
    "SELECT * FROM addresses WHERE id=? AND user_id=? AND is_active=1",
    req.params.id,
    req.user.id,
  );
  if (!a) notFound();
  version(req.body.version, a.version);
  const statement = remove
    ? req.db.stmt(
        "UPDATE addresses SET is_active=0,version=version+1 WHERE id=?",
        a.id,
      )
    : req.db.stmt(
        "UPDATE addresses SET recipient=?,phone=?,region=?,province=?,district=?,street=?,reference=?,version=version+1 WHERE id=?",
        ...Object.values(addressInput({ ...a, ...req.body })),
        a.id,
      );
  await mutate(
    req,
    "ADDRESS",
    "EXISTS(SELECT 1 FROM addresses WHERE id=? AND user_id=? AND version=? AND is_active=1)",
    [a.id, req.user.id, a.version],
    [statement],
  );
  return remove
    ? null
    : req.db.first("SELECT * FROM addresses WHERE id=?", a.id);
}
