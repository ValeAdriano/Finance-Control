module.exports = function (api) {
  api.cache(true);
  // o preset do Expo (SDK 57) já inclui o plugin de worklets do Reanimated 4
  return { presets: ["babel-preset-expo"] };
};
