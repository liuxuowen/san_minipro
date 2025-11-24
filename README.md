# San Minipro Project

## 目录结构
- `minipro/`: 微信小程序前端代码
- `backend/`: Python Flask 后端代码

## 启动说明

### 1. 后端 (Backend)
需要安装 Python 3。

```bash
cd backend
pip install -r requirements.txt
python app.py
```
后端服务将运行在 `http://127.0.0.1:5000`。

**注意**: 请在 `backend/app.py` 中填入你的真实 `APP_ID` 和 `APP_SECRET` 以获取真实的 OpenID。目前代码中包含模拟逻辑，即使没有 AppID 也能看到前端效果。

### 2. 前端 (Frontend)
使用微信开发者工具导入 `minipro` 目录。

- 确保微信开发者工具中，详情 -> 本地设置 -> 勾选 "不校验合法域名、web-view（业务域名）、TLS版本以及HTTPS证书"，以便连接本地后端。

## 功能实现
- **个人中心**: 
  - 自动登录获取 OpenID (需后端配合)。
  - 点击头像区域选择微信头像。
  - 输入框填写昵称。
  - 底部展示 OpenID。
- **其他 Tab**: 已创建占位页面。
