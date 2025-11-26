const app = getApp()

Page({
  data: {
    record: null,
    data: []
  },

  onLoad(options) {
    const id = options.id;
    if (id) {
      this.fetchDetail(id);
    }
  },

  fetchDetail(id) {
    wx.showLoading({ title: '加载中...' });
    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/alliance/detail/${id}`,
      method: 'GET',
      success: (res) => {
        wx.hideLoading();
        if (res.data.success) {
          this.setData({
            record: res.data.record,
            data: res.data.data
          });
        } else {
          wx.showToast({ title: '加载失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '网络错误', icon: 'none' });
      }
    });
  }
})