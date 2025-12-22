const app = getApp()

Page({
  data: {
    consecutiveImage: '',
    singleImage: '',
    debugLog: ''
  },

  chooseImage(e) {
    const type = e.currentTarget.dataset.type;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        if (type === 'consecutive') {
          this.setData({ consecutiveImage: tempFilePath });
        } else {
          this.setData({ singleImage: tempFilePath });
        }
      }
    })
  },

  startRecognition() {
    if (!this.data.consecutiveImage || !this.data.singleImage) {
      wx.showToast({ title: '请先上传两张图片', icon: 'none' });
      return;
    }

    this.setData({ debugLog: '开始识别...\n' });
    wx.showLoading({ title: '识别中...' });

    // Process Consecutive Image
    this.processImage(this.data.consecutiveImage, '连串战报')
      .then(() => {
        // Process Single Image
        return this.processImage(this.data.singleImage, '单场战报');
      })
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: '识别完成', icon: 'success' });
      })
      .catch(err => {
        wx.hideLoading();
        console.error(err);
        wx.showToast({ title: '识别出错', icon: 'none' });
        this.appendLog('错误: ' + JSON.stringify(err));
      });
  },

  processImage(filePath, label) {
    return new Promise((resolve, reject) => {
      // 先检查文件大小
      wx.getFileInfo({
        filePath: filePath,
        success: (fileInfo) => {
          const fileSizeMB = (fileInfo.size / 1024 / 1024).toFixed(2);
          console.log(`[${label}] File size:`, fileSizeMB, 'MB');
          
          if (fileInfo.size > 4 * 1024 * 1024) {
            this.appendLog(`\n=== ${label} ===\n错误: 图片过大 (${fileSizeMB}MB)，请压缩后重试\n`);
            reject(new Error('图片过大'));
            return;
          }
          
          // 读取文件为base64
          const fs = wx.getFileSystemManager();
          fs.readFile({
            filePath: filePath,
            encoding: 'base64',
            success: (res) => {
              const base64Data = res.data;
              console.log(`[${label}] Sending to backend OCR...`);
              
              // 调用后端OCR接口
              wx.request({
                url: app.globalData.apiBaseUrl + '/api/ocr/battle',
                method: 'POST',
                data: {
                  image: base64Data,
                  label: label
                },
                success: (ocrRes) => {
                  console.log(`[${label}] Backend OCR response:`, ocrRes.data);
                  
                  if (ocrRes.data.success) {
                    const text = ocrRes.data.raw_text.join('\n');
                    const value = ocrRes.data.value;
                    
                    this.appendLog(`\n=== ${label} ===\n识别文本:\n${text}\n提取数值: ${value}\n`);
                    resolve(value);
                  } else {
                    this.appendLog(`\n=== ${label} ===\n识别失败: ${ocrRes.data.error}\n`);
                    reject(new Error(ocrRes.data.error));
                  }
                },
                fail: (err) => {
                  console.error(`[${label}] Backend request failed:`, err);
                  this.appendLog(`\n=== ${label} ===\n网络错误: ${JSON.stringify(err)}\n`);
                  reject(err);
                }
              });
            },
            fail: (err) => {
              this.appendLog(`\n=== ${label} ===\n读取文件失败: ${JSON.stringify(err)}\n`);
              reject(err);
            }
          });
        },
        fail: (err) => {
          console.error(`[${label}] Get file info failed:`, err);
          this.appendLog(`\n=== ${label} ===\n获取文件信息失败\n`);
          reject(err);
        }
      });
    });
  },

  appendLog(text) {
    this.setData({
      debugLog: this.data.debugLog + text
    });
    console.log(text);
  }
})
