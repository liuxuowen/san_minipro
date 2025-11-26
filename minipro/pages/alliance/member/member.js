const app = getApp()

Page({
  data: {
    name: '',
    history: [],
    count: 0
  },

  onLoad(options) {
    const name = options.name;
    if (name) {
      this.setData({ name });
      this.fetchHistory(name);
    }
  },

  goBackOne() {
    wx.navigateBack({ delta: 1 });
  },

  goBackTwo() {
    wx.navigateBack({ delta: 2 });
  },

  fetchHistory(name) {
    wx.showLoading({ title: '加载中...' });
    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/alliance/member/history`,
      data: { name },
      success: (res) => {
        wx.hideLoading();
        if (res.data.success) {
          this.setData({
            history: res.data.history,
            count: res.data.count
          });
          // Delay drawing to ensure canvas node is ready
          setTimeout(() => {
             this.initChart(res.data.history);
          }, 100);
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

  initChart(data) {
    if (!data || data.length === 0) return;

    const query = wx.createSelectorQuery();
    query.select('#trendChart')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0]) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');

        const dpr = wx.getSystemInfoSync().pixelRatio;
        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);

        this.chart = {
          canvas,
          ctx,
          width: res[0].width,
          height: res[0].height,
          data: data,
          padding: { top: 40, right: 40, bottom: 30, left: 50 }
        };

        this.renderChart(-1);
      });
  },

  renderChart(activeIndex) {
    if (!this.chart) return;
    const { ctx, width, height, data, padding } = this.chart;
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Extract data
    const battles = data.map(d => d.battle);
    const powers = data.map(d => d.power);
    const dates = data.map(d => d.display_time.split(' ')[0].slice(5)); // MM-DD

    // Scales
    const rawMaxBattle = Math.max(...battles) || 100;
    const maxBattle = rawMaxBattle * 1.2;
    const minBattle = 0;

    const rawMaxPower = Math.max(...powers) || 100;
    const maxPower = rawMaxPower * 1.2;
    const minPower = 0;

    const getYBattle = (val) => {
        const range = maxBattle - minBattle || 1;
        return padding.top + chartHeight - ((val - minBattle) / range) * chartHeight;
    };
    const getYPower = (val) => {
        const range = maxPower - minPower || 1;
        return padding.top + chartHeight - ((val - minPower) / range) * chartHeight;
    };
    const getX = (index) => {
        return padding.left + (index / (data.length - 1 || 1)) * chartWidth;
    };

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Draw Grid
    ctx.beginPath();
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    // Horizontal grid lines (5 lines)
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartHeight * i) / 4;
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
    }
    ctx.stroke();

    // Draw Axes
    ctx.beginPath();
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    // X Axis
    ctx.moveTo(padding.left, padding.top + chartHeight);
    ctx.lineTo(width - padding.right, padding.top + chartHeight);
    // Y Axis Left (Battle)
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    // Y Axis Right (Power)
    ctx.moveTo(width - padding.right, padding.top);
    ctx.lineTo(width - padding.right, padding.top + chartHeight);
    ctx.stroke();

    // Draw Y-Axis Labels
    ctx.font = '10px sans-serif';
    
    // Left Axis (Battle)
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e74c3c'; 
    for (let i = 0; i <= 4; i++) {
        const ratio = i / 4; 
        const val = maxBattle - (maxBattle - minBattle) * ratio;
        const y = padding.top + (chartHeight * i) / 4;
        ctx.fillText(Math.floor(val), padding.left - 5, y + 3);
    }

    // Right Axis (Power)
    ctx.textAlign = 'left';
    ctx.fillStyle = '#3498db'; 
    for (let i = 0; i <= 4; i++) {
        const ratio = i / 4;
        const val = maxPower - (maxPower - minPower) * ratio;
        const y = padding.top + (chartHeight * i) / 4;
        ctx.fillText(Math.floor(val), width - padding.right + 5, y + 3);
    }

    // Draw Lines
    const drawLine = (values, getY, color) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        values.forEach((v, i) => {
            const x = getX(i);
            const y = getY(v);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Draw Points
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        values.forEach((v, i) => {
            const x = getX(i);
            const y = getY(v);
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
        });
    };

    drawLine(battles, getYBattle, '#e74c3c');
    drawLine(powers, getYPower, '#3498db');

    // Draw Labels
    ctx.fillStyle = '#999';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    
    // X Labels (First and Last)
    if (dates.length > 0) {
         ctx.fillText(dates[0], padding.left, height - 10);
         ctx.fillText(dates[dates.length - 1], width - padding.right, height - 10);
    }
    
    // Interactive Tooltip
    if (activeIndex >= 0 && activeIndex < data.length) {
        const x = getX(activeIndex);
        const item = data[activeIndex];
        
        // Vertical Line
        ctx.beginPath();
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + chartHeight);
        ctx.stroke();
        ctx.setLineDash([]);

        // Tooltip Box
        const boxWidth = 120;
        const boxHeight = 60;
        let boxX = x - boxWidth / 2;
        let boxY = padding.top + 10;

        // Boundary checks
        if (boxX < 10) boxX = 10;
        if (boxX + boxWidth > width - 10) boxX = width - boxWidth - 10;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

        // Tooltip Text
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.font = '10px sans-serif';
        ctx.fillText(item.display_time.split(' ')[0], boxX + 10, boxY + 15);
        ctx.fillStyle = '#ffcccc';
        ctx.fillText(`战功: ${item.battle}`, boxX + 10, boxY + 30);
        ctx.fillStyle = '#ccccff';
        ctx.fillText(`势力: ${item.power}`, boxX + 10, boxY + 45);
    }
  },

  handleTouch(e) {
    if (!this.chart) return;
    const { width, padding, data } = this.chart;
    const chartWidth = width - padding.left - padding.right;
    const x = e.touches[0].x;
    
    // Calculate index
    // x = padding.left + (index / (len-1)) * chartWidth
    // index = (x - padding.left) / chartWidth * (len-1)
    
    if (x < padding.left || x > width - padding.right) return;

    let index = Math.round(((x - padding.left) / chartWidth) * (data.length - 1));
    index = Math.max(0, Math.min(index, data.length - 1));

    this.renderChart(index);
  },

  handleTouchEnd() {
    // Optional: Clear tooltip on end
    // this.renderChart(-1);
  }
})