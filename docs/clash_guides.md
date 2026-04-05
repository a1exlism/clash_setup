# 📦 Clash Verge Static Override Rules Template

> 用于补充 JS 覆盖脚本的业务分流规则
> 适用于：EXE 分流 / Tmp 分流 / SecUS 强约束 / 本地直连

---

## 📖 Overview

本模板用于：

- 为 `Tmp` 提供**实际流量入口**
- 为 `🟩SecUS` 提供**补充分流**
- 提供 **进程级（EXE）控制能力**
- 避免污染主链路 `Proxies`

与当前脚本的职责划分：

| 组件         | 职责                              |
| ------------ | --------------------------------- |
| JS 覆盖脚本  | 构建策略组 / DNS / TUN / 分组结构 |
| 静态覆写规则 | 控制“哪些流量进入哪个策略组”      |

---

## 🧩 Template

> rules/clash/override.template.yaml

---

## 🧠 Design Notes

### 1. Tmp 是“流量入口组”，不是自动生效组

你的脚本中：

- `Tmp` 只是一个策略组（节点集合）
- **不会自动命中任何流量**

👉 必须通过规则显式导入：

```yaml
- DOMAIN-SUFFIX,xxx,Tmp
- PROCESS-NAME,xxx.exe,Tmp
```

---

### 2. SecUS 是“强约束链路”

特点：

- 用于 AI / 风控 / 干净出口
- DNS + Proxy 一致（脚本已保证）

建议只用于：

- OpenAI / Claude / Gemini 补充域
- 风控敏感 SaaS
- 需要稳定出口 IP 的业务

---

### 3. PROCESS-NAME 使用策略

| 场景             | 推荐               |
| ---------------- | ------------------ |
| 整个应用走单出口 | ✅ 用 PROCESS-NAME |
| 单个网站分流     | ❌ 用 DOMAIN       |

---

### 4. 规则优先级

Clash 规则是 **自上而下匹配**：

```yaml
# 正确（精确优先）
- PROCESS-NAME,cursor.exe,🟩SecUS
- DOMAIN-SUFFIX,example.com,Tmp

# 错误（宽规则抢先）
- DOMAIN-SUFFIX,com,Tmp
```

---

## 🧪 Recommended Minimal Setup

如果你只想最小可用：

```yaml
profile:
  store-selected: true

rules:
  # Tmp
  - PROCESS-NAME,telegram.exe,Tmp

  # SecUS
  - DOMAIN-SUFFIX,openrouter.ai,🟩SecUS

  # DIRECT
  - DOMAIN-SUFFIX,lan,DIRECT
  - IP-CIDR,192.168.0.0/16,DIRECT,no-resolve
```

---

## ⚠️ Caveats

### 1. 不要和脚本内置规则冲突

你的脚本已包含：

- OpenAI / Claude / Gemini / PayPal rule-set
- AI DNS 强制走 SecUS

👉 不建议重复写：

```yaml
- DOMAIN-SUFFIX,openai.com,🟩SecUS # ❌ 已内置
```

---

### 2. Tmp ≠ 低优先级

Tmp 是：

> “人为指定的特殊出口”

而不是 fallback 或备用链路。

---

### 3. 内网规则建议保留

即使你已经用了：

```yaml
tun.route-exclude-address
```

仍建议保留：

```yaml
- IP-CIDR,192.168.0.0/16,DIRECT
```

原因：

- 防止 fallback / DNS 异常
- 提供规则层兜底

---

## ✅ Best Practice（推荐架构）

```text
[静态规则] → Tmp / SecUS / DIRECT
         ↓
[JS 脚本] → Proxies / DNS / TUN / 分组
```

即：

- **脚本控制结构**
- **规则控制流量入口**
