/**
 * global extention script
 * 全局扩展脚本
 */

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

// proxies 用：不存在才插入
function addNamed(list, item) {
  if (!list.some((x) => x?.name === item.name)) {
    list.push(item);
  }
}

// proxy-groups 用：存在则合并 proxies，不存在则创建
function upsertGroup(list, group) {
  const index = list.findIndex((x) => x?.name === group.name);

  if (index === -1) {
    list.push(group);
    return;
  }

  const current = list[index];
  list[index] = {
    ...current,
    ...group,
    proxies: [
      ...new Set([...(current.proxies || []), ...(group.proxies || [])]),
    ],
  };
}

// 判断策略是否存在
function hasPolicy(config, name) {
  const builtins = ["DIRECT", "REJECT", "PROXY", "PROXIES"];
  return (
    builtins.includes(name) ||
    (config.proxies || []).some((x) => x?.name === name) ||
    (config["proxy-groups"] || []).some((x) => x?.name === name)
  );
}

// 按候选顺序选第一个可用策略；如果都不存在，则退回 candidates[0]
function selectPolicy(config, candidates, fallback = "REJECT") {
  return (
    candidates.find((name) => hasPolicy(config, name)) ||
    candidates[0] ||
    fallback
  );
}

// 写入或更新 rule-provider
function setRuleProvider(config, name, provider) {
  const providers = ensureObject(config, "rule-providers");
  providers[name] = { ...(providers[name] || {}), ...provider };
}

// 前置规则：保持输入顺序 = 最终匹配顺序
function prependRules(config, rules) {
  const currentRules = ensureArray(config, "rules");
  const newRules = rules.filter((rule) => !currentRules.includes(rule));
  config.rules = [...newRules, ...currentRules];
}

/**
 * TODO: 唯一静态配置：手动维护自定义节点
 * 以后只改这里，其他配置项会动态引用这些节点名
 */
const customProxies = [
  {
    name: "🇺🇸 美国家宽",
    xxxx,
  },
];

/**
 * NOTE: 动态生成的策略组模板
 * 这些组会自动包含 customProxies 中的节点名
 */
const groupTemplates = ["🟩SECUS", "Proxies", "US"];

/**
 * 动态注入的 rule-providers
 */
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
    url: "https://raw.githubusercontent.com/a1exlism/clash_setup/refs/heads/main/rules/clash/claude.yaml",
    path: "./rules/Claude.yaml",
    interval: 86400,
  },
  Twitter: {
    type: "http",
    behavior: "classical",
    url: "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/refs/heads/master/rule/Clash/Twitter/Twitter.yaml",
    path: "./rules/Twitter.yaml",
    interval: 86400,
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

// 固定优先级的前置规则模板
function buildPrependRules(secUSPolicy, commonPolicy) {
  return [
    // 局域网 / 本地地址直连
    "IP-CIDR,10.0.0.0/8,DIRECT,no-resolve",
    "IP-CIDR,172.16.0.0/12,DIRECT,no-resolve",
    "IP-CIDR,192.168.0.0/16,DIRECT,no-resolve",
    "IP-CIDR,127.0.0.0/8,DIRECT,no-resolve",
    "IP-CIDR,198.18.0.0/30,DIRECT,no-resolve",
    "IP-CIDR,66.154.108.107/32,DIRECT",

    // 国内域名直连
    "DOMAIN-SUFFIX,cn,DIRECT",

    // AI 服务
    `RULE-SET,Gemini,${secUSPolicy}`,
    `RULE-SET,Paypal,${secUSPolicy}`,
    `RULE-SET,Openai,${secUSPolicy}`,
    `RULE-SET,Claude,${secUSPolicy}`,
    `DOMAIN-SUFFIX,ai,${secUSPolicy}`,
    `DOMAIN-KEYWORD,cursor,${secUSPolicy}`,

    // 广告拦截
    "RULE-SET,AD,REJECT",
    "RULE-SET,EasyList,REJECT",
    "RULE-SET,EasyListChina,REJECT",
    "RULE-SET,EasyPrivacy,REJECT",
    "RULE-SET,ProgramAD,REJECT",

    // 通用分流
    `RULE-SET,Twitter,${commonPolicy}`,
    `DOMAIN-SUFFIX,io,${commonPolicy}`,
    `DOMAIN-SUFFIX,steampowered.com,${commonPolicy}`,
    `RULE-SET,Adobe,${commonPolicy}`,
  ];
}

function getCustomProxyNames() {
  return customProxies.map((item) => item.name);
}

function buildGroups(proxyNames) {
  return groupTemplates.map((name) => ({
    name,
    type: "select",
    proxies: [...proxyNames, "REJECT"],
  }));
}

function main(config) {
  ensureArray(config, "proxies");
  ensureArray(config, "proxy-groups");
  ensureArray(config, "rules");
  ensureObject(config, "rule-providers");

  // 1. 注入自定义节点（唯一静态来源）
  customProxies.forEach((proxy) => addNamed(config.proxies, proxy));

  // 2. 动态注入 / 合并策略组
  const customProxyNames = getCustomProxyNames();
  buildGroups(customProxyNames).forEach((group) => {
    upsertGroup(config["proxy-groups"], group);
  });

  // 3. 动态注入 rule-providers
  Object.entries(ruleProviders).forEach(([name, provider]) => {
    setRuleProvider(config, name, provider);
  });

  // 4. NOTE: 动态选择规则目标
  const secUSPolicy = selectPolicy(config, ["🟩SECUS", "Final", "Proxies"]);
  const commonPolicy = selectPolicy(config, ["Proxies", "Final"]);

  // 5. 动态注入前置规则
  prependRules(config, buildPrependRules(secUSPolicy, commonPolicy));

  return config;
}
