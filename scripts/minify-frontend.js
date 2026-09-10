// Minifies/mangles the Mini App and Admin Panel JS in place as *.min.js
// siblings, for an extra (non-magical) layer of obfuscation before deploying.
//
// IMPORTANT — read this before relying on it: JavaScript that runs in the
// user's browser can ALWAYS be read, via devtools or by fetching the file
// directly, no matter how it's minified or mangled. This step only raises
// the bar for casual copy-pasting; it does not hide logic and must never be
// the thing protecting a secret. The real protection is that every actual
// secret (BOT_TOKEN, ADMIN_KEY, the crash-point algorithm, D1 access) lives
// only in the Worker (src/), which the browser never receives at all.
//
// Usage: npm run minify   (then point index.html / admin/index.html at the
// generated *.min.js files instead of the plain ones, if you want them).
const esbuild = require("esbuild");
const path = require("path");

const files = [
  "public/src/icons.js",
  "public/src/services/api.js",
  "public/src/services/socket.js",
  "public/src/services/ton.js",
  "public/src/app.js",
  "public/admin/admin.js",
];

(async () => {
  for (const file of files) {
    const outfile = file.replace(/\.js$/, ".min.js");
    await esbuild.build({
      entryPoints: [path.join(__dirname, "..", file)],
      outfile: path.join(__dirname, "..", outfile),
      minify: true,
      target: "es2019",
      // No `bundle`/`format` wrapper on purpose: these are plain (non-module)
      // scripts whose top-level `function`/`var` declarations must stay on
      // `window` so inline onclick="..." handlers in the HTML keep working.
      // Wrapping in an IIFE (the usual esbuild default for a "clean" bundle)
      // would scope everything away from `window` and break every button.
      logLevel: "info",
    });
  }
  console.log("\nDone. Swap the corresponding <script src=\"...\"> tags to the .min.js files to use them.");
})();
