module.exports = {
  apps: [
    {
      name: "server",
      script: "node",
      args: "dist/server.js",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
