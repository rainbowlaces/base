module.exports = {
  sourceMaps: true,
  presets: [
    [
      "@babel/preset-env",
      {
        targets: {
          node: "20",
        },
        modules: false,
      },
    ],
    "@babel/preset-typescript",
  ],
  plugins: [
    require("./babel/handle-imports.cjs"),
    ["@babel/plugin-proposal-decorators", { version: "2023-05" }],
  ],
};
