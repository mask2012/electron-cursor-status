<template>
  <div id="app">
    <!-- 顶部三栏布局 -->
    <div class="row_top">
      <!-- 左侧：连接状态指示器（仅在非连接状态时显示） -->
      <div v-if="connectionStatus !== 'connected'" class="connection-status" :class="connectionStatusClass">
        <div class="status-icon">
          <div v-if="connectionStatus === 'connecting'" class="spinner"></div>
          <div v-else class="dot disconnected"></div>
        </div>
        <span class="status-text">{{ connectionStatusText }}</span>
      </div>
      <!-- 占位元素，保持布局平衡 -->
      <div v-else class="connection-status-placeholder"></div>

      <!-- 中间：标题 -->
      <div class="center-title">
        <h1>Cursor 状态监控</h1>
      </div>

      <!-- 右侧：二维码 -->
      <div class="qr-code-container" v-if="!isMobile">
        <div class="qr-icon" @mouseenter="showQRCode" @mouseleave="hideQRCode">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M3 11V3h8v8H3zM5 5v4h4V5H5zM3 21v-8h8v8H3zM5 15v4h4v-4H5zM13 3h8v8h-8V3zM15 5v4h4V5h-4zM19 19h2v2h-2v-2zM13 13h2v2h-2v-2zM15 15h2v2h-2v-2zM13 17h2v2h-2v-2zM15 19h2v2h-2v-2zM17 17h2v2h-2v-2zM17 13h2v2h-2v-2zM19 15h2v2h-2v-2z"
            />
          </svg>
        </div>
        <!-- 二维码悬浮显示 -->
        <div v-if="qrCodeVisible" class="qr-code-popup" ref="qrPopup">
          <img :src="qrCodeDataURL" alt="二维码" />
        </div>
      </div>
    </div>

    <!-- 音乐控制区域 -->
    <div class="music-controls">
      <div class="music-control-item">
        <div class="control-icon">🎵</div>
        <span class="control-label">工作时音乐</span>
        <div class="switch" :class="{ active: musicSettings.workingMusic }" @click="toggleWorkingMusic">
          <div class="switch-handle"></div>
        </div>
        <!-- 播放提示 -->
        <div v-if="workingMusicPlaying" class="playing-indicator">
          <div class="playing-animation">
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
          </div>
          <!-- <span class="playing-text">试听中</span> -->
        </div>
      </div>

      <div class="music-control-item">
        <div class="control-icon">🔔</div>
        <span class="control-label">完成提示音</span>
        <div class="switch" :class="{ active: musicSettings.completionSound }" @click="toggleCompletionSound">
          <div class="switch-handle"></div>
        </div>
        <!-- 播放提示 -->
        <div v-if="completionSoundPlaying" class="playing-indicator">
          <div class="playing-animation">
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
          </div>
          <!-- <span class="playing-text">试听中</span> -->
        </div>
      </div>
    </div>

    <!-- 音频解锁提示 -->
    <!-- 移除整个音频解锁提示区域 -->

    <!-- 隐藏的音频元素 -->
    <audio ref="workingAudio" loop preload="auto">
      <source src="./assets/audio/working.mp3" type="audio/mpeg" />
    </audio>

    <audio ref="successAudio" preload="auto">
      <source src="./assets/audio/success.mp3" type="audio/mpeg" />
    </audio>

    <div class="main-container">
      <!-- 工作状态展示区域 -->
      <div class="work-status-container" v-if="currentStatus && !isWorkStatusHidden">
        <!-- 蒙层 -->
        <div class="work-status-overlay" @click="hideWorkStatus"></div>

        <div class="work-status" :class="workStatusClass">
          <!-- 关闭按钮 (仅在工作结束时显示) -->
          <div v-if="isWorkCompleted" class="close-btn" @click="hideWorkStatus" title="关闭">✕</div>

          <!-- 计时器显示区域 -->
          <div class="timer-section" v-if="isWorking || (isWorkCompleted && finalWorkDuration)">
            <div class="timer-container">
              <!-- 工作中实时计时器 -->
              <div v-if="isWorking" class="work-timer active">
                <div class="timer-label">工作时长</div>
                <div class="timer-value">{{ workElapsedTime }}</div>
              </div>
              <!-- 工作结束最终耗时 -->
              <div v-else-if="isWorkCompleted && finalWorkDuration" class="work-timer completed">
                <div class="timer-label">总工作时长</div>
                <div class="timer-value">{{ finalWorkDuration }}</div>
              </div>
            </div>
          </div>

          <!-- 动画和状态区域 -->
          <div class="animation-section">
            <!-- 工作中动画 -->
            <div v-if="isWorking" class="work-animation">
              <div class="loading-spinner">
                <div class="spinner-circle"></div>
              </div>
            </div>

            <!-- 工作结束动画 -->
            <div v-else-if="isWorkCompleted" class="work-completed">
              <div class="completed-icon">✓</div>
            </div>
          </div>

          <!-- 状态内容 -->
          <div class="status-content">
            <div class="status-detail" v-if="statusDetail">{{ statusDetail }}</div>
          </div>
        </div>
      </div>

      <div class="content">
        <!-- 状态历史 -->
        <div class="status-history">
          <h3>状态历史</h3>
          <div class="history-list">
            <div
              v-for="(item, index) in statusHistory"
              :key="index"
              class="history-item"
              :class="{ working: item.isWorking, completed: item.isCompleted }"
            >
              <div class="history-time">{{ formatTime(item.timestamp) }}</div>
              <div class="history-status">
                <span v-if="item.isCompleted" class="status-text">{{ getStatusText(item.status) }}</span>
                <span v-else>{{ item.status }}</span>
                <span v-if="item.isCompleted && getDuration(item.status)" class="duration-highlight">
                  {{ getDuration(item.status) }}
                </span>
              </div>
            </div>
          </div>
          <div v-if="statusHistory.length === 0" class="no-history">暂无状态记录</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import QRCode from "qrcode";

export default {
  name: "App",
  data() {
    return {
      // WebSocket 相关
      ws: null,
      connectionStatus: "disconnected", // disconnected, connecting, connected
      heartbeatTimer: null,
      reconnectTimer: null,
      reconnectAttempts: 0,
      maxReconnectAttempts: 10,

      // IP 获取相关
      currentIP: "127.0.0.1", // 默认本地地址
      ipSources: [], // IP来源记录

      // 端口相关
      currentPort: 2321, // 默认端口（开发环境）

      // 状态相关
      currentStatus: null,
      statusHistory: [],
      maxHistoryItems: 20,

      // 动画状态
      isWorking: false,
      isWorkCompleted: false,
      statusTransitionTimer: null,

      // 计时器相关
      workStartTime: null, // 工作开始时间
      workElapsedTime: "00:00", // 已工作时间
      workTimer: null, // 工作计时器

      // 工作状态显示控制
      isWorkStatusHidden: false, // 是否隐藏工作状态窗口
      finalWorkDuration: null, // 最终工作时长

      // 二维码相关
      qrCodeVisible: false,
      qrCodeDataURL: "",

      // 音乐设置
      musicSettings: {
        workingMusic: false, // 默认关闭
        completionSound: false, // 默认关闭
      },

      // 移除音频解锁相关状态
      isMobile: false, // 是否为移动端设备

      // 播放状态
      workingMusicPlaying: false, // 工作音乐播放状态
      completionSoundPlaying: false, // 完成提示音播放状态
      workingMusicPreviewTimer: null, // 工作音乐预览定时器
    };
  },
  computed: {
    // 连接状态样式类
    connectionStatusClass() {
      return {
        "status-connected": this.connectionStatus === "connected",
        "status-connecting": this.connectionStatus === "connecting",
        "status-disconnected": this.connectionStatus === "disconnected",
      };
    },

    // 连接状态文本
    connectionStatusText() {
      switch (this.connectionStatus) {
        case "connected":
          return "连接正常";
        case "connecting":
          return "连接中...";
        case "disconnected":
          return "连接断开";
        default:
          return "未知状态";
      }
    },

    // 工作状态样式类
    workStatusClass() {
      return {
        working: this.isWorking,
        completed: this.isWorkCompleted,
      };
    },

    // 状态标题
    statusTitle() {
      if (!this.currentStatus) return "";

      if (this.currentStatus.includes("工作中")) {
        return "工作中";
      } else if (this.currentStatus.includes("工作结束")) {
        return "工作结束";
      }
      return "状态更新";
    },

    // 状态详情
    statusDetail() {
      if (!this.currentStatus) return "";

      // 提取冒号后的内容作为详情
      const colonIndex = this.currentStatus.indexOf(":");
      if (colonIndex !== -1 && colonIndex < this.currentStatus.length - 1) {
        return this.currentStatus.substring(colonIndex + 1).trim();
      }
      return "";
    },

    // 二维码链接
    qrCodeURL() {
      return `http://${this.currentIP}:${this.currentPort}/?ip=${this.currentIP}`;
    },
  },
  methods: {
    // 获取IP地址（两种方式）
    async getIPAddress() {
      this.ipSources = [];
      let finalIP = "127.0.0.1";

      // 获取端口信息
      await this.getPortInfo();

      // 方式1：从URL参数获取IP
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlIP = urlParams.get("ip");
        if (urlIP && this.isValidIP(urlIP)) {
          this.ipSources.push({
            source: "URL参数",
            ip: urlIP,
            success: true,
          });
          finalIP = urlIP;
          console.log("从URL参数获取到IP:", urlIP);
        } else if (urlIP) {
          this.ipSources.push({
            source: "URL参数",
            ip: urlIP,
            success: false,
            error: "IP格式无效",
          });
        }
      } catch (error) {
        console.error("从URL获取IP失败:", error);
        this.ipSources.push({
          source: "URL参数",
          success: false,
          error: error.message,
        });
      }

      // 方式2：从electron获取IP
      try {
        if (window.electronAPI && window.electronAPI.getNetworkInterfaces) {
          const networkInfo = await window.electronAPI.getNetworkInterfaces();
          if (networkInfo.ipv4 && this.isValidIP(networkInfo.ipv4)) {
            this.ipSources.push({
              source: "Electron本机网卡",
              ip: networkInfo.ipv4,
              mac: networkInfo.mac,
              success: true,
            });
            // 如果URL没有提供有效IP，则使用electron获取的IP
            if (!this.ipSources.find((src) => src.source === "URL参数" && src.success)) {
              finalIP = networkInfo.ipv4;
            }
            console.log("从Electron获取到IP:", networkInfo.ipv4, "MAC:", networkInfo.mac);
          } else if (networkInfo.error) {
            this.ipSources.push({
              source: "Electron本机网卡",
              success: false,
              error: networkInfo.error,
            });
          }
        }
      } catch (error) {
        console.error("从Electron获取IP失败:", error);
        this.ipSources.push({
          source: "Electron本机网卡",
          success: false,
          error: error.message,
        });
      }

      this.currentIP = finalIP;
      console.log("最终使用的IP地址:", finalIP);
      console.log("IP获取来源记录:", this.ipSources);

      return finalIP;
    },

    // 获取端口信息
    async getPortInfo() {
      try {
        if (window.electronAPI && window.electronAPI.getPortInfo) {
          const portInfo = await window.electronAPI.getPortInfo();
          if (portInfo.port) {
            this.currentPort = portInfo.port;
            console.log("从Electron获取到端口信息:", portInfo);
          } else if (portInfo.error) {
            console.error("获取端口信息失败:", portInfo.error);
          }
        } else {
          console.log("electronAPI.getPortInfo不可用，使用默认端口2321");
        }
      } catch (error) {
        console.error("获取端口信息异常:", error);
      }
    },

    // 验证IP地址格式
    isValidIP(ip) {
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      return ipRegex.test(ip);
    },

    // 通过URL参数判断是否为移动端访问
    isMobileDevice() {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const hasIpParam = urlParams.has("ip");
        console.log("URL参数检查:", {
          hasIpParam,
          ipValue: urlParams.get("ip"),
          fullURL: window.location.href,
        });

        // 有ip参数表示通过二维码扫描访问，为移动端
        // 没有ip参数表示直接在electron app内访问
        return hasIpParam;
      } catch (error) {
        console.error("检查URL参数失败:", error);
        return false; // 出错时默认为electron app内访问
      }
    },

    // 初始化 WebSocket 连接
    async initWebSocket() {
      if (this.ws) {
        this.ws.close();
      }

      // 首先获取IP地址
      await this.getIPAddress();

      this.connectionStatus = "connecting";
      console.log("正在连接 WebSocket...");

      try {
        // 使用获取到的IP地址建立连接
        // 注意：如果StatusServer只监听127.0.0.1，这里应该使用127.0.0.1
        const wsUrl = `ws://${this.currentIP}:4091`;
        console.log("WebSocket连接地址:", wsUrl);
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log("WebSocket 连接成功");
          this.connectionStatus = "connected";
          this.reconnectAttempts = 0;
          this.startHeartbeat();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
          } catch (error) {
            console.error("解析 WebSocket 消息失败:", error);
          }
        };

        this.ws.onclose = () => {
          console.log("WebSocket 连接关闭");
          this.connectionStatus = "disconnected";
          this.stopHeartbeat();
          this.scheduleReconnect();
        };

        this.ws.onerror = (error) => {
          console.error("WebSocket 错误:", error);
          this.connectionStatus = "disconnected";
        };
      } catch (error) {
        console.error("创建 WebSocket 连接失败:", error);
        this.connectionStatus = "disconnected";
        this.scheduleReconnect();
      }
    },

    // 处理 WebSocket 消息
    handleWebSocketMessage(data) {
      console.log("收到消息:", data);

      switch (data.type) {
        case "connection_established":
          console.log("连接建立:", data.message);
          break;

        case "status_update":
          this.handleStatusUpdate(data.status, data.timestamp);
          break;

        case "pong":
          // 心跳响应，不需要特殊处理
          break;

        default:
          console.log("未知消息类型:", data.type);
      }
    },

    // 处理状态更新
    handleStatusUpdate(status, timestamp) {
      console.log("状态更新:", status);

      this.currentStatus = status;

      // 如果是工作结束状态，添加耗时信息
      let displayStatus = status;
      if (status.includes("工作结束") && this.workStartTime) {
        // 计算工作耗时
        const workEndTime = new Date();
        const elapsedMs = workEndTime.getTime() - this.workStartTime.getTime();
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        const duration = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

        displayStatus = `${status} 耗时 ${duration}`;
      }

      // 添加到历史记录
      const historyItem = {
        status: displayStatus,
        timestamp: timestamp || new Date().toISOString(),
        isWorking: status.includes("工作中"),
        isCompleted: status.includes("工作结束"),
      };

      this.statusHistory.unshift(historyItem);
      if (this.statusHistory.length > this.maxHistoryItems) {
        this.statusHistory.splice(this.maxHistoryItems);
      }

      // 更新动画状态
      this.updateWorkingState(status);
    },

    // 更新工作状态动画
    updateWorkingState(status) {
      // 清除之前的定时器
      if (this.statusTransitionTimer) {
        clearTimeout(this.statusTransitionTimer);
      }

      if (status.includes("工作中")) {
        // 开始新工作时重置状态
        this.isWorking = true;
        this.isWorkCompleted = false;
        this.isWorkStatusHidden = false; // 重新显示工作状态窗口
        this.finalWorkDuration = null; // 清除之前的工作时长
        this.startWorkTimer(); // 开始计时

        // 播放工作音乐
        this.playWorkingMusic();
      } else if (status.includes("工作结束")) {
        // 保存最终工作时长
        this.finalWorkDuration = this.workElapsedTime;
        this.stopWorkTimer(); // 停止计时

        // 停止工作音乐并播放完成提示音
        this.stopWorkingMusic();
        this.playCompletionSound();

        // 如果从工作中切换到工作结束，需要流畅过渡
        if (this.isWorking) {
          // 先保持工作动画一小段时间，然后切换
          this.statusTransitionTimer = setTimeout(() => {
            this.isWorking = false;
            this.isWorkCompleted = true;
          }, 500);
        } else {
          this.isWorking = false;
          this.isWorkCompleted = true;
        }
        // 注意：不再自动隐藏，用户需要手动关闭
      } else {
        this.isWorking = false;
        this.isWorkCompleted = false;
        this.stopWorkTimer(); // 停止计时

        // 停止工作音乐
        this.stopWorkingMusic();
      }
    },

    // 开始工作计时器
    startWorkTimer() {
      this.workStartTime = new Date();
      this.updateWorkElapsedTime();

      // 清除之前的计时器
      if (this.workTimer) {
        clearInterval(this.workTimer);
      }

      // 根据设备类型设置更新频率：移动端3秒，桌面端2秒（性能优化）
      const updateInterval = this.isMobile ? 3000 : 2000;
      this.workTimer = setInterval(() => {
        this.updateWorkElapsedTime();
      }, updateInterval);
    },

    // 停止工作计时器
    stopWorkTimer() {
      if (this.workTimer) {
        clearInterval(this.workTimer);
        this.workTimer = null;
      }
      this.workStartTime = null;
      this.workElapsedTime = "00:00";
    },

    // 更新工作已用时间
    updateWorkElapsedTime() {
      if (!this.workStartTime) {
        this.workElapsedTime = "00:00";
        return;
      }

      const now = new Date();
      const elapsedMs = now.getTime() - this.workStartTime.getTime();
      const elapsedSeconds = Math.floor(elapsedMs / 1000);

      const minutes = Math.floor(elapsedSeconds / 60);
      const seconds = elapsedSeconds % 60;

      this.workElapsedTime = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    },

    // 开始心跳
    startHeartbeat() {
      this.stopHeartbeat();

      // 根据设备类型设置心跳频率：移动端30秒，桌面端15秒（性能优化）
      const heartbeatInterval = this.isMobile ? 30000 : 15000;

      this.heartbeatTimer = setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(
            JSON.stringify({
              type: "ping",
              timestamp: new Date().toISOString(),
            })
          );
        }
      }, heartbeatInterval);
    },

    // 停止心跳
    stopHeartbeat() {
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }
    },

    // 计划重连
    scheduleReconnect() {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.log("达到最大重连次数，停止重连");
        return;
      }

      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
      }

      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // 指数退避，最大30秒
      console.log(`${delay / 1000}秒后尝试重连 (第${this.reconnectAttempts + 1}次)`);

      this.reconnectTimer = setTimeout(() => {
        this.reconnectAttempts++;
        this.initWebSocket();
      }, delay);
    },

    // 格式化时间
    formatTime(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleTimeString();
    },

    // 设置文档标题
    setDocumentTitle() {
      document.title = "Cursor 状态监控";
    },

    // iOS设备全屏优化
    initIOSOptimizations() {
      // 检测是否为iOS设备
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

      if (isIOS) {
        console.log("检测到iOS设备，应用全屏优化");

        // 防止页面在滚动时出现bounce效果
        document.addEventListener(
          "touchmove",
          function (e) {
            if (e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
              e.preventDefault();
            }
          },
          { passive: false }
        );

        // 监听设备方向变化，确保全屏状态
        window.addEventListener("orientationchange", () => {
          setTimeout(() => {
            // 滚动到顶部，确保地址栏隐藏
            window.scrollTo(0, 0);
            // 强制重新计算视口高度
            this.updateViewportHeight();
          }, 500);
        });

        // 监听焦点事件，处理虚拟键盘
        document.addEventListener("focusin", () => {
          // 输入框获得焦点时，延迟调整视口
          setTimeout(() => {
            this.updateViewportHeight();
          }, 300);
        });

        document.addEventListener("focusout", () => {
          // 输入框失去焦点时，恢复视口
          setTimeout(() => {
            window.scrollTo(0, 0);
            this.updateViewportHeight();
          }, 300);
        });

        // 初始化视口高度
        this.updateViewportHeight();

        // 页面加载完成后隐藏地址栏
        setTimeout(() => {
          window.scrollTo(0, 0);
        }, 100);
      }
    },

    // 更新视口高度（iOS全屏支持）
    updateViewportHeight() {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    },

    // 隐藏工作状态窗口
    hideWorkStatus() {
      this.isWorkStatusHidden = true;
      // 清理状态转换定时器
      if (this.statusTransitionTimer) {
        clearTimeout(this.statusTransitionTimer);
        this.statusTransitionTimer = null;
      }
    },

    // 生成二维码
    async generateQRCode() {
      try {
        this.qrCodeDataURL = await QRCode.toDataURL(this.qrCodeURL, {
          width: 200,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        });
        this.qrCodeVisible = true;
        this.positionQRCode();
      } catch (err) {
        console.error("生成二维码失败:", err);
      }
    },

    // 显示二维码
    showQRCode() {
      this.generateQRCode();
    },

    // 隐藏二维码
    hideQRCode() {
      this.qrCodeVisible = false;
      this.qrCodeDataURL = "";
    },

    // 定位二维码弹窗
    positionQRCode() {
      const qrPopup = this.$refs.qrPopup;
      if (qrPopup) {
        const rect = qrPopup.getBoundingClientRect();
        const qrIcon = document.querySelector(".qr-icon");
        if (qrIcon) {
          const qrIconRect = qrIcon.getBoundingClientRect();
          qrPopup.style.left = `${qrIconRect.right + 10}px`; // 在图标右侧显示
          qrPopup.style.top = `${qrIconRect.top + (qrIconRect.height / 2 - rect.height / 2)}px`; // 垂直居中
        }
      }
    },

    // 音乐控制方法
    toggleWorkingMusic() {
      this.musicSettings.workingMusic = !this.musicSettings.workingMusic;
      this.saveMusicSettings();

      // 如果开启了工作音乐，立即播放5秒试听
      if (this.musicSettings.workingMusic) {
        this.playWorkingMusicPreview();
      } else {
        // 如果关闭了工作音乐，停止所有播放
        this.stopWorkingMusic();
        this.stopWorkingMusicPreview();
      }
    },

    toggleCompletionSound() {
      this.musicSettings.completionSound = !this.musicSettings.completionSound;
      this.saveMusicSettings();

      // 如果开启了完成提示音，立即播放一次试听
      if (this.musicSettings.completionSound) {
        this.playCompletionSoundPreview();
      }
    },

    // 播放工作音乐（工作状态触发）
    async playWorkingMusic() {
      // 只有在工作中且开启了工作音乐设置时才播放
      if (this.isWorking && this.musicSettings.workingMusic && this.$refs.workingAudio) {
        // 直接播放，移除音频解锁检查
        this.$refs.workingAudio.volume = 0.7; // 70% 音量
        this.$refs.workingAudio.play().catch((e) => {
          console.error("播放工作音乐失败:", e);
        });
      }
    },

    // 播放工作音乐预览（开关触发，播放5秒）
    async playWorkingMusicPreview() {
      if (this.$refs.workingAudio) {
        try {
          // 清除之前的定时器
          if (this.workingMusicPreviewTimer) {
            clearTimeout(this.workingMusicPreviewTimer);
          }

          this.workingMusicPlaying = true;
          this.$refs.workingAudio.volume = 0.7; // 70% 音量
          this.$refs.workingAudio.currentTime = 0; // 从头开始
          this.$refs.workingAudio.loop = false; // 关闭循环

          await this.$refs.workingAudio.play();

          // 5秒后停止播放
          this.workingMusicPreviewTimer = setTimeout(() => {
            this.stopWorkingMusicPreview();
            this.workingMusicPreviewTimer = null;
          }, 3500);
        } catch (e) {
          console.error("播放工作音乐预览失败:", e);
          this.workingMusicPlaying = false;
        }
      }
    },

    // 停止工作音乐预览
    stopWorkingMusicPreview() {
      if (this.$refs.workingAudio) {
        this.$refs.workingAudio.pause();
        this.$refs.workingAudio.currentTime = 0;
        this.$refs.workingAudio.loop = true; // 恢复循环设置
        this.workingMusicPlaying = false;
      }

      // 清除定时器
      if (this.workingMusicPreviewTimer) {
        clearTimeout(this.workingMusicPreviewTimer);
        this.workingMusicPreviewTimer = null;
      }
    },

    // 停止工作音乐
    stopWorkingMusic() {
      if (this.$refs.workingAudio) {
        this.$refs.workingAudio.pause();
        this.$refs.workingAudio.currentTime = 0; // 重置到开头
        this.workingMusicPlaying = false;
      }
    },

    // 播放完成提示音（工作结束状态触发）
    async playCompletionSound() {
      if (this.musicSettings.completionSound && this.$refs.successAudio) {
        // 直接播放，移除音频解锁检查
        this.$refs.successAudio.volume = 1.0; // 100% 音量
        this.$refs.successAudio.currentTime = 0; // 重置到开头
        this.$refs.successAudio.play().catch((e) => {
          console.error("播放完成提示音失败:", e);
        });
      }
    },

    // 播放完成提示音预览（开关触发，播放完整音频）
    async playCompletionSoundPreview() {
      if (this.$refs.successAudio) {
        try {
          // 如果正在播放，先停止
          if (this.completionSoundPlaying) {
            this.$refs.successAudio.pause();
            this.$refs.successAudio.currentTime = 0;
          }

          this.completionSoundPlaying = true;
          this.$refs.successAudio.volume = 1.0; // 100% 音量
          this.$refs.successAudio.currentTime = 0; // 从头开始

          await this.$refs.successAudio.play();

          // 监听音频播放结束事件
          const handleEnded = () => {
            this.completionSoundPlaying = false;
            this.$refs.successAudio.removeEventListener("ended", handleEnded);
          };

          this.$refs.successAudio.addEventListener("ended", handleEnded);
        } catch (e) {
          console.error("播放完成提示音预览失败:", e);
          this.completionSoundPlaying = false;
        }
      }
    },

    // 保存音乐设置到本地存储
    saveMusicSettings() {
      try {
        // 移动端也会保存设置，但下次进入时会被重置
        localStorage.setItem("cursor-status-music-settings", JSON.stringify(this.musicSettings));
        if (this.isMobile) {
          console.log("移动端设备：音频设置已保存（下次进入时将重置）", this.musicSettings);
        } else {
          console.log("桌面端设备：音频设置已保存", this.musicSettings);
        }
      } catch (error) {
        console.error("保存音乐设置失败:", error);
      }
    },

    // 从本地存储加载音乐设置
    loadMusicSettings() {
      try {
        // 移动端每次进入都重置为关闭状态，不读取localStorage
        if (this.isMobile) {
          this.musicSettings = {
            workingMusic: false,
            completionSound: false,
          };
          console.log("移动端设备：音频设置重置为关闭状态");
          return;
        }

        // 桌面端保留记忆功能
        const saved = localStorage.getItem("cursor-status-music-settings");
        if (saved) {
          this.musicSettings = { ...this.musicSettings, ...JSON.parse(saved) };
          console.log("桌面端设备：从本地存储加载音频设置", this.musicSettings);
        } else {
          // 没有保存的设置时，默认都关闭
          this.musicSettings = {
            workingMusic: false,
            completionSound: false,
          };
          console.log("桌面端设备：默认音频设置（工作音乐和完成提示音都关闭）");
          // 保存默认设置
          this.saveMusicSettings();
        }
      } catch (error) {
        console.error("加载音乐设置失败:", error);
        // 出错时使用默认设置（都关闭）
        this.musicSettings = {
          workingMusic: false,
          completionSound: false,
        };
      }
    },

    // 获取状态文本（不包含耗时）
    getStatusText(fullStatus) {
      const duractionMatch = fullStatus.match(/^(.+?)\s+耗时\s+\d+:\d+$/);
      if (duractionMatch) {
        return duractionMatch[1];
      }
      return fullStatus;
    },

    // 提取耗时信息
    getDuration(fullStatus) {
      const durationMatch = fullStatus.match(/耗时\s+(\d+:\d+)/);
      if (durationMatch) {
        return `耗时 ${durationMatch[1]}`;
      }
      return null;
    },
  },
  mounted() {
    // 设置文档标题
    this.setDocumentTitle();

    // iOS设备全屏优化
    // this.initIOSOptimizations();

    // 检测是否为移动端设备
    this.isMobile = this.isMobileDevice();
    console.log("设备检测结果:", this.isMobile ? "移动端" : "桌面端");

    // 加载音乐设置（传入设备类型）
    this.loadMusicSettings();

    // 初始化 WebSocket 连接
    this.initWebSocket();

    // 监听窗口大小变化，重新定位二维码
    window.addEventListener("resize", this.positionQRCode);

    // 初始化音频元素
    this.$nextTick(async () => {
      // 设置音频元素的初始状态
      if (this.$refs.workingAudio) {
        this.$refs.workingAudio.volume = 0.7;
      }
      if (this.$refs.successAudio) {
        this.$refs.successAudio.volume = 1.0;
      }
    });
  },
  beforeDestroy() {
    // 清理资源
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.statusTransitionTimer) {
      clearTimeout(this.statusTransitionTimer);
    }

    // 清理工作计时器
    this.stopWorkTimer();

    // 清理音乐资源
    this.stopWorkingMusic();
    this.stopWorkingMusicPreview();

    // 清理音频事件监听
    if (this.$refs.successAudio) {
      this.$refs.successAudio.removeEventListener("ended", this.handleCompletionSoundEnded);
    }

    if (this.ws) {
      this.ws.close();
    }

    // 移除事件监听
    window.removeEventListener("resize", this.positionQRCode);
  },
};
</script>

<style lang="less" scoped>
// 颜色变量 - 暗色主题
@primary-color: #5dade2;
@primary-hover: #3498db;
@text-color: #e8e9ea; // 不是纯白的浅色文字
@text-secondary: #b0b3b8;
@background-dark: linear-gradient(45deg, #761111 0%, #4a1f1f 25%, #1a1a1a 50%, #0f0f0f 75%, #000000 100%);
@border-color: #3a3b3c;
@success-color: #42a048;
@warning-color: #faad14;
@error-color: #f56565;
@working-color: #3182ce;
@card-bg: rgba(255, 255, 255, 0.05); // 半透明背景
@blur-bg: rgba(255, 255, 255, 0.1); // 更透明的blur背景

#app {
  background: @background-dark;
  position: relative;
  min-height: 100vh;
  /* iOS全屏支持 */
  min-height: calc(var(--vh, 1vh) * 100);

  /* 防止在iOS设备上出现滚动条和bounce效果 */
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;

  /* iOS Safari全屏时的额外样式 */
  @supports (-webkit-touch-callout: none) {
    /* 填充安全区域 */
    padding-top: constant(safe-area-inset-top);
    padding-top: env(safe-area-inset-top);
    padding-bottom: constant(safe-area-inset-bottom);
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: constant(safe-area-inset-left);
    padding-left: env(safe-area-inset-left);
    padding-right: constant(safe-area-inset-right);
    padding-right: env(safe-area-inset-right);
  }
}

// 顶部三栏布局
.row_top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 15px;
  margin-bottom: 20px;
  position: relative;
  z-index: 99;
  background: #00000057;

  @media (max-width: 768px) {
    .connection-status .status-text,
    .center-title h1 {
      font-size: 1.1em;
    }
    .center-title h1 {
      padding: 5px 0;
    }
  }
}

// 连接状态指示器
.connection-status {
  display: flex;
  align-items: center;
  gap: 8px;
  background: @card-bg;
  padding: 8px 16px;
  border-radius: 20px;
  border: 1px solid @border-color;
  font-size: 14px;
  color: @text-color;
  transition: all 0.3s ease;

  .status-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;

      &.connected {
        background: @success-color;
        animation: pulse 2s infinite;
      }

      &.disconnected {
        background: @error-color;
      }
    }

    .spinner {
      width: 12px;
      height: 12px;
      border: 2px solid @border-color;
      border-top: 2px solid @working-color;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
  }

  &.status-connected {
    border-left: 3px solid @success-color;
  }

  &.status-connecting {
    border-left: 3px solid @warning-color;
  }

  &.status-disconnected {
    border-left: 3px solid @error-color;
  }
}

// 连接状态占位符（保持布局平衡）
.connection-status-placeholder {
  width: 0; // 不占用实际空间，但保持flex布局结构
  height: 0;
}

// 中间标题
.center-title {
  flex: 1;
  text-align: center;

  h1 {
    font-size: 24px;
    color: @text-color;
    margin: 0;
    font-weight: 600;
  }
}

// 右侧二维码容器
.qr-code-container {
  position: relative;

  .qr-icon {
    cursor: pointer;
    color: @primary-color;
    transition: color 0.3s ease;
    padding: 4px 5px 2px;
    border-radius: 4px;
    background: rgb(61, 65, 73);
    border: 1px solid @border-color;

    &:hover {
      color: @primary-hover;
      background: rgba(93, 173, 226, 0.1);
    }
  }

  .qr-code-popup {
    position: fixed;
    top: 80px;
    right: 30px;
    background: @blur-bg;
    backdrop-filter: blur(15px);
    padding: 15px;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    z-index: 1001;
    border: 1px solid @border-color;

    img {
      width: 300px;
      height: 300px;
      border-radius: 8px;
    }
  }
}

// 音乐控制区域
.music-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 0;
  max-width: 400px;
  gap: 10px;

  .music-control-item {
    display: flex;
    align-items: center;
    gap: 6px;
    color: @text-color;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.3s ease;
    padding: 8px 12px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    position: relative;
    white-space: nowrap;

    &:hover {
      color: @primary-color;
      background: rgba(93, 173, 226, 0.1);
      transform: translateY(-2px);
    }

    .control-icon {
      font-size: 18px;
      min-width: 18px;
    }

    .control-label {
      font-weight: 500;
      min-width: 60px;
    }

    .switch {
      position: relative;
      width: 40px;
      height: 20px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      cursor: pointer;
      transition: all 0.3s ease;

      &.active {
        background: @primary-color;
        border-color: @primary-color;
        box-shadow: 0 0 10px rgba(93, 173, 226, 0.5);

        .switch-handle {
          left: 22px; // 移动到右侧
        }
      }

      .switch-handle {
        position: absolute;
        width: 16px;
        height: 16px;
        background: white;
        border-radius: 50%;
        top: 2px;
        left: 2px;
        transition: all 0.3s ease;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }
    }

    // 播放提示样式
    .playing-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      color: @primary-color;
      font-size: 12px;
      font-weight: 500;
      animation: fadeInScale 0.3s ease-out;

      .playing-animation {
        display: flex;
        align-items: center;
        gap: 2px;

        .bar {
          width: 3px;
          height: 12px;
          background: @primary-color;
          border-radius: 1px;
          animation: playIndicator 1.2s infinite ease-in-out;

          &:nth-child(1) {
            animation-delay: -0.32s;
          }
          &:nth-child(2) {
            animation-delay: -0.16s;
          }
          &:nth-child(3) {
            animation-delay: 0s;
          }
        }
      }

      .playing-text {
        white-space: nowrap;
      }
    }
  }
}

// 工作状态容器
.work-status-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;

  // 蒙层样式
  .work-status-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 1;
    cursor: pointer;
    animation: overlayFadeIn 0.3s ease-out;
    transition: all 0.3s ease;

    &:hover {
      background: rgba(0, 0, 0, 0.5);
    }
  }
}

// 工作状态展示
.work-status {
  background: @blur-bg;
  backdrop-filter: blur(20px);
  border-radius: 20px;
  padding: 40px 32px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), 0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  width: 79%;
  max-width: 800px;
  box-sizing: border-box;
  text-align: center;
  transition: all 0.5s ease;
  position: relative;
  z-index: 2;
  overflow: hidden;

  // 背景光效
  &::before {
    content: "";
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle at center, rgba(93, 173, 226, 0.03) 0%, transparent 70%);
    pointer-events: none;
    z-index: -1;
  }

  &.working {
    border: 2px solid @working-color;
    animation: workingGlow 2s ease-in-out infinite alternate;

    &::before {
      background: radial-gradient(circle at center, rgba(49, 130, 206, 0.08) 0%, transparent 70%);
    }
  }

  &.completed {
    border: 2px solid @success-color;
    animation: completedGlow 1s ease-out;

    &::before {
      background: radial-gradient(circle at center, rgba(66, 160, 72, 0.08) 0%, transparent 70%);
    }
  }

  // 关闭按钮样式
  .close-btn {
    position: absolute;
    top: 16px;
    right: 16px;
    background: rgba(255, 255, 255, 0.15);
    color: @text-secondary;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: bold;
    cursor: pointer;
    z-index: 10;
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

    &:hover {
      background: @error-color;
      color: white;
      transform: scale(1.1) rotate(90deg);
      box-shadow: 0 6px 20px rgba(245, 101, 101, 0.4);
      border-color: @error-color;
    }

    &:active {
      transform: scale(0.95) rotate(90deg);
    }
  }

  // 计时器显示区域
  .timer-section {
    width: 100%;
    display: flex;
    justify-content: center;
    margin-bottom: 24px;
  }

  .timer-container {
    display: flex;
    align-items: center;
    gap: 20px;
    background: rgba(0, 0, 0, 0.4);
    padding: 20px 32px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(15px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1);

    .work-timer {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      position: relative;

      &.active {
        .timer-label {
          color: #87ceeb;
        }
        .timer-value {
          color: #ffffff;
          animation: timerPulse 2s ease-in-out infinite alternate;
        }
      }

      &.completed {
        .timer-label {
          color: #90ee90;
        }
        .timer-value {
          color: #ffffff;
          animation: fadeIn 0.5s ease-out;
        }
      }

      .timer-label {
        font-size: 13px;
        color: #b0b3b8;
        font-weight: 600;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        opacity: 0.9;
      }

      .timer-value {
        font-size: 32px;
        font-weight: 800;
        font-family: "Courier New", monospace;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
        letter-spacing: 1px;
        min-width: 80px;
        text-align: center;
        color: #ffffff;
      }
    }
  }

  // 动画和状态区域
  .animation-section {
    width: 100%;
    display: flex;
    justify-content: center;
    margin-bottom: 24px;
  }

  // 工作中动画
  .work-animation {
    position: relative;

    .loading-spinner {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;

      .spinner-circle {
        width: 80px;
        height: 80px;
        border: 6px solid rgba(255, 255, 255, 0.05);
        border-top: 6px solid @working-color;
        border-right: 6px solid rgba(93, 173, 226, 0.7);
        border-bottom: 6px solid rgba(93, 173, 226, 0.3);
        border-radius: 50%;
        animation: spinGlow 1.5s ease-in-out infinite;
        box-shadow: 0 0 30px rgba(49, 130, 206, 0.5), inset 0 0 30px rgba(49, 130, 206, 0.2), 0 0 60px rgba(49, 130, 206, 0.3);
        position: relative;
      }

      // 内层小圆圈
      &::before {
        content: "";
        position: absolute;
        width: 50px;
        height: 50px;
        border: 4px solid transparent;
        border-top: 4px solid rgba(255, 255, 255, 0.8);
        border-right: 4px solid rgba(255, 255, 255, 0.5);
        border-radius: 50%;
        animation: spinCounterGlow 1s linear infinite reverse;
        box-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
      }

      // 外层光环
      &::after {
        content: "";
        position: absolute;
        width: 120px;
        height: 120px;
        border: 2px solid transparent;
        border-top: 2px solid rgba(93, 173, 226, 0.2);
        border-radius: 50%;
        animation: spinSlow 3s linear infinite;
        box-shadow: 0 0 40px rgba(93, 173, 226, 0.1);
      }
    }
  }

  // 工作完成动画
  .work-completed {
    .completed-icon {
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, @success-color 0%, #4ade80 100%);
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: bold;
      animation: bounceIn 0.6s ease-out;
      box-shadow: 0 8px 24px rgba(66, 160, 72, 0.4), 0 4px 12px rgba(66, 160, 72, 0.2), inset 0 2px 0 rgba(255, 255, 255, 0.2);
      border: 2px solid rgba(255, 255, 255, 0.1);
    }
  }

  // 状态内容
  .status-content {
    width: 100%;

    .status-title {
      font-size: 26px;
      font-weight: 700;
      color: @text-color;
      margin-bottom: 16px;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      letter-spacing: 0.5px;
    }

    .status-detail {
      font-size: 32px;
      color: @text-color;
      line-height: 1.4;
      max-width: 600px;
      margin: 0 auto;
      font-weight: 700;
      text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5), 0 4px 20px rgba(93, 173, 226, 0.3);
      letter-spacing: 0.5px;
      animation: textGlow 2s ease-in-out infinite alternate;
    }
  }
}

.main-container {
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  text-align: center;
  margin-bottom: 40px;

  h1 {
    font-size: 32px;
    color: @text-color;
    margin-bottom: 10px;
    font-weight: 600;
  }

  p {
    font-size: 16px;
    color: @text-secondary;
  }
}

.content {
  padding: 20px;
}

// 状态历史
.status-history {
  h3 {
    font-size: 18px;
    color: @text-color;
    margin: 0 0 20px;
    font-weight: 600;
  }

  .history-list {
    max-height: calc(100vh - 210px);
    overflow-y: auto;

    .history-item {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 8px;
      background: rgba(255, 255, 255, 0.03);
      border-left: 3px solid @border-color;
      border: 1px solid rgba(255, 255, 255, 0.05);
      transition: all 0.3s ease;

      &.working {
        border-left-color: @working-color;
        background: rgba(49, 130, 206, 0.1);
      }

      &.completed {
        border-left-color: @success-color;
        background: rgba(66, 160, 72, 0.1);
      }

      .history-time {
        color: @text-secondary;
        min-width: 80px;
        margin-right: 16px;
      }

      .history-status {
        color: @text-color;
        flex: 1;
        display: flex;
        align-items: center;
        gap: 8px;

        .status-text {
          flex: 1;
        }

        .duration-highlight {
          background: #7e9bc9;
          color: white;
          padding: 10px 8px;
          border-radius: 8px;
          font-size: 14px;
          box-shadow: 0 2px 8px rgba(66, 160, 72, 0.3);
          white-space: nowrap;
        }
      }
    }
  }

  .no-history {
    text-align: center;
    color: @text-secondary;
    font-size: 14px;
    padding: 40px;
  }
}

// 动画定义
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes spinGlow {
  0% {
    transform: rotate(0deg);
    box-shadow: 0 0 30px rgba(49, 130, 206, 0.5), inset 0 0 30px rgba(49, 130, 206, 0.2), 0 0 60px rgba(49, 130, 206, 0.3);
  }
  50% {
    box-shadow: 0 0 50px rgba(49, 130, 206, 0.8), inset 0 0 40px rgba(49, 130, 206, 0.4), 0 0 80px rgba(49, 130, 206, 0.5);
  }
  100% {
    transform: rotate(360deg);
    box-shadow: 0 0 30px rgba(49, 130, 206, 0.5), inset 0 0 30px rgba(49, 130, 206, 0.2), 0 0 60px rgba(49, 130, 206, 0.3);
  }
}

@keyframes spinCounterGlow {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(-360deg);
  }
}

@keyframes spinSlow {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes textGlow {
  0% {
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5), 0 4px 20px rgba(93, 173, 226, 0.3);
  }
  100% {
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5), 0 4px 20px rgba(93, 173, 226, 0.6), 0 6px 30px rgba(93, 173, 226, 0.4);
  }
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(82, 196, 26, 0.7);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(82, 196, 26, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(82, 196, 26, 0);
  }
}

@keyframes workingGlow {
  0% {
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 0 rgba(49, 130, 206, 0.3);
  }
  100% {
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px 0 rgba(49, 130, 206, 0.6);
  }
}

@keyframes completedGlow {
  0% {
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }
  50% {
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 30px 0 rgba(66, 160, 72, 0.8);
  }
  100% {
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }
}

@keyframes bounceIn {
  0% {
    transform: scale(0.3);
    opacity: 0;
  }
  50% {
    transform: scale(1.05);
  }
  70% {
    transform: scale(0.9);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes timerPulse {
  0% {
    opacity: 0.9;
    transform: scale(1);
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  }
  100% {
    opacity: 1;
    transform: scale(1.05);
    text-shadow: 0 4px 16px rgba(135, 206, 235, 0.6), 0 2px 8px rgba(0, 0, 0, 0.5);
  }
}

@keyframes fadeIn {
  0% {
    opacity: 0;
    transform: scale(0.9);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes overlayFadeIn {
  0% {
    opacity: 0;
    backdrop-filter: blur(0px);
    -webkit-backdrop-filter: blur(0px);
  }
  100% {
    opacity: 1;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
}

@keyframes playIndicator {
  0%,
  80%,
  100% {
    transform: translateY(0) scaleY(0.4);
    opacity: 0.7;
  }
  40% {
    transform: translateY(-2px) scaleY(1);
    opacity: 1;
  }
}

@keyframes fadeInScale {
  0% {
    opacity: 0;
    transform: scale(0.8);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>

<style lang="less">
body,
html {
  width: 100%;
  height: 100%;
  padding: 0;
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans",
    "Helvetica Neue", sans-serif;

  /* iOS优化 */
  overflow-x: hidden;
  -webkit-text-size-adjust: 100%;
  -webkit-tap-highlight-color: transparent;

  /* 支持iOS全屏 */
  height: 100vh;
  height: calc(var(--vh, 1vh) * 100);
}

/* iOS Safari全屏模式下隐藏默认UI */
@media screen and (display-mode: fullscreen) {
  body {
    background: #000;
  }
}

/* iOS Web App模式下的样式优化 */
@media all and (display-mode: standalone) {
  body {
    background: #000;
    /* 防止下拉刷新 */
    overscroll-behavior: none;
  }
}
</style>
