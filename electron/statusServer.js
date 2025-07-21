const express = require("express");
const WebSocket = require("ws");
const { log } = require("./log");

class StatusServer {
  constructor(workStatsManager = null) {
    this.app = express();
    this.httpServer = null;
    this.wsServer = null;
    this.clients = new Set(); // 存储WebSocket客户端
    this.workStatsManager = workStatsManager; // 存储工作统计管理器实例

    // 工作时长追踪相关
    this.isWorkingActive = false; // 是否正在工作
    this.workStartTime = null; // 工作开始时间
    this.workElapsedTime = "00:00"; // 当前工作时长
    this.workTimerInterval = null; // 工作时长广播定时器
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

        // 处理工作时长追踪
        this.handleWorkingStatusChange(cursor_status);

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
        is_working: this.isWorkingActive,
        work_elapsed_time: this.workElapsedTime,
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

      // 立即发送当前工作统计数据给新连接的客户端
      this.sendCurrentWorkStats(ws);

      // 如果正在工作，发送当前工作时长
      if (this.isWorkingActive) {
        this.sendCurrentWorkTimer(ws);
      }

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

  // 处理工作状态变化，开始或停止时长追踪
  handleWorkingStatusChange(status) {
    const isWorkingStatus = status.includes("工作中");
    const isWorkEndStatus = status.includes("工作结束");

    if (isWorkingStatus && !this.isWorkingActive) {
      // 开始工作
      this.startWorkTimer();
      log.info("开始工作时长追踪");
    } else if (isWorkEndStatus && this.isWorkingActive) {
      // 结束工作
      const finalDuration = this.workElapsedTime;
      this.stopWorkTimer();
      log.info(`工作结束，最终时长: ${finalDuration}`);

      // 广播工作结束的最终时长
      this.broadcastWorkTimerUpdate(true, finalDuration);

      // 如果有工作统计管理器，记录工作完成
      if (this.workStatsManager) {
        try {
          const updatedStats = this.workStatsManager.addWorkRecord(finalDuration);
          this.broadcastWorkStats(updatedStats);
        } catch (error) {
          log.error("记录工作统计失败:", error);
        }
      }
    } else if (!isWorkingStatus && !isWorkEndStatus && this.isWorkingActive) {
      // 其他状态，停止工作
      this.stopWorkTimer();
      log.info("工作状态结束，停止时长追踪");
    }
  }

  // 开始工作时长追踪
  startWorkTimer() {
    this.isWorkingActive = true;
    this.workStartTime = new Date();
    this.workElapsedTime = "00:00";

    // 清除之前的定时器
    if (this.workTimerInterval) {
      clearInterval(this.workTimerInterval);
    }

    // 立即更新一次时长
    this.updateWorkElapsedTime();

    // 每秒更新并广播工作时长
    this.workTimerInterval = setInterval(() => {
      this.updateWorkElapsedTime();
      this.broadcastWorkTimerUpdate(false);
    }, 1000);

    // 立即广播工作开始
    this.broadcastWorkTimerUpdate(false);
  }

  // 停止工作时长追踪
  stopWorkTimer() {
    this.isWorkingActive = false;
    this.workStartTime = null;
    this.workElapsedTime = "00:00";

    // 清除定时器
    if (this.workTimerInterval) {
      clearInterval(this.workTimerInterval);
      this.workTimerInterval = null;
    }
  }

  // 更新工作已用时间
  updateWorkElapsedTime() {
    if (!this.workStartTime || !this.isWorkingActive) {
      this.workElapsedTime = "00:00";
      return;
    }

    const now = new Date();
    const elapsedMs = now.getTime() - this.workStartTime.getTime();
    const elapsedSeconds = Math.floor(elapsedMs / 1000);

    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;

    this.workElapsedTime = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  // 广播工作时长更新
  broadcastWorkTimerUpdate(isCompleted = false, finalDuration = null) {
    const message = {
      type: "work_timer_update",
      data: {
        isWorking: this.isWorkingActive,
        isCompleted: isCompleted,
        elapsedTime: finalDuration || this.workElapsedTime,
        timestamp: new Date().toISOString(),
      },
    };

    this.broadcastToClients(message);

    if (isCompleted) {
      log.info(`广播工作完成时长: ${finalDuration}`);
    }
  }

  // 发送当前工作时长给指定客户端
  sendCurrentWorkTimer(ws) {
    if (!this.isWorkingActive) return;

    const message = {
      type: "work_timer_update",
      data: {
        isWorking: this.isWorkingActive,
        isCompleted: false,
        elapsedTime: this.workElapsedTime,
        timestamp: new Date().toISOString(),
      },
    };

    if (ws.readyState === 1) {
      // WebSocket.OPEN
      ws.send(JSON.stringify(message));
      log.info(`已向新连接客户端发送当前工作时长: ${this.workElapsedTime}`);
    }
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

  // 广播工作统计更新
  broadcastWorkStats(stats) {
    const message = {
      type: "work_stats_update",
      data: stats,
      timestamp: new Date().toISOString(),
    };

    log.info("广播工作统计更新:", stats);
    this.broadcastToClients(message);
  }

  // 发送当前工作统计数据给指定客户端
  sendCurrentWorkStats(ws) {
    try {
      if (this.workStatsManager) {
        const currentStats = this.workStatsManager.getTodayStats();
        const message = {
          type: "work_stats_update",
          data: currentStats,
          timestamp: new Date().toISOString(),
        };

        if (ws.readyState === 1) {
          // WebSocket.OPEN
          ws.send(JSON.stringify(message));
          log.info("已向新连接客户端发送当前工作统计:", currentStats);
        }
      } else {
        log.warn("WorkStatsManager实例不可用，无法发送工作统计数据");
      }
    } catch (error) {
      log.error("发送当前工作统计数据失败:", error);
    }
  }

  // 停止服务
  stop() {
    return new Promise((resolve) => {
      log.info("正在停止状态服务器...");

      // 停止工作时长追踪
      this.stopWorkTimer();

      let pendingClosures = 0;
      let hasResolved = false;

      const attemptResolve = () => {
        if (pendingClosures === 0 && !hasResolved) {
          hasResolved = true;
          log.info("状态服务器完全停止");
          resolve();
        }
      };

      // 关闭所有WebSocket连接
      this.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.close();
          } catch (error) {
            log.error("关闭WebSocket客户端时出错:", error);
          }
        }
      });
      this.clients.clear();

      // 关闭WebSocket服务器
      if (this.wsServer) {
        pendingClosures++;
        this.wsServer.close((error) => {
          if (error) {
            log.error("关闭WebSocket服务器时出错:", error);
          } else {
            log.info("WebSocket服务器已关闭");
          }
          pendingClosures--;
          attemptResolve();
        });
      }

      // 关闭HTTP服务器
      if (this.httpServer) {
        pendingClosures++;
        this.httpServer.close((error) => {
          if (error) {
            log.error("关闭HTTP服务器时出错:", error);
          } else {
            log.info("HTTP服务器已关闭");
          }
          pendingClosures--;
          attemptResolve();
        });
      }

      // 如果没有需要关闭的服务器，直接解析
      if (pendingClosures === 0) {
        hasResolved = true;
        resolve();
      }

      // 设置超时，防止永远等待
      setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          log.warn("停止服务器超时，强制退出");
          resolve();
        }
      }, 5000); // 5秒超时
    });
  }
}

module.exports = { StatusServer };
