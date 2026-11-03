import { configuration } from "../src/config.js";
import { openDatabase } from "../src/db/connection.js";
import { migrate } from "../src/db/migrate.js";
const db = openDatabase(configuration().databasePath);
migrate(db);
db.close();
console.log("Migraciones verificadas.");
