// 确保某个字段是数组；不存在就初始化为空数组
function ensureArray(obj, key) {
  if (!Array.isArray(obj[key])) obj[key] = [];
  return obj[key];
}

// 确保某个字段是对象；不存在就初始化为空对象
function ensureObject(obj, key) {
  if (!obj[key] || typeof obj[key] !== "object" || Array.isArray(obj[key])) {
    obj[key] = {};
  }
  return obj[key];
}

// 按 name 插入或合并配置项（适用于 proxies / proxy-groups）
function upsertNamed(list, item, merge = false) {
  const index = list.findIndex((x) => x && x.name === item.name);

  // 不存在：直接插入
  if (index === -1) {
    list.push(item);
    return;
  }

  // 已存在且需要合并：保留旧值并补充新值
  if (merge) {
    const old = list[index];
    list[index] = { ...old, ...item };

    // 特殊处理 proxies 数组：去重合并
    if (Array.isArray(old.proxies) || Array.isArray(item.proxies)) {
      list[index].proxies = [
        ...new Set([...(old.proxies || []), ...(item.proxies || [])]),
      ];
    }
  }
}

// 判断某个规则目标是否存在
// 可用于 rules 最后的策略名，如 🟩SECUS / Final / Proxies / DIRECT
function hasPolicy(config, name) {
  return (
    ["PROXY", "PROXIES", "REJECT", "DIRECT"].includes(name) ||
    (config.proxies || []).some((x) => x.name === name) ||
    (config["proxy-groups"] || []).some((x) => x.name === name)
  );
}

// 从候选策略中选第一个存在的；都不存在则使用 fallback
function pickPolicy(config, candidates, fallback = "REJECT") {
  for (const name of candidates) {
    if (hasPolicy(config, name)) return name;
  }
  return fallback;
}

// 添加规则；支持前置/后置；自动去重
function addRule(config, rule, prepend = false) {
  ensureArray(config, "rules");
  if (config.rules.includes(rule)) return;
  prepend ? config.rules.unshift(rule) : config.rules.push(rule);
}

// 插入或更新 rule-providers
function upsertRuleProvider(config, name, value) {
  const providers = ensureObject(config, "rule-providers");
  providers[name] = { ...(providers[name] || {}), ...value };
}

function main(config) {
  // 初始化常用字段，避免后续操作报错
  ensureArray(config, "proxies");
  ensureArray(config, "proxy-groups");
  ensureArray(config, "rules");
  ensureObject(config, "rule-providers");

  // 1. 动态注入代理节点
  upsertNamed(config.proxies, {
    name: "MANUAL_PROXY",
    /**
     * NOTE: 自定义配置节点，如家宽节点
     */
  });

  // 2. 动态注入策略组
  // merge=true 表示如果组已存在，则补充 proxies 成员而不是直接覆盖
  upsertNamed(
    config["proxy-groups"],
    {
      name: "🟩SECUS", //  NOTE: 自定义 proxy group
      type: "select",
      proxies: ["MANUAL_PROXY", "REJECT"], // error when rejection
    },
    true,
  );

  upsertNamed(
    config["proxy-groups"],
    {
      name: "Proxies",
      type: "select",
      proxies: ["MANUAL_PROXY", "REJECT"], // error when rejection
    },
    true,
  );

  upsertNamed(
    config["proxy-groups"],
    {
      name: "US",
      type: "select",
      proxies: ["MANUAL_PROXY", "REJECT"], // error when rejection
    },
    true,
  );

  // 3. 动态注入 rule-providers
  const ruleProviders = {
    Paypal: {
      type: "http",
      behavior: "classical",
      url: "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/refs/heads/master/rule/Clash/PayPal/PayPal.yaml",
      path: "./rules/Paypal.yaml",
      interval: 86400,
    },

    Gemini: {
      type: "http",
      behavior: "classical",
      url: "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Gemini/Gemini.yaml",
      path: "./rules/Gemini.yaml",
      interval: 86400,
    },

    Openai: {
      type: "http",
      behavior: "classical",
      url: "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/OpenAI/OpenAI.yaml",
      path: "./rules/Openai.yaml",
      interval: 86400,
    },

    Claude: {
      type: "http",
      behavior: "classical",
      path: "./rules/Claude.yaml",
      payload: [
        "DOMAIN,cdn.usefathom.com",
        "DOMAIN-SUFFIX,anthropic.com",
        "DOMAIN-SUFFIX,claudeusercontent.com",
        "DOMAIN-SUFFIX,claude.ai",
        "DOMAIN-SUFFIX,intercomcdn.com",
        "DOMAIN-KEYWORD,claude",
        "DOMAIN-KEYWORD,anthropic",
      ],
    },

    Adobe: {
      type: "http",
      behavior: "classical",
      url: "https://raw.githubusercontent.com/autocrusher/clash-rules/refs/heads/main/Adobe.list",
      path: "./rules/Adobe.yaml",
      interval: 86400,
    },

    AD: {
      type: "http",
      behavior: "domain",
      url: "https://raw.githubusercontent.com/earoftoast/clash-rules/main/AD.yaml",
      path: "./rules/AD.yaml",
      interval: 86400,
    },

    EasyList: {
      type: "http",
      behavior: "domain",
      url: "https://raw.githubusercontent.com/earoftoast/clash-rules/main/EasyList.yaml",
      path: "./rules/EasyList.yaml",
      interval: 86400,
    },

    EasyListChina: {
      type: "http",
      behavior: "domain",
      url: "https://raw.githubusercontent.com/earoftoast/clash-rules/main/EasyListChina.yaml",
      path: "./rules/EasyListChina.yaml",
      interval: 86400,
    },

    EasyPrivacy: {
      type: "http",
      behavior: "domain",
      url: "https://raw.githubusercontent.com/earoftoast/clash-rules/main/EasyPrivacy.yaml",
      path: "./rules/EasyPrivacy.yaml",
      interval: 86400,
    },

    ProgramAD: {
      type: "http",
      behavior: "domain",
      url: "https://raw.githubusercontent.com/earoftoast/clash-rules/main/ProgramAD.yaml",
      path: "./rules/ProgramAD.yaml",
      interval: 86400,
    },
  };

  Object.entries(ruleProviders).forEach(([name, value]) => {
    upsertRuleProvider(config, name, value);
  });

  // 4. 根据当前最终配置，动态选择规则目标
  // 存在 🟩SECUS 就用 🟩SECUS，否则尝试 Final / Proxies，最后回退 DIRECT
  const rule_ai = pickPolicy(config, ["🟩SECUS", "Final", "Proxies"], "DIRECT");
  const rule_fin = pickPolicy(config, ["Proxies", "Final"], "DIRECT");

  // 5. 插入高优先级规则（前置）
  [
    "IP-CIDR,10.0.0.0/8,DIRECT,no-resolve",
    "IP-CIDR,172.16.0.0/12,DIRECT,no-resolve",
    "IP-CIDR,192.168.0.0/16,DIRECT,no-resolve",
    "IP-CIDR,127.0.0.0/8,DIRECT,no-resolve",
    "IP-CIDR,198.18.0.0/30,DIRECT,no-resolve",
    "IP-CIDR,66.154.108.107/32,DIRECT",

    `RULE-SET,Gemini,${rule_ai}`,
    `RULE-SET,Paypal,${rule_ai}`,
    `RULE-SET,Openai,${rule_ai}`,
    `RULE-SET,Claude,${rule_ai}`,
    `DOMAIN-SUFFIX,ai,${rule_ai}`,
    `DOMAIN-KEYWORD,cursor,${rule_ai}`,
    `DOMAIN-KEYWORD,michigan,${rule_ai}`,

    "RULE-SET,AD,REJECT",
    "RULE-SET,EasyList,REJECT",
    "RULE-SET,EasyListChina,REJECT",
    "RULE-SET,EasyPrivacy,REJECT",
    "RULE-SET,ProgramAD,REJECT",
    `DOMAIN-SUFFIX,io,${rule_fin}`,
    `DOMAIN-SUFFIX,steampowered.com,${rule_fin}`,
    `RULE-SET,Adobe,${rule_fin}`,
  ].forEach((rule) => addRule(config, rule, true));

  // 6. 插入低优先级规则（后置） => 一般会被 Final 过滤
  // [

  // ].forEach(rule => addRule(config, rule, true));

  return config;
}
