// src/limits.js — tier limit checks, driven by config/packages.json.
// In that config, null means unlimited.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'config', 'packages.json'), 'utf8')
);

function getConfig() {
  return config;
}

function getBrand() {
  return process.env.BRAND_NAME || config.brand || 'TakaTick';
}

/** Package definition for a merchant's package name; falls back to basic. */
function getPackage(packageName) {
  return config.packages[packageName] || config.packages.basic;
}

/** null limit = unlimited. Returns true when `count` has reached the limit. */
function limitReached(limit, count) {
  if (limit === null || limit === undefined) return false;
  return count >= limit;
}

function canAddNumber(pkg, currentCount) {
  return !limitReached(pkg.numbers, currentCount);
}

function canAddWebsite(pkg, currentCount) {
  return !limitReached(pkg.websites, currentCount);
}

function verificationLimitReached(pkg, usedThisMonth) {
  return limitReached(pkg.verificationsPerMonth, usedThisMonth);
}

/** All 4 supported MFS methods. Package `methods` lists which a tier may use. */
const ALL_METHODS = ['bkash', 'nagad', 'rocket', 'upay'];

/** True when the package allows registering a number for this method. */
function methodAllowedForPackage(pkg, method) {
  if (!pkg || !Array.isArray(pkg.methods)) return ALL_METHODS.includes(method);
  return pkg.methods.includes(method);
}

module.exports = {
  getConfig,
  getBrand,
  getPackage,
  limitReached,
  canAddNumber,
  canAddWebsite,
  verificationLimitReached,
  ALL_METHODS,
  methodAllowedForPackage,
};
