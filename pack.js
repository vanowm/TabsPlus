const crx3 = require("crx3");
const { readFileSync } = require("node:fs");

const meta = JSON.parse(readFileSync("src/manifest.json"));
const path = `xpi/tabs_-${meta.version}`;

crx3(["src/manifest.json"], {
	keyPath: "tabs+.pem",
	crxPath: path + `.crx`,
	zipPath: path + ".zip",
})
	.then(() => console.log("done"))
	.catch(console.error)
;