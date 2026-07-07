// No logging here: this module runs at import time, and anything written to
// stdout corrupts redirected CLI output (issue #2874).
export const fetch = require("cross-fetch").default;
