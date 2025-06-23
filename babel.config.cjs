module.exports = function (api) {
  api.cache(() => process.env.BUILD_TARGET);

  const isClient = process.env.BUILD_TARGET === "client";

  const sharedPlugins = [
    ["@babel/plugin-proposal-decorators", { version: "2023-11" }],
    ["@babel/plugin-transform-class-properties"],
    ["@babel/plugin-transform-class-static-block"],
    require("./babel/handle-imports.cjs"),
  ];
  const serverPlugins = ["@babel/plugin-syntax-import-attributes"];
  const clientPlugins = [];

  return {
    presets: [
      [
        "@babel/preset-env",
        {
          targets: isClient ? "last 2 versions" : { node: "24" },
          modules: false,
        },
      ],
      [
        "@babel/preset-typescript",
        {
          allowDeclareFields: true,
        },
      ],
    ],
    ignore: [
      "src/testApp/src/public/**/*",
      ...(isClient
        ? ["src/testApp/src/!(components)/**/*"]
        : ["src/testApp/src/components/**/*"]),
    ],
    only: isClient ? ["src/testApp/src/components/**/*.ts"] : ["src/**/*.ts"],
    plugins: [
      ...sharedPlugins,
      ...(!isClient ? serverPlugins : []),
      ...(isClient ? clientPlugins : []),
    ],
  };
};
