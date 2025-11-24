#!/bin/bash
# 查看 san_backend 服务的实时日志
# -u: 指定服务单元
# -f: 实时跟随 (Follow)
# -n 100: 显示最近 100 行
journalctl -u san_backend -f -n 100
