import { readFileSync } from "node:fs";
import { argv } from "node:process";
import PropTypes from "prop-types";
import { TopLevel } from "./toplevel.js";

const sample = argv[2];
const json = readFileSync(sample);
const obj = JSON.parse(json);

const errors = [];
const originalConsoleError = console.error;
console.error = (...args) => errors.push(args.join(" "));

try {
    PropTypes.resetWarningCache();
    PropTypes.checkPropTypes({ obj: TopLevel }, { obj }, "prop", "MyComponent");
} finally {
    console.error = originalConsoleError;
}

if (errors.length > 0) {
    console.log("Failure:", errors.join("\n"));
} else {
    console.log("Success");
}
