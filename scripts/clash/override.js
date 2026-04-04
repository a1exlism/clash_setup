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
 * NOTE: 通用动态节点补充池
 * - 会参与地区自动识别
 * - 会进入 HK/JP/SG/TW/US/MISC -> Proxies 链路
 * - 也可作为 tmp 的动态来源
 */
const customProxies = [
  // {
  //   name: "🇯🇵 日本 01",
  //   type: "ss",
  //   server: "1.2.3.4",
  //   port: 443,
  //   cipher: "aes-128-gcm",
  //   password: "password",
  //   udp: true
  // }
];

/**
 * NOTE: 独立 SECUS 节点池
 * - 仅进入 🟩SECUS
 * - 不参与动态地区分组
 * - 不参与 tmp 动态来源
 */
const customSecUSProxies = [
  // {
  //   name: "🟩SECUS 家宽",
  //   type: "ss",
  //   server: "1.2.3.4",
  //   port: 443,
  //   cipher: "aes-128-gcm",
  //   password: "password",
  //   udp: true
  // }
];

/**
 * NOTE: tmp 节点来源地区
 * - 留空：表示自动合并全部动态地区 bucket（推荐默认）
 * - 如需限制，可填写 ["HK", "JP"] 等
 */
const TMP_SOURCE_REGIONS = [];

const REGION_ORDER = ["HK", "JP", "SG", "TW", "US", "MISC"];
const DISPLAY_REGION_ORDER = ["HK", "US", "JP", "SG", "TW", "MISC"];
const CORE_GROUP_DISPLAY_ORDER = ["Proxies", "🟩SECUS", "tmp"];
const AI_POLICY_KEYWORDS = [
  "openai",
  "chatgpt",
  "claude",
  "gemini",
  "cursor",
  "copilot",
  "sora",
  "anthropic",
  "ai",
];

const REGION_PATTERNS = {
  HK: [/(?:^|\s)HK(?:\s|$)/i, /HONG\s*KONG/i, /香港/],
  JP: [/(?:^|\s)JP(?:\s|$)/i, /JAPAN/i, /日本|东京|大阪/],
  SG: [/(?:^|\s)SG(?:\s|$)/i, /SINGAPORE/i, /新加坡/],
  TW: [/(?:^|\s)TW(?:\s|$)/i, /TAIWAN/i, /台湾|台北/],
  US: [
    /(?:^|\s)US(?:\s|$)/i,
    /(?:^|\s)USA(?:\s|$)/i,
    /UNITED\s*STATES/i,
    /AMERICA/i,
    /美国|洛杉矶|纽约|西雅图|硅谷|圣何塞/,
  ],
  MISC: [
    /(?:^|\s)MISC(?:\s|$)/i,
    /(?:^|\s)OTHER(?:\s|$)/i,
    /GLOBAL/i,
    /其他|杂项/,
  ],
};

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
    proxies: uniq(group.proxies || []),
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

function normalizeProxyName(name = "") {
  return String(name)
    .normalize("NFKC")
    .replace(/[\uD83C][\uDDE6-\uDDFF]/g, " ")
    .replace(/[()\[\]{}【】|]+/g, " ")
    .replace(/[._\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectRegion(name = "") {
  const normalized = normalizeProxyName(name);

  for (const region of REGION_ORDER) {
    const patterns = REGION_PATTERNS[region] || [];
    if (patterns.some((pattern) => pattern.test(normalized))) {
      return region;
    }
  }

  return "MISC";
}

// ====================
// 3) 规则集与业务构造
// ====================

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

function getNamedProxyNames(list) {
  return uniq(list.map((item) => item?.name).filter(Boolean));
}

function getSecUSProxyNames() {
  return getNamedProxyNames(customSecUSProxies);
}

function getDynamicProxyNames(config) {
  const secUSNames = new Set(getSecUSProxyNames());
  return uniq(
    (config.proxies || [])
      .map((item) => item?.name)
      .filter((name) => name && !secUSNames.has(name)),
  );
}

function buildRegionBuckets(proxyNames) {
  const buckets = Object.fromEntries(
    REGION_ORDER.map((region) => [region, []]),
  );

  for (const proxyName of proxyNames) {
    const region = detectRegion(proxyName);
    buckets[region].push(proxyName);
  }

  for (const region of REGION_ORDER) {
    buckets[region] = uniq(buckets[region]);
  }

  return buckets;
}

function buildRegionGroups(regionBuckets) {
  return REGION_ORDER.map((region) => ({
    name: region,
    type: "select",
    proxies: uniq([...(regionBuckets[region] || []), "REJECT"]),
  }));
}

function buildProxiesGroup(regionBuckets) {
  const availableRegionGroups = REGION_ORDER.filter(
    (region) => (regionBuckets[region] || []).length > 0,
  );

  return {
    name: "Proxies",
    type: "select",
    proxies: uniq([...availableRegionGroups, "REJECT"]),
  };
}

function buildTmpGroup(regionBuckets) {
  const sourceRegions = TMP_SOURCE_REGIONS.length
    ? TMP_SOURCE_REGIONS.filter((region) => REGION_ORDER.includes(region))
    : REGION_ORDER;

  const proxyNames = uniq(
    sourceRegions.flatMap((region) => regionBuckets[region] || []),
  );

  return {
    name: "tmp",
    type: "select",
    proxies: uniq([...proxyNames, "REJECT"]),
  };
}

function buildSecUSGroup() {
  return {
    name: "🟩SECUS",
    type: "select",
    proxies: uniq([...getSecUSProxyNames(), "REJECT"]),
  };
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
    secUSPolicy: selectPolicy(config, ["🟩SECUS"], "REJECT"),
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

function isFinalGroupName(name = "") {
  return /^final$/i.test(String(name).trim());
}

function isAiPolicyGroupName(name = "") {
  const normalized = String(name).toLowerCase();

  if (!normalized) return false;
  if (REGION_ORDER.includes(name)) return false;
  if (DISPLAY_REGION_ORDER.includes(name)) return false;
  if (CORE_GROUP_DISPLAY_ORDER.includes(name)) return false;
  if (name === "🟩SECUS" || name === "tmp" || name === "Proxies") return false;
  if (isFinalGroupName(name)) return false;

  return AI_POLICY_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function reorderProxyGroups(config) {
  const groups = ensureArray(config, "proxy-groups");
  const groupsByName = new Map(groups.map((group) => [group?.name, group]));
  const consumed = new Set();
  const ordered = [];

  function pushByName(name) {
    if (!groupsByName.has(name) || consumed.has(name)) return;
    ordered.push(groupsByName.get(name));
    consumed.add(name);
  }

  DISPLAY_REGION_ORDER.forEach(pushByName);
  CORE_GROUP_DISPLAY_ORDER.forEach(pushByName);

  for (const group of groups) {
    const name = group?.name;
    if (!name || consumed.has(name)) continue;
    if (isAiPolicyGroupName(name)) {
      ordered.push(group);
      consumed.add(name);
    }
  }

  for (const group of groups) {
    const name = group?.name;
    if (!name || consumed.has(name) || isFinalGroupName(name)) continue;
    ordered.push(group);
    consumed.add(name);
  }

  for (const group of groups) {
    const name = group?.name;
    if (!name || consumed.has(name)) continue;
    if (isFinalGroupName(name)) {
      ordered.push(group);
      consumed.add(name);
    }
  }

  config["proxy-groups"] = ordered;
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

    "fake-ip-filter": uniq([
      ...currentFakeIpFilter,
      ...DNS_CONSTANTS.BASIC_FAKE_IP_FILTER,
    ]),

    // bootstrap DNS：只允许国内 DNS
    "default-nameserver": DNS_CONSTANTS.DEFAULT_NAMESERVER,

    // 默认 DNS：只允许代理 DoH 参与主解析链路
    // tmp 不单独定义 nameserver-policy，而是复用 commonPolicy 对应的通用 DNS
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

  // 1. 注入自定义节点
  customProxies.forEach((proxy) => addNamed(config.proxies, proxy));
  customSecUSProxies.forEach((proxy) => addNamed(config.proxies, proxy));

  // 2. 构建动态地区桶（仅服务 Proxies / tmp 链）
  const dynamicProxyNames = getDynamicProxyNames(config);
  const regionBuckets = buildRegionBuckets(dynamicProxyNames);

  // 3. 动态注入 / 合并策略组
  buildRegionGroups(regionBuckets).forEach((group) => {
    upsertGroup(config["proxy-groups"], group);
  });
  upsertGroup(config["proxy-groups"], buildProxiesGroup(regionBuckets));
  upsertGroup(config["proxy-groups"], buildTmpGroup(regionBuckets));
  upsertGroup(config["proxy-groups"], buildSecUSGroup());

  // 4. 统一重排策略组顺序（仅影响 GUI 展示顺序，不影响分流语义）
  reorderProxyGroups(config);

  // 5. 动态注入 rule-providers
  Object.entries(ruleProviders).forEach(([name, provider]) => {
    setRuleProvider(config, name, provider);
  });

  // 6. 统一解析策略，只算一次
  const policies = resolvePolicies(config);

  // 7. 动态注入前置规则
  prependRules(
    config,
    buildPrependRules(policies.secUSPolicy, policies.commonPolicy),
  );

  // 8. 注入网络配置（TUN / Sniffer / DNS）
  applyNetworkConfig(config, policies);

  return config;
}
