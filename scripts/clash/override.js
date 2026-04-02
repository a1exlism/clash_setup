/**
 * global extension script
 * 强约束 DNS + 模块化结构版
 * ==== WARNING ====
 * 必须禁用 设置 > Clash 设置 > DNS 覆写 功能，以保证配置文件覆写可用
 * ==== WARNING ====
 */

// ====================
// 1) 静态配置
// ====================

/**
 * NOTE: 如需静态注入节点，在这里填写
 * 默认留空，可直接运行
 */
const customProxies = [
  // {
  //   name: "🇺🇸 美国家宽",
  //   type: "ss",
  //   server: "1.2.3.4",
  //   port: 443,
  //   cipher: "aes-128-gcm",
  //   password: "password",
  //   udp: true
  // }
];

// ====================
// 2) 通用工具
// ====================

function ensureArray(obj, key) {
  if (!Array.isArray(obj[key])) obj[key] = [];
  return obj[key];
}

function ensureObject(obj, key) {
  if (!obj[key] || typeof obj[key] !== "object" || Array.isArray(obj[key])) {
    obj[key] = {};
  }
  return obj[key];
}

function uniq(arr = []) {
  return [...new Set(arr.filter(Boolean))];
}

function addNamed(list, item) {
  if (!item?.name) return;
  if (!list.some((x) => x?.name === item.name)) {
    list.push(item);
  }
}

function upsertGroup(list, group) {
  const index = list.findIndex((x) => x?.name === group.name);

  if (index === -1) {
    list.push({
      ...group,
      proxies: uniq(group.proxies || []),
    });
    return;
  }

  const current = list[index];
  list[index] = {
    ...current,
    ...group,
    proxies: uniq([...(current.proxies || []), ...(group.proxies || [])]),
  };
}

function hasPolicy(config, name) {
  const builtins = ["DIRECT", "REJECT", "PROXY", "PROXIES"];
  return (
    builtins.includes(name) ||
    (config.proxies || []).some((x) => x?.name === name) ||
    (config["proxy-groups"] || []).some((x) => x?.name === name)
  );
}

function selectPolicy(config, candidates, fallback = "REJECT") {
  return candidates.find((name) => hasPolicy(config, name)) || fallback;
}

function setRuleProvider(config, name, provider) {
  const providers = ensureObject(config, "rule-providers");
  providers[name] = { ...(providers[name] || {}), ...provider };
}

function prependRules(config, rules) {
  const currentRules = ensureArray(config, "rules");
  const newRules = rules.filter((rule) => !currentRules.includes(rule));
  config.rules = [...newRules, ...currentRules];
}

/**
 * 动态生成的策略组模板
 */
const groupTemplates = ["🟩SECUS", "Proxies", "US"];

/**
 * 规则集
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

const AI_RULESETS = ["Gemini", "Paypal", "Openai", "Claude"];
const COMMON_RULESETS = ["Twitter", "Adobe"];

const DNS_CONSTANTS = {
  FORCE_DOMAIN: [
    "+.openai.com",
    "+.chat.com",
    "+.chatgpt.com",
    "+.oaistatic.com",
    "+.oaiusercontent.com",
    "+.sora.com",
    "+.anthropic.com",
    "+.claude.ai",
    "+.claude.com",
    "+.claudeusercontent.com",
    "+.gemini.google.com",
    "+.aistudio.google.com",
    "+.generativelanguage.googleapis.com",
    "+.makersuite.google.com",
    "+.notebooklm.google.com",
  ],

  BASIC_FAKE_IP_FILTER: [
    "*.lan",
    "+.lan",
    "*.local",
    "+.local",
    "+.localdomain",
    "+.home.arpa",
    "+.msftconnecttest.com",
    "+.msftncsi.com",
    "www.msftconnecttest.com",
    "connectivitycheck.gstatic.com",
    "+.captive.apple.com",
    "time.*.com",
    "time.*.gov",
    "ntp.*.com",
    "ntp.*.org",
    "pool.ntp.org",
    "+.pool.ntp.org",
    "+.stun.*.*",
    "+.stun.*.*.*",
    "+.stun.*.*.*.*",
    "localhost.ptlogin2.qq.com",
    "WORKGROUP",
  ],

  /**
   * 强约束 bootstrap：
   * 不混入国外 DNS / DoH
   */
  DEFAULT_NAMESERVER: ["223.5.5.5", "119.29.29.29"],

  /**
   * 强约束直连 DNS：
   * 只允许国内 DNS 参与直连解析
   */
  DIRECT_NAMESERVER: ["223.5.5.5#DIRECT", "119.29.29.29#DIRECT"],

  /**
   * 代理主链路解析器
   */
  PROXY_DOH: ["https://1.1.1.1/dns-query", "https://8.8.8.8/dns-query"],
};

// ====================
// 3) 业务构造
// ====================

function getCustomProxyNames() {
  return customProxies.map((item) => item.name).filter(Boolean);
}

function buildGroups(proxyNames) {
  return groupTemplates.map((name) => ({
    name,
    type: "select",
    proxies: [...proxyNames, "REJECT"],
  }));
}

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

function resolvePolicies(config) {
  return {
    secUSPolicy: selectPolicy(
      config,
      ["🟩SECUS", "Final", "Proxies"],
      "REJECT",
    ),
    commonPolicy: selectPolicy(config, ["Proxies", "Final"], "REJECT"),
  };
}

function buildAiNameserverPolicy(policyName) {
  const entries = {};
  for (const name of AI_RULESETS) {
    entries[`rule-set:${name}`] = DNS_CONSTANTS.PROXY_DOH.map(
      (dns) => `${dns}#${policyName}`,
    );
  }
  return entries;
}

// ====================
// 4) 网络配置注入
// ====================

function applyTunConfig(config) {
  ensureObject(config, "tun");
  config.tun = {
    ...config.tun,
    enable: true,
    stack: "system",
    "auto-route": true,
    "auto-detect-interface": true,
    "strict-route": true,
    "dns-hijack": ["any:53", "tcp://any:53"],
  };
}

function applySnifferConfig(config) {
  ensureObject(config, "sniffer");

  const currentForceDomain = Array.isArray(config.sniffer["force-domain"])
    ? config.sniffer["force-domain"]
    : [];

  config.sniffer = {
    ...config.sniffer,
    enable: true,
    "force-dns-mapping": true,
    "parse-pure-ip": true,
    "override-destination": true,
    sniff: {
      HTTP: { ports: [80, "8080-8880"], "override-destination": true },
      TLS: { ports: [443, 8443] },
      QUIC: { ports: [443, 8443] },
      ...(config.sniffer.sniff || {}),
    },
    "force-domain": uniq([
      ...currentForceDomain,
      ...DNS_CONSTANTS.FORCE_DOMAIN,
    ]),
  };
}

function applyDnsConfig(config, policies) {
  ensureObject(config, "dns");

  const currentFakeIpFilter = Array.isArray(config.dns["fake-ip-filter"])
    ? config.dns["fake-ip-filter"]
    : [];

  const currentIpv6 =
    typeof config.dns.ipv6 === "boolean" ? config.dns.ipv6 : true;

  config.dns = {
    ...config.dns,
    enable: true,
    listen: config.dns.listen || ":53",
    ipv6: currentIpv6,
    "cache-algorithm": "arc",
    "enhanced-mode": "fake-ip",
    "fake-ip-range": config.dns["fake-ip-range"] || "198.18.0.1/16",
    "fake-ip-filter-mode": config.dns["fake-ip-filter-mode"] || "blacklist",
    "prefer-h3": false,
    "respect-rules": true,
    "use-hosts": false,
    "use-system-hosts": false,
    ipv6: currentIpv6,

    "fake-ip-filter": uniq([
      ...currentFakeIpFilter,
      ...DNS_CONSTANTS.BASIC_FAKE_IP_FILTER,
    ]),

    // bootstrap DNS：只允许国内 DNS
    "default-nameserver": DNS_CONSTANTS.DEFAULT_NAMESERVER,

    // 默认 DNS：只允许代理 DoH 参与主解析链路
    nameserver: DNS_CONSTANTS.PROXY_DOH.map(
      (dns) => `${dns}#${policies.commonPolicy}`,
    ),

    // 域名 / 规则分流到指定 DNS
    "nameserver-policy": {
      ...(config.dns["nameserver-policy"] || {}),
      "geosite:cn": DNS_CONSTANTS.DIRECT_NAMESERVER,
      "geosite:private": DNS_CONSTANTS.DIRECT_NAMESERVER,
      ...buildAiNameserverPolicy(policies.secUSPolicy),
    },

    // fallback 保留 Verge 默认结构，但不实际启用 fallback 解析器
    "fallback-filter": {
      geoip: true,
      "geoip-code": "CN",
      ipcidr: ["240.0.0.0/4", "0.0.0.0/32"],
      domain: ["+.google.com", "+.facebook.com", "+.youtube.com"],
    },

    fallback: [],

    // 代理节点解析：只允许受控直连 DNS
    "proxy-server-nameserver": uniq([...DNS_CONSTANTS.DIRECT_NAMESERVER]),

    // 直连流量解析：只允许受控直连 DNS
    "direct-nameserver": uniq([...DNS_CONSTANTS.DIRECT_NAMESERVER]),

    "direct-nameserver-follow-policy": true,
  };
}

function applyNetworkConfig(config, policies) {
  applyTunConfig(config);
  applySnifferConfig(config);
  applyDnsConfig(config, policies);
}

// ====================
// 5) 主流程
// ====================

function main(config) {
  ensureArray(config, "proxies");
  ensureArray(config, "proxy-groups");
  ensureArray(config, "rules");
  ensureObject(config, "rule-providers");
  ensureObject(config, "dns");
  ensureObject(config, "tun");
  ensureObject(config, "sniffer");

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

  // 4. 统一解析策略，只算一次
  const policies = resolvePolicies(config);

  // 5. 动态注入前置规则
  prependRules(
    config,
    buildPrependRules(policies.secUSPolicy, policies.commonPolicy),
  );

  // 6. 注入网络配置（TUN / Sniffer / DNS）
  applyNetworkConfig(config, policies);

  return config;
}
