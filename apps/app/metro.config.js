// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The content snapshot (assets/db/hadith.db) is bundled as an asset and copied into place
// by expo-sqlite on first launch.
config.resolver.assetExts.push('db');

module.exports = config;
