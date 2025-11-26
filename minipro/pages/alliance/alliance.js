const app = getApp()

Page({
  data: {
    uploads: [],
    selectedIds: [],
    canCompare: false,
    allianceName: ''
  },

  onLoad() {
    this.fetchUploads();
    this.loadAllianceName();
  },

  onShow() {
    // 每次显示页面时刷新列表
    this.fetchUploads();
    this.loadAllianceName();
  },

  loadAllianceName() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo.alliance_name) {
      this.setData({ allianceName: userInfo.alliance_name });
    }
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
