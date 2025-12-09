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
  onShow() {
    this.loadLocalUserInfo();
  },
  loadLocalUserInfo() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      const currentInfo = this.data.userInfo;
      const newInfo = { ...currentInfo, ...userInfo };
      
      // Fix legacy avatar URL if it contains old IP
      if (newInfo.avatarUrl) {
        newInfo.avatarUrl = this.fixAvatarUrl(newInfo.avatarUrl);
      }

      // Map backend fields to frontend fields if needed
      if (userInfo.alliance_name) newInfo.allianceName = userInfo.alliance_name;
      if (userInfo.role_name) newInfo.roleName = userInfo.role_name;
      if (userInfo.role_id) newInfo.roleId = userInfo.role_id;
      if (userInfo.server_info) newInfo.serverInfo = userInfo.server_info;
      if (userInfo.zone) newInfo.zone = userInfo.zone;
      if (userInfo.team_name) newInfo.teamName = userInfo.team_name;
      
      this.setData({ 
        userInfo: newInfo,
        hasUserInfo: true 
      });
      
      this.syncSeasonIndex();
    }
  },
  fixAvatarUrl(url) {
    if (!url) return url;
    // Replace old IP address with new domain
    return url.replace('http://101.201.106.39:5000', 'https://youlao.xin');
  },
  scanProfile() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        wx.showLoading({ title: '识别中...' });
        
        const fs = wx.getFileSystemManager();
        fs.readFile({
          filePath: tempFilePath,
          encoding: 'base64',
          success: (readRes) => {
            wx.serviceMarket.invokeService({
              service: 'wx79ac3de8be320b71',
              api: 'OcrAllInOne',
              data: {
                img_data: readRes.data,
                data_type: 2,
                ocr_type: 8
              },
              success: (ocrRes) => {
                wx.hideLoading();
                if (ocrRes.errMsg === 'invokeService:ok' && ocrRes.data && ocrRes.data.ocr_comm_res) {
                  this.parseAndSaveProfile(ocrRes.data.ocr_comm_res.items);
                } else {
                  wx.showToast({ title: '识别失败', icon: 'none' });
                }
              },
              fail: (err) => {
                wx.hideLoading();
                console.error(err);
                wx.showToast({ title: '调用OCR失败', icon: 'none' });
              }
            });
          },
          fail: () => {
            wx.hideLoading();
            wx.showToast({ title: '读取文件失败', icon: 'none' });
          }
        });
      }
    });
  },
  parseAndSaveProfile(items) {
    const result = {};
    
    // Combine all text into one string for easier matching if lines are merged
    // Join with spaces to ensure separation
    const fullText = items.map(i => i.text).join(' ');
    console.log('Full OCR Text:', fullText);
    
    // DEBUG: Show all text in modal to help user debug regex
    // const allTextDebug = items.map(i => i.text).join('\n');
    // wx.showModal({
    //     title: 'OCR 调试信息',
    //     content: allTextDebug,
    //     showCancel: false
    // });

    // Updated Regex patterns to handle inline text and spaces in keywords
    // We allow optional spaces between characters for short keywords like "赛 区", "队 伍"
    const patterns = {
      role_name: /角色名称\s*[:：]?\s*([^\s]+)/, 
      role_id: /角色编号\s*[:：]?\s*(\d+)/,      
      server_info: /服\s*务\s*器\s*[:：]?\s*([^\s]+(?:\s+[^\s]+)?)/, // Allow spaces in "服务器"
      zone: /赛\s*区\s*[:：]?\s*([^\s]+)/, // Allow spaces in "赛区"
      team_name: /队\s*伍\s*[:：]?\s*([^\s]+)/ // Allow spaces in "队伍"
    };

    // Try matching against the full text first (for merged lines)
    for (const [key, regex] of Object.entries(patterns)) {
        const match = fullText.match(regex);
        if (match) {
            result[key] = match[1].trim();
        }
    }

    // Fallback: If specific fields are missing, try line-by-line with looser patterns
    // (This handles cases where "Role Name: XXX" is on its own line)
    if (Object.keys(result).length < 5) {
        items.forEach(item => {
            const text = item.text;
            // Simple patterns for line-based matching
            if (!result.role_name && text.includes('角色名称')) {
                const m = text.match(/角色名称\s*[:：]?\s*(.+)/);
                if (m) result.role_name = m[1].split(/\s+/)[0]; // Take first part if multiple
            }
            if (!result.role_id && text.includes('角色编号')) {
                const m = text.match(/角色编号\s*[:：]?\s*(\d+)/);
                if (m) result.role_id = m[1];
            }
            // ... add others if needed
        });
    }

    if (Object.keys(result).length === 0) {
      // Show debug info in modal if nothing found
      const allText = items.map(i => i.text).join('\n');
      wx.showModal({
        title: '未识别到有效信息',
        content: '识别到的原始内容：\n' + allText,
        showCancel: false
      });
      return;
    }

    // Directly save and update UI, no modal confirmation needed as user can edit
    this.saveProfileToServer(result);
  },
  saveProfileToServer(data) {
    const openid = wx.getStorageSync('openid');
    if (!openid) return;

    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/user/ocr_info`,
      method: 'POST',
      data: {
        openid,
        ...data
      },
      success: (res) => {
        if (res.data.success) {
          wx.showToast({ title: '更新成功', icon: 'success' });
          // Update local state
          const updatedInfo = { ...this.data.userInfo };
          if (data.role_name) updatedInfo.roleName = data.role_name;
          if (data.role_id) updatedInfo.roleId = data.role_id;
          if (data.server_info) updatedInfo.serverInfo = data.server_info;
          if (data.zone) updatedInfo.zone = data.zone;
          if (data.team_name) updatedInfo.teamName = data.team_name;
          
          this.setData({ userInfo: updatedInfo });
          this.updateLocalUserInfo(data); // Helper to merge into storage
        } else {
          wx.showToast({ title: '更新失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '网络错误', icon: 'none' });
      }
    });
  },
  updateLocalUserInfo(data) {
    const current = wx.getStorageSync('userInfo') || {};
    const merged = { ...current, ...data };
    wx.setStorageSync('userInfo', merged);
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
  onOcrFieldInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`userInfo.${field}`]: value
    });
  },
  saveOcrInfo() {
    const { roleName, roleId, serverInfo, zone, teamName } = this.data.userInfo;
    // Construct data object with backend keys
    const data = {
        role_name: roleName,
        role_id: roleId,
        server_info: serverInfo,
        zone: zone,
        team_name: teamName
    };
    this.saveProfileToServer(data);
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
