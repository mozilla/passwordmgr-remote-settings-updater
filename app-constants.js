"use strict";

require("dotenv").config();

const environmentVariables = [
  "SERVER",
  "AUTHORIZATION",
]

const AppConstants = {};

for (const v of environmentVariables) {
  if (process.env[v] === undefined) {
    throw new Error(`Required environment variable was not set: ${v}`);
  }
  AppConstants[v] = process.env[v];
}

// Optional: set to "dev" when targeting the DEV Remote Settings server, which allows self-approval.
AppConstants.ENVIRONMENT = (process.env.ENVIRONMENT || "").toLowerCase();

module.exports = Object.freeze(AppConstants);
