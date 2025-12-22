const app = getApp()

Page({
  data: {
    uploads: [],
    selectedIds: [],
    canCompare: false,
    allianceName: '',
    hasAlliance: false,
    allianceId: '',
    isCreator: false,
    showEntry: true  // Show entry screen by default
  },

  onLoad() {
    this.checkAllianceStatus();
  },

  onShow() {
    // 每次显示页面时刷新列表
    this.checkAllianceStatus();
  },

  checkAllianceStatus() {
    const openid = wx.getStorageSync('openid');
    if (!openid) {
      this.setData({ showEntry: true, hasAlliance: false });
      return;
    }

    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/alliance/info`,
      method: 'GET',
      data: { openid },
      success: (res) => {
        if (res.data.success && res.data.has_alliance) {
          const isCreator = res.data.is_creator;
          this.setData({
            allianceName: res.data.alliance_name,
            allianceId: res.data.alliance_id,
            hasAlliance: true,
            isCreator: isCreator,
            showEntry: false  // Hide entry screen
          });
          
          // If user is creator, show management interface
          if (isCreator) {
            this.fetchUploads();
          } else {
            // Non-creator members: show data view with limited permissions
            wx.setNavigationBarTitle({
              title: res.data.alliance_name
            });
            this.fetchUploads();
          }
        } else {
          this.setData({ 
            hasAlliance: false, 
            showEntry: true 
          });
        }
      },
      fail: () => {
        // Network error, fallback to local storage
        const userInfo = wx.getStorageSync('userInfo');
        if (userInfo && userInfo.alliance_name) {
          this.setData({ 
            allianceName: userInfo.alliance_name,
            hasAlliance: true,
            showEntry: false
          });
        } else {
          this.setData({ hasAlliance: false, showEntry: true });
        }
      }
    });
  },

  loadAllianceName() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo.alliance_name) {
      this.setData({ allianceName: userInfo.alliance_name });
    }
  },

  createAlliance() {
    const userInfo = wx.getStorageSync('userInfo');
    
    // Check if user has set zone and server_info
    if (!userInfo || !userInfo.zone || !userInfo.server_info) {
      wx.showModal({
        title: '提示',
        content: '请先前往"个人中心"上传主公基础设置界面，以识别所在服务器和赛区',
        confirmText: '去设置',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/profile/profile' });
          }
        }
      });
      return;
    }

    // Prompt for alliance name
    wx.showModal({
      title: '创建同盟',
      content: '',
      editable: true,
      placeholderText: '请输入同盟名称（最多6个字）',
      success: (res) => {
        if (res.confirm) {
          const allianceName = res.content.trim();
          if (!allianceName) {
            wx.showToast({ title: '请输入同盟名称', icon: 'none' });
            return;
          }
          if (allianceName.length > 6) {
            wx.showToast({ title: '名称最多6个字', icon: 'none' });
            return;
          }

          this.submitCreateAlliance(allianceName);
        }
      }
    });
  },

  submitCreateAlliance(allianceName) {
    const openid = wx.getStorageSync('openid');
    if (!openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '创建中...' });

    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/alliance/create`,
      method: 'POST',
      data: { openid, alliance_name: allianceName },
      success: (res) => {
        wx.hideLoading();
        if (res.data.success) {
          wx.showToast({ title: '创建成功', icon: 'success' });
          
          // Update local storage
          const userInfo = wx.getStorageSync('userInfo') || {};
          userInfo.alliance_name = allianceName;
          wx.setStorageSync('userInfo', userInfo);

          this.setData({ 
            allianceName: allianceName,
            hasAlliance: true,
            allianceId: res.data.alliance_id || '',
            isCreator: true,
            showEntry: false
          });
          this.fetchUploads();
        } else {
          wx.showToast({ title: res.data.error || '创建失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '网络错误', icon: 'none' });
      }
    });
  },

  joinAlliance() {
    const userInfo = wx.getStorageSync('userInfo');
    
    // Check if user has set zone and server_info
    if (!userInfo || !userInfo.zone || !userInfo.server_info) {
      wx.showModal({
        title: '提示',
        content: '请先前往"个人中心"上传主公基础设置界面，以识别所在服务器和赛区',
        confirmText: '去设置',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/profile/profile' });
          }
        }
      });
      return;
    }

    // Prompt for alliance ID
    wx.showModal({
      title: '加入同盟',
      content: '',
      editable: true,
      placeholderText: '请输入同盟ID（10位）',
      success: (res) => {
        if (res.confirm) {
          const allianceId = res.content.trim();
          if (!allianceId) {
            wx.showToast({ title: '请输入同盟ID', icon: 'none' });
            return;
          }
          if (allianceId.length !== 10) {
            wx.showToast({ title: '同盟ID必须为10位', icon: 'none' });
            return;
          }

          this.submitJoinAlliance(allianceId);
        }
      }
    });
  },

  submitJoinAlliance(allianceId) {
    const openid = wx.getStorageSync('openid');
    if (!openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '加入中...' });

    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/alliance/join`,
      method: 'POST',
      data: { openid, alliance_id: allianceId },
      success: (res) => {
        wx.hideLoading();
        if (res.data.success) {
          wx.showToast({ title: '加入成功', icon: 'success' });
          
          // Update local storage
          const userInfo = wx.getStorageSync('userInfo') || {};
          userInfo.alliance_name = res.data.alliance_name;
          wx.setStorageSync('userInfo', userInfo);

          // Update page state for non-creator member
          this.setData({ 
            allianceName: res.data.alliance_name,
            hasAlliance: true,
            allianceId: res.data.alliance_id || '',
            isCreator: false,
            showEntry: false
          });
          
          // Update page title
          wx.setNavigationBarTitle({
            title: res.data.alliance_name
          });
          
          this.fetchUploads();
        } else {
          wx.showToast({ title: res.data.error || '加入失败', icon: 'none', duration: 2500 });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '网络错误', icon: 'none' });
      }
    });
  },

  copyAllianceId() {
    if (!this.data.allianceId) {
      wx.showToast({ title: '同盟ID不存在', icon: 'none' });
      return;
    }

    wx.setClipboardData({
      data: this.data.allianceId,
      success: () => {
        wx.showToast({ title: '已复制到剪贴板', icon: 'success' });
      }
    });
  },

  editAllianceName() {
    const that = this;
    wx.showModal({
      title: '设置联盟名称',
      content: this.data.allianceName || '',
      editable: true,
      placeholderText: '请输入联盟名称（最多6个字）',
      success(res) {
        if (res.confirm) {
          const newName = res.content.trim();
          if (!newName) return;
          if (newName.length > 6) {
            wx.showToast({
              title: '名称最多6个字',
              icon: 'none'
            });
            return;
          }
          
          that.updateAllianceName(newName);
        }
      }
    });
  },

  updateAllianceName(name) {
    const openid = wx.getStorageSync('openid');
    if (!openid) {
      wx.showToast({
        title: '请先在个人中心登录',
        icon: 'none'
      });
      return;
    }

    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/user/alliance`,
      method: 'POST',
      data: {
        openid: openid,
        alliance_name: name
      },
      success: (res) => {
        if (res.data.success) {
          this.setData({ allianceName: name });
          // Update storage
          const userInfo = wx.getStorageSync('userInfo') || {};
          userInfo.alliance_name = name;
          wx.setStorageSync('userInfo', userInfo);
          
          wx.showToast({
            title: '设置成功',
            icon: 'success'
          });
        } else {
          wx.showToast({
            title: res.data.error || '设置失败',
            icon: 'none'
          });
        }
      },
      fail: () => {
        wx.showToast({
          title: '网络错误',
          icon: 'none'
        });
      }
    });
  },

  fetchUploads() {
    const openid = wx.getStorageSync('openid');
    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/alliance/uploads`,
      method: 'GET',
      data: {
        openid: openid
      },
      success: (res) => {
        if (res.data && res.data.uploads) {
          // 保留选中状态
          const uploads = res.data.uploads.map(u => {
            u.selected = this.data.selectedIds.indexOf(u.id) > -1;
            return u;
          });
          this.setData({ uploads });
        }
      },
      fail: (err) => {
        console.error('获取列表失败', err);
      }
    });
  },

  chooseFile() {
    wx.chooseMessageFile({
      count: 9, // 支持多选，最多9个
      type: 'file',
      extension: ['csv'],
      success: (res) => {
        const tempFiles = res.tempFiles;
        if (tempFiles.length > 0) {
          this.uploadFiles(tempFiles);
        }
      }
    });
  },

  uploadFiles(files) {
    if (!files || files.length === 0) return;

    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    let completedCount = 0;
    const total = files.length;

    wx.showLoading({ title: `上传中 1/${total}...` });

    const uploadNext = (index) => {
      if (index >= total) {
        wx.hideLoading();
        let msg = `成功:${successCount}`;
        if (skipCount > 0) msg += ` 跳过:${skipCount}`;
        if (failCount > 0) msg += ` 失败:${failCount}`;
        wx.showToast({ title: msg, icon: 'none', duration: 3000 });
        this.fetchUploads();
        return;
      }

      const file = files[index];
      wx.showLoading({ title: `上传中 ${index + 1}/${total}...` });

      wx.uploadFile({
        url: `${app.globalData.apiBaseUrl}/api/alliance/upload`,
        filePath: file.path,
        name: 'file',
        formData: {
          'filename': file.name,
          'openid': wx.getStorageSync('openid')
        },
        success: (res) => {
          try {
            const data = JSON.parse(res.data);
            if (data.success) {
              if (data.skipped) {
                skipCount++;
              } else {
                successCount++;
              }
            } else {
              failCount++;
              console.error(`File ${file.name} upload failed:`, data.message);
            }
          } catch (e) {
            failCount++;
            console.error(`File ${file.name} parse error:`, e);
          }
        },
        fail: (err) => {
          failCount++;
          console.error(`File ${file.name} network error:`, err);
        },
        complete: () => {
          completedCount++;
          uploadNext(index + 1);
        }
      });
    };

    // 开始上传第一个
    uploadNext(0);
  },

  toggleSelection(e) {
    const id = e.currentTarget.dataset.id;
    let selectedIds = [...this.data.selectedIds];
    const index = selectedIds.indexOf(id);

    if (index > -1) {
      // 取消选中
      selectedIds.splice(index, 1);
    } else {
      // 选中
      if (selectedIds.length >= 2) {
        wx.showToast({ title: '最多选择两个', icon: 'none' });
        return;
      }
      selectedIds.push(id);
    }

    // 更新 uploads 的选中状态
    const uploads = this.data.uploads.map(u => {
      u.selected = selectedIds.indexOf(u.id) > -1;
      return u;
    });

    this.setData({
      selectedIds,
      uploads,
      canCompare: selectedIds.length === 2
    });
  },

  viewDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/alliance/detail/detail?id=${id}`
    });
  },

  deleteUpload(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '提示',
      content: '确认删除该记录？',
      success: (res) => {
        if (res.confirm) {
          wx.request({
            url: `${app.globalData.apiBaseUrl}/api/alliance/delete`,
            method: 'POST',
            data: { upload_id: id },
            success: (res) => {
              if (res.data.success) {
                wx.showToast({ title: '删除成功' });
                // 如果删除的是已选中的，需要从 selectedIds 中移除
                let selectedIds = this.data.selectedIds.filter(sid => sid !== id);
                this.setData({ selectedIds, canCompare: selectedIds.length === 2 });
                this.fetchUploads();
              } else {
                wx.showToast({ title: '删除失败', icon: 'none' });
              }
            }
          });
        }
      }
    });
  },

  onAnalyze(e) {
    if (!this.data.canCompare) return;
    const type = e.currentTarget.dataset.type;
    const ids = this.data.selectedIds;
    
    // 跳转到分析页面，传递 ids 和 type
    wx.navigateTo({
      url: `/pages/alliance/analysis/analysis?type=${type}&ids=${ids.join(',')}`
    });
  }
})
