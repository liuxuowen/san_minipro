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
      title = '同盟战功值对比';
      metric = 'battle';
    } else if (type === 'power') {
      title = '同盟势力值对比';
      metric = 'power';
    } else if (type === 'assist') {
      title = '同盟攻城值对比';
      metric = 'assist';
    } else if (type === 'donation') {
      title = '同盟罚款捐献对比';
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
          const results = res.data.results || [];

          // Calculate counts
          const counts = {};
          results.forEach(r => {
             const g = r.group || '未分组';
             counts[g] = (counts[g] || 0) + 1;
          });
          counts['全盟'] = results.length;

          // Create group objects
          let groupObjs = images.map(img => {
              const name = img.group;
              const count = counts[name] || 0;
              return {
                  value: name,
                  label: `${name} (${count})`,
                  count: count
              };
          });

          // Sort: 全盟 first, 未分组 last, others by count desc
          groupObjs.sort((a, b) => {
              if (a.value === '全盟') return -1;
              if (b.value === '全盟') return 1;
              if (a.value === '未分组') return 1;
              if (b.value === '未分组') return -1;
              return b.count - a.count;
          });
          
          // Find default image (全盟)
          let currentImage = '';
          let currentGroup = '全盟';

          const allImg = images.find(img => img.group === '全盟');
          if (allImg) {
            currentImage = allImg.url;
          } else if (images.length > 0) {
            // If no '全盟', use the first one from sorted list
            currentGroup = groupObjs[0].value;
            const firstImg = images.find(img => img.group === currentGroup);
            currentImage = firstImg ? firstImg.url : '';
          }

          this.setData({
            early_ts: this.formatShichen(res.data.early_ts),
            late_ts: this.formatShichen(res.data.late_ts),
            images: images,
            groups: groupObjs,
            currentGroup: currentGroup,
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

  formatShichen(timeStr) {
    // timeStr format: YYYY-MM-DD HH:MM
    if (!timeStr) return '';
    
    // Parse date manually to avoid timezone issues or browser inconsistencies
    // "2025-11-25 22:12"
    const parts = timeStr.split(' ');
    if (parts.length < 2) return timeStr;
    
    const datePart = parts[0];
    const timePart = parts[1];
    const hour = parseInt(timePart.split(':')[0], 10);
    
    const shichens = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    // 子: 23-1, 丑: 1-3, ...
    // (hour + 1) // 2 % 12
    const index = Math.floor((hour + 1) / 2) % 12;
    const shichen = shichens[index];
    
    return `${datePart} ${shichen}时`;
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