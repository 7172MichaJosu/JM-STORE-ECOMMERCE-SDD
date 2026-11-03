import { configuration } from "../src/config.js";
import { openDatabase } from "../src/db/connection.js";
import { migrate } from "../src/db/migrate.js";
import { seed } from "../src/modules/catalog/seed-data.js";
const db = openDatabase(configuration().databasePath);
migrate(db);
seed(db);
db.close();
console.log(
  "Catálogo de demostración preparado; datos existentes conservados.",
);
