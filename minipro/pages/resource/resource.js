const app = getApp()

Page({
  data: {
    currentTab: 0,
    levels: ['8铜', '9铜', '10铜'],
    levelIndex: 0, // Default 8铜
    
    seasons: [],
    seasonIndex: 0,
    currentSeason: 'S1',

    findX: '',
    findY: '',
    findResults: [],
    allFindResults: [],
    findPage: 0,
    searchedFind: false,
    
    relocateX: '',
    relocateY: '',
    relocateResults: [],
    allRelocateResults: [],
    relocatePage: 0,
    calculating: false,
    
    pageSize: 8
  },

  onLoad() {
    this.fetchSeasons();
    this.loadUserSeason();
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

  loadUserSeason() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo.season) {
      this.setData({ currentSeason: userInfo.season });
      this.syncSeasonIndex();
    }
  },

  syncSeasonIndex() {
    const { seasons, currentSeason } = this.data;
    const index = seasons.indexOf(currentSeason);
    if (index > -1) {
      this.setData({ seasonIndex: index });
    }
  },

  bindSeasonChange(e) {
    const index = e.detail.value;
    const season = this.data.seasons[index];
    this.setData({
      seasonIndex: index,
      currentSeason: season
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
          const userInfo = wx.getStorageSync('userInfo') || {};
          userInfo.season = season;
          wx.setStorageSync('userInfo', userInfo);
        }
      }
    });
  },

  switchTab(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    this.setData({ currentTab: index });
  },

  bindLevelChange(e) {
    this.setData({
      levelIndex: e.detail.value
    })
  },

  findCopper() {
    if (!this.data.findX || !this.data.findY) {
      wx.showToast({ title: '请输入坐标', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '查找中...' });
    
    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/resource/nearest`,
      method: 'POST',
      data: {
        x: this.data.findX,
        y: this.data.findY,
        type: this.data.levels[this.data.levelIndex],
        season: this.data.currentSeason
      },
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode === 200) {
          // Only show top 10 results for Find Copper
          const top10 = res.data.points.slice(0, 10);
          this.setData({
            findResults: top10,
            searchedFind: true
          });
        } else {
          wx.showToast({ title: res.data.error || '查找失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '网络错误', icon: 'none' });
      }
    });
  },

  updateFindDisplay() {
    // Deprecated: Find Copper now shows top 10 directly
  },

  nextBatch() {
    const { currentTab } = this.data;
    if (currentTab === 1) {
      // Relocation
      const { allRelocateResults, relocatePage, pageSize } = this.data;
      const maxPage = Math.ceil(allRelocateResults.length / pageSize) - 1;
      let nextPage = relocatePage + 1;
      if (nextPage > maxPage) nextPage = 0; // Loop back to start
      
      this.setData({ relocatePage: nextPage });
      this.updateRelocateDisplay();
    }
  },

  recommendRelocation() {
    if (!this.data.relocateX || !this.data.relocateY) {
      wx.showToast({ title: '请输入坐标', icon: 'none' });
      return;
    }

    this.setData({ calculating: true, relocateResults: [], allRelocateResults: [] });
    wx.showLoading({ title: '计算中...' });

    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/resource/relocate`,
      method: 'POST',
      data: {
        x: this.data.relocateX,
        y: this.data.relocateY,
        season: this.data.currentSeason
      },
      success: (res) => {
        wx.hideLoading();
        this.setData({ calculating: false });
        
        if (res.statusCode === 200) {
          this.setData({
            allRelocateResults: res.data.top_locations,
            relocatePage: 0
          });
          this.updateRelocateDisplay();
          
          if (res.data.top_locations.length === 0) {
            wx.showToast({ title: '未找到合适的迁城点', icon: 'none' });
          }
        } else {
          wx.showToast({ title: res.data.error || '计算失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        this.setData({ calculating: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
      }
    });
  },

  updateRelocateDisplay() {
    const { allRelocateResults, relocatePage, pageSize } = this.data;
    const start = relocatePage * pageSize;
    const end = start + pageSize;
    const pageData = allRelocateResults.slice(start, end);
    this.setData({ relocateResults: pageData });
  }
})
