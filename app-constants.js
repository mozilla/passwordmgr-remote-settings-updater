"use strict";

const path = require("path");
require("dotenv").config();

const environmentVariables = [
  "NODE_ENV",
  "FX_REMOTE_SETTINGS_WRITER_SERVER",
  "FX_REMOTE_SETTINGS_WRITER_USER",
  "FX_REMOTE_SETTINGS_WRITER_PASS"
]

const AppConstants = {};

for (const v of environmentVariables) {
  if (process.env[v] === undefined) {
    throw new Error(`Required environment variable was not set: ${v}`);
  }
  AppConstants[v] = process.env[v];
}

module.exports = Object.freeze(AppConstants);
