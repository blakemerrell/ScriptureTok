#!/bin/sh
# Recompiles the inlined Tailwind block in index.html (between the
# tw:start / tw:end markers) from the classes the file actually uses.
# Only needed after adding new Tailwind classes to the markup.
set -e
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
printf '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n' > "$tmp/in.css"
npx -y tailwindcss@3 -i "$tmp/in.css" -o "$tmp/out.css" --minify --content index.html 2>/dev/null
node -e '
  const fs = require("fs");
  const css = fs.readFileSync(process.argv[1], "utf8").trim();
  const html = fs.readFileSync("index.html", "utf8");
  const re = /\/\* tw:start \*\/[\s\S]*?\/\* tw:end \*\//;
  if (!re.test(html)) { console.error("tw:start / tw:end markers not found"); process.exit(1); }
  fs.writeFileSync("index.html", html.replace(re, () => "/* tw:start */" + css + "/* tw:end */"));
  console.log("Inlined " + css.length + " bytes of Tailwind CSS");
' "$tmp/out.css"
rm -rf "$tmp"
