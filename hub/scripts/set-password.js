/**
 * Set or update a user's password in Supabase.
 * Run from hub folder: node scripts/set-password.js <email> <password>
 * Loads hub/.env.local for NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

const fs = require("fs");
const path = require("path");

// Load .env.local into process.env
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) {
          process.env[key] = value.slice(1, -1).replace(/\\"/g, '"');
        } else if (value.startsWith("'") && value.endsWith("'")) {
          process.env[key] = value.slice(1, -1).replace(/\\'/g, "'");
        } else {
          process.env[key] = value;
        }
      }
    }
  });
}

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error("Usage: node scripts/set-password.js <email> <password>");
  console.error("Example: node scripts/set-password.js lautaro@basement.studio MyPassword");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in hub/.env.local");
  process.exit(1);
}

async function main() {
  const { createClient } = require("@supabase/supabase-js");
  const bcrypt = require("bcryptjs");

  const supabase = createClient(url, key);
  const normalizedEmail = email.trim().toLowerCase();

  const { data: user, error: fetchError } = await supabase
    .from("users")
    .select("id")
    .eq("email", normalizedEmail)
    .single();

  if (fetchError || !user) {
    console.error("User not found:", normalizedEmail);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const { error: updateError } = await supabase
    .from("users")
    .update({
      password_hash: passwordHash,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (updateError) {
    console.error("Update failed:", updateError.message);
    process.exit(1);
  }

  console.log("Password set for", normalizedEmail);
}

main();
