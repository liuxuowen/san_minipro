App({
  onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)
  },
  globalData: {
    userInfo: null,
    // 本地调试: http://127.0.0.1:5000
    // 远程服务器: http://101.201.106.39:5000
    apiBaseUrl: 'http://101.201.106.39:5000' 
  }
})
