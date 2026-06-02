let input = "";
process.stdin.on("data", d => input += d);
process.stdin.on("end", () => {
  const lines = input.replace(/\r/g, "").split("\n");
  let inTags = false;
  for (const line of lines) {
    if (/^tags:\s*$/.test(line)) { inTags = true; continue; }
    if (inTags && line.length > 0 && !/^\s/.test(line)) break;
    if (inTags) {
      const m = line.match(/^\s*-\s*name:\s*(.+)$/);
      if (m) {
        let name = m[1].trim();
        // Remove surrounding single or double quotes if present
        name = name.replace(/^['"]|['"]$/g, "").trim();
        if (name.length > 0) console.log(name);
      }
    }
  }
});
