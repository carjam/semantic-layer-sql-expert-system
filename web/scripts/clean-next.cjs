/** Remove Next.js build output (fixes stale/corrupt .next ENOENT errors). */
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", ".next");
fs.rmSync(dir, { recursive: true, force: true });
console.log("Removed .next");
