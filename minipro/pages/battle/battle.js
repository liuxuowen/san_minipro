const app = getApp()

Page({
  data: {
    images: [],
    totalMerit: 0,
    isRecognizing: false
  },

  chooseImages() {
    wx.chooseMedia({
      count: 9,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newImages = res.tempFiles.map(file => ({
          tempFilePath: file.tempFilePath,
          createTime: file.createTime,
          status: 'pending',
          result: 0
        }));
        
        this.setData({
          images: [...this.data.images, ...newImages]
        });

        // Automatically start recognition for new images
        if (newImages.length > 0 && !this.data.isRecognizing) {
            this.startRecognition();
        }
      }
    })
  },

  deleteImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.images;
    images.splice(index, 1);
    this.setData({ images });
  },

  previewImage(e) {
    const current = e.currentTarget.dataset.url;
    const urls = this.data.images.map(img => img.tempFilePath);
    wx.previewImage({
      current,
      urls
    });
  },

  startRecognition() {
    const images = this.data.images;
    const pendingImages = images.filter(img => img.status === 'pending' || img.status === 'fail');
    
    if (pendingImages.length === 0) {
      if (images.length === 0) {
        wx.showToast({ title: '请先添加图片', icon: 'none' });
      } else {
        wx.showToast({ title: '所有图片已识别', icon: 'none' });
      }
      return;
    }

    this.setData({ isRecognizing: true });
    this.processNextImage(0);
  },

  processNextImage(index) {
    const images = this.data.images;
    
    // Find next pending image starting from current index
    let nextIndex = -1;
    for (let i = index; i < images.length; i++) {
      if (images[i].status === 'pending' || images[i].status === 'fail') {
        nextIndex = i;
        break;
      }
    }

    if (nextIndex === -1) {
      // All done
      this.setData({ isRecognizing: false });
      wx.showToast({ title: '识别完成', icon: 'success' });
      return;
    }

    // Update status to recognizing
    this.setData({
      [`images[${nextIndex}].status`]: 'uploading'
    });

    // Read file info to get MD5
    const fs = wx.getFileSystemManager();
    fs.getFileInfo({
        filePath: images[nextIndex].tempFilePath,
        success: (fileInfo) => {
            const md5 = fileInfo.digest;
            
            // Read file as base64 for OCR
            fs.readFile({
              filePath: images[nextIndex].tempFilePath,
              encoding: 'base64',
              success: (res) => {
                const base64Data = res.data;
                
                // Call WeChat OCR Service (OcrAllInOne)
                // Service ID: wx79ac3de8be320b71
                wx.serviceMarket.invokeService({
                  service: 'wx79ac3de8be320b71',
                  api: 'OcrAllInOne',
                  data: {
                    img_data: base64Data,
                    data_type: 2,
                    ocr_type: 8 // 8: General OCR (通用OCR)
                  },
                  success: (ocrRes) => {
                    console.log('OCR Result:', ocrRes);
                    if (ocrRes.errMsg === 'invokeService:ok' && ocrRes.data && ocrRes.data.ocr_comm_res) {
                       const items = ocrRes.data.ocr_comm_res.items;
                       let foundNumber = 0;
                       // Regex for "战功 +123" or "战功 123"
                       const regex = /战功\s*[:\+]?\s*(\d+)/;
                       
                       for (let item of items) {
                         const match = item.text.match(regex);
                         if (match) {
                           foundNumber = parseInt(match[1]);
                           break;
                         }
                       }
                       
                       if (foundNumber > 0) {
                         // Upload to server
                         wx.uploadFile({
                            url: `${app.globalData.apiBaseUrl}/api/battle/submit`,
                            filePath: images[nextIndex].tempFilePath,
                            name: 'file',
                            formData: {
                                'merit': foundNumber,
                                'openid': wx.getStorageSync('openid') || '', // Assuming openid is stored
                                'image_create_time': images[nextIndex].createTime || Date.now(), // Best effort
                                'md5': md5
                            },
                            success: (uploadRes) => {
                                try {
                                    const uploadData = JSON.parse(uploadRes.data);
                                    if (uploadData.success) {
                                        this.setData({
                                            [`images[${nextIndex}].status`]: 'success',
                                            [`images[${nextIndex}].result`]: foundNumber
                                        });
                                    } else {
                                        console.error('Upload Failed:', uploadData.error);
                                        if (uploadData.is_duplicate) {
                                            wx.showToast({ title: '重复图片', icon: 'none' });
                                        }
                                        this.setData({ [`images[${nextIndex}].status`]: 'fail' });
                                    }
                                } catch (e) {
                                    console.error('Upload Parse Error:', e);
                                    this.setData({ [`images[${nextIndex}].status`]: 'fail' });
                                }
                            },
                            fail: (err) => {
                                console.error('Upload Network Error:', err);
                                this.setData({ [`images[${nextIndex}].status`]: 'fail' });
                            }
                         });
                       } else {
                         this.setData({
                            [`images[${nextIndex}].status`]: 'fail'
                         });
                       }
                    } else {
                       console.error('OCR Service Error:', ocrRes);
                       this.setData({ [`images[${nextIndex}].status`]: 'fail' });
                    }
                  },
                  fail: (err) => {
                     console.error('OCR Invoke Failed:', err);
                     this.setData({ [`images[${nextIndex}].status`]: 'fail' });
                     wx.showToast({ title: 'OCR调用失败，请检查服务市场配置', icon: 'none' });
                  },
                  complete: () => {
                     this.processNextImage(index + 1);
                  }
                });
              },
              fail: (err) => {
                 console.error('Read File Failed:', err);
                 this.setData({ [`images[${nextIndex}].status`]: 'fail' });
                 this.processNextImage(index + 1);
              }
            });
        },
        fail: (err) => {
            console.error('Get File Info Failed:', err);
            this.setData({ [`images[${nextIndex}].status`]: 'fail' });
            this.processNextImage(index + 1);
        }
    });
  }
})
