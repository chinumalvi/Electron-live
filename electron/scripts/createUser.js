// createUser.js
require("dotenv").config();
const connectDB = require("../services/db/connect");
const User = require("../services/db/models/User");
const bcrypt = require("bcryptjs");

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: node scripts/createUser.js username password [email] [role]");
    process.exit(1);
  }
  const [username, password, email, role = "user"] = args;
  try {
    await connectDB(process.env.MONGO_URI);
    // If a user with same username exists -> fail
    const exists = await User.findOne({ username });
    if (exists) {
      console.error("User already exists:", username);
      process.exit(1);
    }
    const hash = await bcrypt.hash(password, 10);
    const u = await User.create({
      username,
      passwordHash: hash,
      email,
      role,
    });
    console.log("User created:", u._id.toString(), username, role);
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

main();
