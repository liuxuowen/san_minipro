const app = getApp()

Page({
  data: {
    loading: true,
    images: [],
    groups: [],
    currentGroup: '全盟',
    currentImage: '',
    early_ts: '',
    late_ts: '',
    title: '',
    metric: ''
  },

  onLoad(options) {
    const type = options.type;
    const ids = options.ids.split(',');
    
    let title = '数据对比';
    let metric = 'battle';
    
    if (type === 'battle') {
      title = '战功对比';
      metric = 'battle';
    } else if (type === 'power') {
      title = '势力值对比';
      metric = 'power';
    } else if (type === 'contrib') {
      title = '贡献对比';
      metric = 'contribution';
    } else if (type === 'assist') {
      title = '助攻对比';
      metric = 'assist';
    } else if (type === 'donation') {
      title = '捐献对比';
      metric = 'donation';
    }
    
    this.setData({ title, metric });
    this.fetchData(ids[0], ids[1], metric);
  },

  goBack() {
    wx.navigateBack();
  },

  fetchData(id1, id2, metric) {
    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/alliance/compare`,
      method: 'POST',
      data: {
        upload_id_1: id1,
        upload_id_2: id2,
        metric: metric
      },
      success: (res) => {
        if (res.data.success) {
          const images = res.data.images || [];
          // Extract groups from images
          // Ensure '全盟' is first if it exists
          let groups = images.map(img => img.group);
          
          // Find default image (全盟)
          let currentImage = '';
          const allImg = images.find(img => img.group === '全盟');
          if (allImg) {
            currentImage = allImg.url;
          } else if (images.length > 0) {
            currentImage = images[0].url;
            this.setData({ currentGroup: images[0].group });
          }

          this.setData({
            early_ts: res.data.early_ts,
            late_ts: res.data.late_ts,
            images: images,
            groups: groups,
            currentImage: currentImage,
            loading: false
          });
        } else {
          wx.showToast({ title: res.data.message || '分析失败', icon: 'none' });
          this.setData({ loading: false });
        }
      },
      fail: (err) => {
        console.error(err);
        wx.showToast({ title: '网络错误', icon: 'none' });
        this.setData({ loading: false });
      }
    });
  },

  selectGroup(e) {
    const group = e.currentTarget.dataset.group;
    const img = this.data.images.find(i => i.group === group);
    if (img) {
      this.setData({
        currentGroup: group,
        currentImage: img.url
      });
    }
  },

  previewImage() {
    if (this.data.currentImage) {
      wx.previewImage({
        current: this.data.currentImage,
        urls: [this.data.currentImage] // Only preview current one or all? Usually user wants to zoom in current.
      });
    }
  },

  showActionSheet() {
    // Long press action, usually handled by previewImage but we can add custom if needed
    // WeChat's previewImage already supports long press to save/send.
    // So we might not need this unless we want custom actions.
    // But the requirement says "long press can forward/save/favorite".
    // previewImage does this.
  }
})