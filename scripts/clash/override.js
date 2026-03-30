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

// 不存在才插入
function addNamed(list, item) {
  if (!list.some((x) => x?.name === item.name)) {
    list.push(item);
  }
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

// 批量前置规则：保持输入顺序，并自动去重
function prependRules(config, rules) {
  const currentRules = ensureArray(config, "rules");
  const newRules = rules.filter((rule) => !currentRules.includes(rule));
  config.rules = [...newRules, ...currentRules];
}

/**
 * NOTE: 需要手动维护的静态节点区
 * 后续 proxy-groups 会直接引用这里的 name
 */
const customProxies = [
  {
    name: "🇺🇸 美国家宽",
    xxxx,
  },
];

// 由静态节点派生出节点名列表，供策略组复用
function getCustomProxyNames() {
  return customProxies.map((item) => item.name);
}

function main(config) {
  ensureArray(config, "proxies");
  ensureArray(config, "proxy-groups");
  ensureArray(config, "rules");
  ensureObject(config, "rule-providers");

  // 1. 注入自定义节点（唯一静态配置来源）
  customProxies.forEach((proxy) => addNamed(config.proxies, proxy));

  const customProxyNames = getCustomProxyNames();

  // 2. 动态注入策略组
  // 这里直接引用 customProxies 的 name，避免重复写节点名
  [
    {
      name: "🟩SECUS",
      type: "select",
      proxies: [...customProxyNames, "REJECT"],
    },
    {
      name: "Proxies",
      type: "select",
      proxies: [...customProxyNames, "REJECT"],
    },
    {
      name: "US",
      type: "select",
      proxies: [...customProxyNames, "REJECT"],
    },
  ].forEach((group) => addNamed(config["proxy-groups"], group));

  // 3. 动态注入 rule-providers
  const providers = {
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

  Object.entries(providers).forEach(([name, provider]) => {
    setRuleProvider(config, name, provider);
  });

  // 4. 动态选择规则目标
  const secUSPolicy = selectPolicy(config, ["🟩SECUS", "Final", "Proxies"]);
  const commonPolicy = selectPolicy(config, ["Proxies", "Final"]);

  // 5. 动态注入前置规则
  // 这里从上到下就是最终匹配顺序
  prependRules(config, [
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
    `DOMAIN-SUFFIX,io,${commonPolicy}`,
    `DOMAIN-SUFFIX,steampowered.com,${commonPolicy}`,
    `RULE-SET,Adobe,${commonPolicy}`,
  ]);

  return config;
}
