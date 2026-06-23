# 检测设备 driver 代码骨架（fixture-protocol-gen 产出,注入用户工程,如 test/fixture/）

分两层,协议不变则协议层不重生成:

## 协议层（复用）—— 伪代码
- open(port, baud) / close()
- build_frame(cmd, data) -> bytes   # 按用户协议组帧 + 校验
- parse_frame(bytes) -> {cmd, data} # 解帧 + 校验,失败抛错
- transact(cmd, data, timeout, retry) -> resp  # 发送并读应答,带超时/重试

## 测试项处理层（随测试项扩展增量加）—— 伪代码
- registry = { "K1-CLOSE": handler_k1_close, "OUT2-V": handler_out2_v, ... }
- handler_k1_close(): r = transact(<查询K1>); return {item:"K1-CLOSE", observed: r.bit, raw: r}
- handler_out2_v():   r = transact(<测OUT2>); return {item:"OUT2-V", observed: r.mv, raw: r}
- run_item(id): return registry[id]()   # blackbox-feedback 每轮调用,读此刻真值

> 新增测试项 = 往 registry 加一个 handler,复用协议层。语言按 state.detector.lang(C/Python/Node)。
