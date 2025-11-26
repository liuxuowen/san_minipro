const app = getApp()

Page({
  data: {
    record: null,
    allData: [],
    displayData: [],
    groups: [],
    currentGroup: '全部分组',
    groupIndex: 0
  },

  onLoad(options) {
    const id = options.id;
    if (id) {
      this.fetchDetail(id);
    }
  },

  goBack() {
    wx.navigateBack();
  },

  fetchDetail(id) {
    wx.showLoading({ title: '加载中...' });
    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/alliance/detail/${id}`,
      method: 'GET',
      success: (res) => {
        wx.hideLoading();
        if (res.data.success) {
          const data = res.data.data;
          
          // Extract groups
          const groupSet = new Set(data.map(item => item.group_name));
          const groups = ['全部分组', ...Array.from(groupSet)];

          this.setData({
            record: res.data.record,
            allData: data,
            displayData: data,
            groups: groups,
            groupIndex: 0,
            currentGroup: '全部分组'
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
  },

  bindGroupChange(e) {
    const index = e.detail.value;
    const group = this.data.groups[index];
    
    let displayData = this.data.allData;
    if (group !== '全部分组') {
      displayData = displayData.filter(item => item.group_name === group);
    }

    this.setData({
      groupIndex: index,
      currentGroup: group,
      displayData: displayData
    });
  },

  viewMember(e) {
    const name = e.currentTarget.dataset.name;
    wx.navigateTo({
      url: `/pages/alliance/member/member?name=${name}`
    });
  }
})