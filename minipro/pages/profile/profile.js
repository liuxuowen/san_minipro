const app = getApp()
const defaultAvatarUrl = '/static/icons/default.png'

Page({
  data: {
    userInfo: {
      avatarUrl: defaultAvatarUrl,
      nickName: '',
      season: 'S1',
      allianceName: ''
    },
    hasUserInfo: false,
    openid: '正在获取...',
    defaultAvatarUrl: defaultAvatarUrl,
    seasons: [],
    seasonIndex: 0
  },
  onLoad() {
    this.getOpenId();
    this.fetchSeasons();
  },
  fetchSeasons() {
    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/resource/seasons`,
      success: (res) => {
        if (res.data.seasons) {
          this.setData({ seasons: res.data.seasons });
          this.syncSeasonIndex();
        }
      }
    });
  },
  syncSeasonIndex() {
    const { seasons, userInfo } = this.data;
    if (seasons.length > 0 && userInfo.season) {
      const index = seasons.indexOf(userInfo.season);
      if (index > -1) {
        this.setData({ seasonIndex: index });
      }
    }
  },
  bindSeasonChange(e) {
    const index = e.detail.value;
    const season = this.data.seasons[index];
    this.setData({
      seasonIndex: index,
      'userInfo.season': season
    });
    this.updateUserSeason(season);
  },
  updateUserSeason(season) {
    const openid = wx.getStorageSync('openid');
    if (!openid) return;

    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/user/season`,
      method: 'POST',
      data: { openid, season },
      success: (res) => {
        if (res.data.success) {
          this.updateLocalUserInfo({ season });
        }
      }
    });
  },
  onAllianceInput(e) {
    this.setData({
      'userInfo.allianceName': e.detail.value
    });
  },
  saveAlliance() {
    const { allianceName } = this.data.userInfo;
    const openid = wx.getStorageSync('openid');
    
    if (!openid) return;
    if (!allianceName) return;

    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/user/alliance`,
      method: 'POST',
      data: { openid, alliance_name: allianceName },
      success: (res) => {
        if (res.data.success) {
          this.updateLocalUserInfo({ alliance_name: allianceName });
          wx.showToast({ title: '保存成功', icon: 'success' });
        } else {
          wx.showToast({ title: res.data.error || '保存失败', icon: 'none' });
        }
      }
    });
  },
  updateLocalUserInfo(data) {
    const userInfo = wx.getStorageSync('userInfo') || {};
    Object.assign(userInfo, data);
    wx.setStorageSync('userInfo', userInfo);
  },
  getOpenId() {
    wx.login({
      success: res => {
        if (res.code) {
          // 发起网络请求
          wx.request({
            url: app.globalData.apiBaseUrl + '/api/login', 
            method: 'POST',
            data: {
              code: res.code
            },
            success: (res) => {
              if (res.data.openid) {
                const updateData = {
                  openid: res.data.openid
                }
                
                // 保存 openid 到本地存储
                wx.setStorageSync('openid', res.data.openid);

                // 自动加载后端返回的用户信息
                if (res.data.user) {
                    // 保存用户信息到本地存储
                    wx.setStorageSync('userInfo', res.data.user);
                    
                    const { nickname, avatar_url, season, alliance_name } = res.data.user
                    const userInfo = this.data.userInfo
                    
                    if (nickname) {
                        userInfo.nickName = nickname
                        updateData.hasUserInfo = true
                    }
                    if (avatar_url) {
                        userInfo.avatarUrl = avatar_url
                    }
                    if (season) {
                        userInfo.season = season
                    }
                    if (alliance_name) {
                        userInfo.allianceName = alliance_name
                    }
                    updateData.userInfo = userInfo
                    
                    // Sync season index after getting user info
                    setTimeout(() => this.syncSeasonIndex(), 100);
                }

                this.setData(updateData)
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
    
    // 1. 先显示临时图片，提升体验
    this.setData({
      "userInfo.avatarUrl": avatarUrl,
    })

    // 2. 上传图片到服务器
    wx.uploadFile({
        url: app.globalData.apiBaseUrl + '/api/upload',
        filePath: avatarUrl,
        name: 'file',
        success: (res) => {
            const data = JSON.parse(res.data)
            if (data.success) {
                // 3. 上传成功，获取永久 URL
                // 如果后端返回的是相对路径，需要拼接
                let permanentUrl = data.url;
                if (data.path) {
                    permanentUrl = app.globalData.apiBaseUrl + data.path;
                }

                console.log('Avatar uploaded:', permanentUrl);
                
                // 4. 更新本地显示（确保显示的是服务器图片）
                this.setData({
                    "userInfo.avatarUrl": permanentUrl
                })

                // 5. 更新用户资料到数据库
                this.updateUserInfo({ avatarUrl: permanentUrl })
            } else {
                wx.showToast({ title: '头像上传失败', icon: 'none' })
            }
        },
        fail: (err) => {
            console.error('Upload failed', err);
            wx.showToast({ title: '上传出错', icon: 'none' })
        }
    })
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
          url: app.globalData.apiBaseUrl + '/api/user/update',
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
