const express = require("express");
const path = require("path");

const server = express();
server.use(express.static(path.join(__dirname, "../dist")));

function startStaticServer() {
  server.listen(2322, () => {
    console.log("Express server is running on port 2322");
  });
}

module.exports = {
  startStaticServer,
};
