const express = require("express");
const WebSocket = require("ws");
const { log } = require("./log");

class StatusServer {
  constructor() {
    this.app = express();
    this.httpServer = null;
    this.wsServer = null;
    this.clients = new Set(); // 存储WebSocket客户端
  }

  // 启动HTTP和WebSocket服务
  start() {
    this.setupHTTPServer();
    this.setupWebSocketServer();
  }

  // 设置HTTP服务器
  setupHTTPServer() {
    // 中间件：解析JSON和URL编码
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // 设置CORS
    this.app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
      res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      next();
    });

    // 状态接口
    this.app.get("/status", (req, res) => {
      log.info(`接收到状态更新请求: ${req}`);
      try {
        const { cursor_status } = req.query;

        if (!cursor_status) {
          log.warn("状态参数缺失");
          return res.status(400).json({
            error: "格式错误",
            message: "缺少cursor_status参数",
          });
        }

        log.info(`接收到状态更新: ${cursor_status}`);

        // 构造消息
        const message = {
          type: "status_update",
          status: cursor_status,
          timestamp: new Date().toISOString(),
        };

        // 推送到所有WebSocket客户端
        this.broadcastToClients(message);

        res.json({
          success: true,
          message: "状态更新成功",
          received_status: cursor_status,
        });
      } catch (error) {
        log.error("处理状态更新请求时出错:", error);
        res.status(500).json({
          error: "格式错误",
          message: "服务器内部错误",
        });
      }
    });

    // 健康检查接口
    this.app.get("/health", (req, res) => {
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        connected_clients: this.clients.size,
      });
    });

    // 启动HTTP服务器
    this.httpServer = this.app.listen(4090, "127.0.0.1", () => {
      log.info("HTTP状态服务器启动在端口 4090");
    });

    this.httpServer.on("error", (error) => {
      log.error("HTTP服务器错误:", error);
    });
  }

  // 设置WebSocket服务器
  setupWebSocketServer() {
    this.wsServer = new WebSocket.Server({
      port: 4091,
      host: "0.0.0.0", // 监听所有网络接口
    });

    this.wsServer.on("listening", () => {
      log.info("WebSocket服务器启动在端口 4091，监听所有网络接口");
    });

    this.wsServer.on("connection", (ws, req) => {
      const clientIp = req.socket.remoteAddress;
      log.info(`新的WebSocket连接: ${clientIp}`);

      // 添加客户端到集合
      this.clients.add(ws);

      // 发送连接成功消息
      ws.send(
        JSON.stringify({
          type: "connection_established",
          message: "连接成功",
          timestamp: new Date().toISOString(),
        })
      );

      // 处理客户端消息
      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data);
          // log.info(`收到客户端消息:`, message);

          // 处理心跳
          if (message.type === "ping") {
            ws.send(
              JSON.stringify({
                type: "pong",
                timestamp: new Date().toISOString(),
              })
            );
          }
        } catch (error) {
          log.error("解析客户端消息出错:", error);
        }
      });

      // 处理连接关闭
      ws.on("close", (code, reason) => {
        log.info(`WebSocket连接关闭: ${clientIp}, 代码: ${code}, 原因: ${reason}`);
        this.clients.delete(ws);
      });

      // 处理连接错误
      ws.on("error", (error) => {
        log.error(`WebSocket连接错误: ${clientIp}:`, error);
        this.clients.delete(ws);
      });
    });

    this.wsServer.on("error", (error) => {
      log.error("WebSocket服务器错误:", error);
    });
  }

  // 广播消息到所有客户端
  broadcastToClients(message) {
    const messageStr = JSON.stringify(message);
    let successCount = 0;
    let failCount = 0;

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr);
          successCount++;
        } catch (error) {
          log.error("发送消息到客户端失败:", error);
          failCount++;
          this.clients.delete(client);
        }
      } else {
        // 移除已关闭的连接
        this.clients.delete(client);
        failCount++;
      }
    });

    log.info(`消息广播完成: 成功 ${successCount}, 失败 ${failCount}`);
  }

  // 停止服务
  stop() {
    return new Promise((resolve) => {
      log.info("正在停止状态服务器...");

      // 关闭所有WebSocket连接
      this.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.close();
        }
      });
      this.clients.clear();

      // 关闭WebSocket服务器
      if (this.wsServer) {
        this.wsServer.close(() => {
          log.info("WebSocket服务器已关闭");
        });
      }

      // 关闭HTTP服务器
      if (this.httpServer) {
        this.httpServer.close(() => {
          log.info("HTTP服务器已关闭");
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = { StatusServer };
