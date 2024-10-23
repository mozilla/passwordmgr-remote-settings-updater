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

module.exports = Object.freeze(AppConstants);
