/**
 * AGP 9+ / R8: proguard-android.txt is rejected. Capacitor plugins still ship the old default.
 * Run on postinstall so every Capacitor plugin android/build.gradle stays fixed after npm install.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "node_modules", "@capacitor");
if (!fs.existsSync(root)) {
  process.exit(0);
}

let count = 0;
for (const name of fs.readdirSync(root)) {
  const gradle = path.join(root, name, "android", "build.gradle");
  if (!fs.existsSync(gradle)) continue;
  let s = fs.readFileSync(gradle, "utf8");
  if (!s.includes("getDefaultProguardFile('proguard-android.txt')")) continue;
  s = s.replace(
    /getDefaultProguardFile\('proguard-android\.txt'\)/g,
    "getDefaultProguardFile('proguard-android-optimize.txt')",
  );
  fs.writeFileSync(gradle, s);
  count += 1;
  console.log("[fix-capacitor-proguard] patched", path.join("@capacitor", name, "android", "build.gradle"));
}
if (count) console.log("[fix-capacitor-proguard] done,", count, "file(s).");
