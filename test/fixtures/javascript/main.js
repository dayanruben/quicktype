const TopLevel = require("./TopLevel");

const fs = require("fs");
const process = require("process");

const sample = process.argv[2];
const json = fs.readFileSync(sample);

const value = TopLevel.toTopLevel(json);
const backToJson = TopLevel.topLevelToJson(value);

const generatedSource = fs.readFileSync(require.resolve("./TopLevel"), "utf8");
if (generatedSource.includes("function toData123(")) {
    const data123 = TopLevel.toData123(JSON.stringify(value.data123));
    TopLevel.data123ToJson(data123);
}

console.log(backToJson);
