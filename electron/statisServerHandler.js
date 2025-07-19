const express = require("express");
const path = require("path");

const server = express();
server.use(express.static(path.join(__dirname, "../dist")));

function startStaticServer() {
  // 根据环境判断端口，与main.js保持一致
  const env = __dirname.split(path.sep).indexOf("app.asar") >= 0 ? "production" : "development";
  const port = env === "development" ? 2321 : 2322;

  server.listen(port, () => {
    console.log(`Express server is running on port ${port} (${env} environment)`);
  });
}

module.exports = {
  startStaticServer,
};
