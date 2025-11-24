const app = getApp()
const defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwBHJrRn51zByDJ9Q6uy9yH5DG5bV4owSEje0fdHuyQ875e5K8tR4o6J8_HDD0dAcECy4g3w3rPwsg/0'

Page({
  data: {
    motto: '欢迎来到个人中心',
    userInfo: {
      avatarUrl: defaultAvatarUrl,
      nickName: '',
    },
    hasUserInfo: false,
    openid: '正在获取...',
    defaultAvatarUrl: defaultAvatarUrl
  },
  onLoad() {
    this.getOpenId();
  },
  getOpenId() {
    wx.login({
      success: res => {
        if (res.code) {
          // 发起网络请求
          wx.request({
            url: 'http://127.0.0.1:5000/api/login', 
            method: 'POST',
            data: {
              code: res.code
            },
            success: (res) => {
              if (res.data.openid) {
                this.setData({
                  openid: res.data.openid
                })
              } else {
                  this.setData({
                      openid: '获取失败: ' + (res.data.error || '未知错误')
                  })
              }
            },
            fail: (err) => {
                console.error('Login failed', err);
                this.setData({
                    openid: '获取失败(请检查后端连接)'
                })
            }
          })
        } else {
          console.log('登录失败！' + res.errMsg)
          this.setData({
              openid: '登录失败'
          })
        }
      }
    })
  },
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail 
    this.setData({
      "userInfo.avatarUrl": avatarUrl,
    })
    this.updateUserInfo({ avatarUrl: avatarUrl })
  },
  onInputChange(e) {
      const nickName = e.detail.value
      if (nickName) {
        this.setData({
            "userInfo.nickName": nickName,
            hasUserInfo: true
        })
        this.updateUserInfo({ nickName: nickName })
      }
  },
  updateUserInfo(data) {
      if (!this.data.openid || this.data.openid.startsWith('获取失败') || this.data.openid === '正在获取...') return;
      
      wx.request({
          url: 'http://127.0.0.1:5000/api/user/update',
          method: 'POST',
          data: {
              openid: this.data.openid,
              ...data
          },
          success: (res) => {
              console.log('User info updated', res.data);
          }
      })
  }
})
