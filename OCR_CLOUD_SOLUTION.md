# 云端OCR解决方案

## 当前问题
- 微信小程序serviceMarket OCR依然报错（即使完成备案）
- Paddle.js前端OCR方案不可行（项目停止维护、模型体积大、性能差）

---

## 推荐方案：后端OCR服务

### 优势
✅ 不受小程序限制，稳定可靠  
✅ 识别速度快（1-2秒）  
✅ 准确率高  
✅ 无需下载大模型  
✅ 成本可控（免费额度充足）

---

## 方案对比

| 服务商 | 免费额度 | 通用文字识别 | 价格 | 准确率 |
|--------|---------|------------|------|--------|
| **百度AI** | 1000次/天 | ✅ 高精度 | ¥0.002/次 | 95%+ |
| **腾讯云** | 1000次/月 | ✅ 通用印刷体 | ¥0.15/千次 | 93%+ |
| **阿里云** | 500次/月 | ✅ 通用识别 | ¥0.0005/次 | 94%+ |

**推荐：百度AI OCR**（每天1000次免费，对于小程序足够用）

---

## 实现步骤

### 1️⃣ 申请百度AI OCR服务

1. 访问 [百度AI开放平台](https://ai.baidu.com/)
2. 注册/登录账号
3. 进入控制台 → 文字识别
4. 创建应用，获取 **API Key** 和 **Secret Key**

### 2️⃣ 后端实现 (Flask)

#### 安装依赖
```bash
pip install baidu-aip
```

#### 创建 OCR 路由
```python
# backend/routes/ocr.py
from flask import Blueprint, request, jsonify
from aip import AipOcr
import base64

ocr_bp = Blueprint('ocr', __name__)

# 百度OCR配置
APP_ID = 'your_app_id'
API_KEY = 'your_api_key'
SECRET_KEY = 'your_secret_key'

client = AipOcr(APP_ID, API_KEY, SECRET_KEY)

@ocr_bp.route('/api/ocr/recognize', methods=['POST'])
def recognize_text():
    """
    通用文字识别接口
    接收base64编码的图片，返回识别文本
    """
    data = request.json
    image_base64 = data.get('image')
    
    if not image_base64:
        return jsonify({'error': '缺少图片数据'}), 400
    
    try:
        # 去除base64前缀（如果有）
        if ',' in image_base64:
            image_base64 = image_base64.split(',')[1]
        
        # base64解码
        image_data = base64.b64decode(image_base64)
        
        # 调用百度OCR通用文字识别（高精度版）
        result = client.accurateBasic(image_data, {
            'detect_direction': 'true',  # 检测图像朝向
            'language_type': 'CHN_ENG',  # 中英文混合
        })
        
        if 'error_code' in result:
            return jsonify({
                'error': result.get('error_msg', '识别失败'),
                'code': result.get('error_code')
            }), 500
        
        # 提取识别文本
        words_result = result.get('words_result', [])
        text_lines = [item['words'] for item in words_result]
        
        return jsonify({
            'success': True,
            'text': text_lines,
            'full_result': result  # 包含位置信息等完整数据
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ocr_bp.route('/api/ocr/profile', methods=['POST'])
def recognize_profile():
    """
    专门用于识别游戏个人资料界面
    包含额外的字段解析逻辑
    """
    data = request.json
    image_base64 = data.get('image')
    
    if not image_base64:
        return jsonify({'error': '缺少图片数据'}), 400
    
    try:
        if ',' in image_base64:
            image_base64 = image_base64.split(',')[1]
        
        image_data = base64.b64decode(image_base64)
        
        # 使用高精度OCR
        result = client.accurateBasic(image_data, {
            'detect_direction': 'true',
            'language_type': 'CHN_ENG',
        })
        
        if 'error_code' in result:
            return jsonify({
                'error': result.get('error_msg', '识别失败'),
                'code': result.get('error_code')
            }), 500
        
        # 提取所有文本
        words_result = result.get('words_result', [])
        text_lines = [item['words'] for item in words_result]
        
        # 合并成一个字符串用于匹配
        full_text = ' '.join(text_lines)
        
        # 解析字段（与前端当前逻辑一致）
        parsed_data = parse_profile_fields(full_text)
        
        return jsonify({
            'success': True,
            'raw_text': text_lines,
            'parsed': parsed_data,
            'full_result': result
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def parse_profile_fields(text):
    """解析游戏资料字段"""
    import re
    
    result = {}
    
    # 角色ID (通常是数字)
    role_id_match = re.search(r'角色ID[:：\s]*(\d+)', text)
    if role_id_match:
        result['roleId'] = role_id_match.group(1)
    
    # 角色名
    role_name_match = re.search(r'角色名[:：\s]*([^\s]+)', text)
    if role_name_match:
        result['roleName'] = role_name_match.group(1)
    
    # 同盟名
    alliance_match = re.search(r'同盟[:：\s]*([^\s]+)', text)
    if alliance_match:
        result['allianceName'] = alliance_match.group(1)
    
    # 区服信息
    server_match = re.search(r'(\d+)区.*?([^\s]+服)', text)
    if server_match:
        result['zone'] = server_match.group(1)
        result['serverInfo'] = server_match.group(2)
    
    # 队伍名
    team_match = re.search(r'队伍[:：\s]*([^\s]+)', text)
    if team_match:
        result['teamName'] = team_match.group(1)
    
    return result
```

#### 注册路由
```python
# backend/app.py
from routes.ocr import ocr_bp

app.register_blueprint(ocr_bp)
```

---

### 3️⃣ 前端调用 (小程序)

#### 修改 profile.js
```javascript
// minipro/pages/profile/profile.js

scanProfile() {
  wx.chooseMedia({
    count: 1,
    mediaType: ['image'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      const tempFilePath = res.tempFiles[0].tempFilePath;
      console.log('[Profile OCR] Selected image:', tempFilePath);
      wx.showLoading({ title: '识别中...' });
      
      // 读取图片为base64
      const fs = wx.getFileSystemManager();
      fs.readFile({
        filePath: tempFilePath,
        encoding: 'base64',
        success: (readRes) => {
          const base64Data = readRes.data;
          
          // 调用后端OCR接口
          wx.request({
            url: app.globalData.apiBaseUrl + '/api/ocr/profile',
            method: 'POST',
            data: {
              image: base64Data
            },
            success: (ocrRes) => {
              wx.hideLoading();
              console.log('[Backend OCR] Response:', ocrRes.data);
              
              if (ocrRes.data.success && ocrRes.data.parsed) {
                // 使用解析后的数据更新界面
                const parsed = ocrRes.data.parsed;
                
                this.setData({
                  'userInfo.roleId': parsed.roleId || this.data.userInfo.roleId,
                  'userInfo.roleName': parsed.roleName || this.data.userInfo.roleName,
                  'userInfo.allianceName': parsed.allianceName || this.data.userInfo.allianceName,
                  'userInfo.zone': parsed.zone || this.data.userInfo.zone,
                  'userInfo.serverInfo': parsed.serverInfo || this.data.userInfo.serverInfo,
                  'userInfo.teamName': parsed.teamName || this.data.userInfo.teamName
                });
                
                // 高亮显示识别的字段
                const highlightFields = {};
                Object.keys(parsed).forEach(key => {
                  if (parsed[key]) highlightFields[key] = true;
                });
                this.setData({ highlightFields });
                
                wx.showToast({ 
                  title: '识别成功！', 
                  icon: 'success',
                  duration: 2000
                });
              } else {
                wx.showToast({ 
                  title: '识别失败，请重试', 
                  icon: 'none' 
                });
              }
            },
            fail: (err) => {
              wx.hideLoading();
              console.error('[Backend OCR] Request failed:', err);
              wx.showModal({
                title: '网络错误',
                content: '无法连接服务器，请检查网络',
                showCancel: false
              });
            }
          });
        },
        fail: (readErr) => {
          wx.hideLoading();
          console.error('[Profile OCR] Read file failed:', readErr);
          wx.showToast({ title: '读取文件失败', icon: 'none' });
        }
      });
    }
  });
},
```

#### 同样修改 battle.js
```javascript
// minipro/pages/battle/battle.js

processImage(filePath, label) {
  return new Promise((resolve, reject) => {
    const fs = wx.getFileSystemManager();
    fs.readFile({
      filePath: filePath,
      encoding: 'base64',
      success: (res) => {
        // 调用后端OCR接口
        wx.request({
          url: app.globalData.apiBaseUrl + '/api/ocr/recognize',
          method: 'POST',
          data: {
            image: res.data
          },
          success: (ocrRes) => {
            if (ocrRes.data.success && ocrRes.data.text) {
              const fullText = ocrRes.data.text.join(' ');
              console.log(`[Battle OCR] ${label} recognized:`, fullText);
              
              // 提取数字（与现有逻辑一致）
              const numbers = fullText.match(/\d+/g);
              if (numbers && numbers.length > 0) {
                resolve(parseInt(numbers[0]));
              } else {
                reject(new Error('未找到数字'));
              }
            } else {
              reject(new Error('识别失败'));
            }
          },
          fail: (err) => {
            console.error(`[Battle OCR] ${label} request failed:`, err);
            reject(err);
          }
        });
      },
      fail: (readErr) => {
        console.error(`[Battle OCR] Read ${label} failed:`, readErr);
        reject(readErr);
      }
    });
  });
}
```

---

### 4️⃣ 部署后端

```bash
# 安装依赖
pip install baidu-aip

# 重启服务
systemctl restart san_backend
```

---

## 配置说明

### 百度OCR API参数

```python
# 通用文字识别（标准版）- 免费1000次/天
client.basicGeneral(image)

# 通用文字识别（高精度版）- 免费50次/天，准确率更高
client.accurateBasic(image)

# 可选参数
options = {
    'detect_direction': 'true',      # 检测图像朝向，并矫正
    'detect_language': 'true',       # 检测语种
    'language_type': 'CHN_ENG',      # 识别语言类型：中英文混合
    'probability': 'true'            # 返回识别结果置信度
}
```

### 错误码处理

| 错误码 | 含义 | 处理方式 |
|--------|------|---------|
| 17 | 每天流量超限 | 提示用户明天再试 |
| 18 | QPS超限 | 延迟重试 |
| 216015 | 模块关闭 | 检查控制台是否开通服务 |
| 216100 | 非法参数 | 检查图片格式 |
| 216200 | 空的图片 | 提示用户重新选择 |

---

## 成本估算

假设小程序日活100人，每人每天识别2次：

**百度AI OCR：**
- 免费额度：1000次/天
- 实际使用：200次/天
- 成本：¥0/天 ✅

**如果超出免费额度：**
- 高精度版：¥0.002/次
- 200次/天 × ¥0.002 = ¥0.4/天 ≈ ¥12/月

---

## 优势总结

1. **立即可用**：无需等待小程序备案审核
2. **稳定可靠**：不依赖微信官方API的变更
3. **性能优秀**：1-2秒内返回结果
4. **准确率高**：百度OCR在中文识别领域领先
5. **成本可控**：免费额度足够使用
6. **易于维护**：后端统一管理，方便调试

---

## 测试方案

完成代码修改后，在开发环境测试：

```bash
# 1. 本地测试后端OCR接口
curl -X POST http://localhost:5000/api/ocr/recognize \
  -H "Content-Type: application/json" \
  -d '{"image": "base64_encoded_image_data"}'

# 2. 小程序测试
# - 开发工具：不校验合法域名
# - 真机调试：添加服务器域名到小程序管理后台
```

---

## 下一步行动

1. ✅ 注册百度AI账号，获取API密钥
2. ✅ 在后端添加OCR路由
3. ✅ 修改小程序前端调用逻辑
4. ✅ 部署并测试
5. ✅ 监控每日调用量，优化使用策略

---

## 备用方案

如果百度OCR也遇到问题，可以尝试：

### 腾讯云OCR
```python
from tencentcloud.common import credential
from tencentcloud.ocr.v20181119 import ocr_client, models

cred = credential.Credential("SecretId", "SecretKey")
client = ocr_client.OcrClient(cred, "ap-guangzhou")

req = models.GeneralBasicOCRRequest()
req.ImageBase64 = image_base64
resp = client.GeneralBasicOCR(req)
```

### 阿里云OCR
```python
from aliyunsdkcore.client import AcsClient
from aliyunsdkocr_api.request.v20210707 import RecognizeGeneralRequest

client = AcsClient('AccessKeyId', 'AccessKeySecret', 'cn-shanghai')
request = RecognizeGeneralRequest.RecognizeGeneralRequest()
request.set_body(image_base64)
response = client.do_action_with_exception(request)
```

---

**结论：后端OCR是最稳定、最高效的解决方案！** 🎉
