const TopLevel = require("./TopLevel");

const fs = require("fs");
const process = require("process");

const sample = process.argv[2];
const json = fs.readFileSync(sample);

const value = TopLevel.toTopLevel(json);
const backToJson = TopLevel.topLevelToJson(value);

// Regression check for #1655: every converter the generated module defines
// must also be listed in module.exports, or callers of the module can't reach
// it. With `--converters all-objects` this includes a `to<Type>`/`<type>ToJson`
// pair per object type (e.g. the nested `data123` object), which used to be
// generated but never exported. The same sample is rendered with several
// converter options, and the driver only receives the sample path, so we
// verify the invariant against whichever converters the current options
// actually emitted rather than assuming a fixed set. Converters have the
// distinctive signatures `function to<Name>(json)` and
// `function <name>ToJson(value)`; the module's helper functions do not.
const generatedSource = fs.readFileSync(require.resolve("./TopLevel"), "utf8");
const definedConverters = [
    ...generatedSource.matchAll(/^function (to[A-Z]\w*)\(json\)/gm),
    ...generatedSource.matchAll(/^function (\w+ToJson)\(value\)/gm),
].map((match) => match[1]);
for (const name of definedConverters) {
    if (typeof TopLevel[name] !== "function") {
        throw new Error(
            `converter ${name} is defined in the generated module but is not exported from module.exports`,
        );
    }
}

console.log(backToJson);
