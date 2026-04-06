# 📦 Clash Verge Static Override Rules Template

> 用于补充 JS 覆盖脚本的业务分流规则
> 适用于：EXE 分流 / Tmp 分流 / SecUS🟩 强约束 / 本地直连

---

## 📖 Overview

本模板用于：

- 为 `Tmp` 提供**实际流量入口**
- 为 `SecUS🟩` 提供**补充分流**
- 提供 **进程级（EXE）控制能力**
- 避免污染主链路 `Proxies`

与当前脚本的职责划分：

| 组件         | 职责                              |
| ------------ | --------------------------------- |
| JS 覆盖脚本  | 构建策略组 / DNS / TUN / 分组结构 |
| 静态覆写规则 | 控制“哪些流量进入哪个策略组”      |

补充：

- `LOW` 由脚本自动生成，自动收集名称中包含 `实验性` 的节点
- `Proxies` 会包含 `LOW` 作为额外候选链路

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

### 2. SecUS🟩 是“强约束链路”

特点：

- 用于 AI / 风控 / 干净出口
- DNS + Proxy 一致（脚本已保证）

默认建议只用于：

- Claude 补充域
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
- PROCESS-NAME,cursor.exe,SecUS🟩
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

  # SecUS🟩
  - DOMAIN-SUFFIX,openrouter.ai,SecUS🟩

  # DIRECT
  - DOMAIN-SUFFIX,lan,DIRECT
  - IP-CIDR,192.168.0.0/16,DIRECT,no-resolve
```

---

## ⚠️ Caveats

### 1. 不要和脚本内置规则冲突

你的脚本已包含：

- OpenAI / Claude / ClaudeReject / Gemini / Microsoft / PayPal / Twitter / Google rule-set
- Claude DNS 强制走 SecUS🟩
- ClaudeReject 会在 Claude 之前优先命中 `REJECT`

其中：

- `OpenAI` / `Gemini` / `Microsoft` / `PayPal` / `Twitter` / `Google` 服务组默认首选 `US`
- 候选顺序为：`US -> Proxies -> 其他地区 -> LOW -> REJECT`
- 内部 `rule-provider` 名与服务组名已解耦，例如 `RULE-SET,googleRuleSet,Google`
- 脚本已内置 `cnDomainRuleSet` / `cnIpRuleSet -> DIRECT`，用于让常见国内站点优先直连，不再轻易落到 `Final`

👉 不建议重复写：

```yaml
- DOMAIN-SUFFIX,anthropic.com,SecUS🟩 # ❌ Claude 相关已内置
- DOMAIN-SUFFIX,qq.com,DIRECT         # ❌ 常见国内站点优先由 cn rule-set 兜底
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

### 4. 宽匹配与单域规则请放在模板侧

像下面这类规则：

```yaml
- DOMAIN-SUFFIX,ai,Proxies
- DOMAIN-SUFFIX,io,Proxies
- DOMAIN-KEYWORD,cursor,Proxies
- DOMAIN-SUFFIX,steampowered.com,Proxies
```

不再建议由 JS 脚本内置注入，而应放在 `override.template.yaml` 的高级规则区按需启用。

---

## ✅ Best Practice（推荐架构）

```text
[静态规则] → Tmp / SecUS🟩 / DIRECT / (可选) Proxies / Final
         ↓
[JS 脚本] → Proxies / SecUS🟩 / DNS / TUN / 分组
```

即：

- **脚本控制结构**
- **规则控制流量入口**
- `Proxies` / `Final` 可在高级场景下由静态模板直接引用
