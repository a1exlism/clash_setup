/**
 * global extension script
 * 强约束 DNS + 模块化结构版（方案 B）
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
 * - 也可作为 Tmp 的动态来源
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
 * NOTE: 独立 SecUS 节点池
 * - 仅进入 🟩SecUS
 * - 不参与动态地区分组
 * - 不参与 Tmp 动态来源
 */
const customSecUSProxies = [
  // {
  //   name: "🟩SecUS 家宽",
  //   type: "ss",
  //   server: "1.2.3.4",
  //   port: 443,
  //   cipher: "aes-128-gcm",
  //   password: "password",
  //   udp: true
  // }
];

/**
 * NOTE: Tmp 节点来源地区
 * - 留空：表示自动合并全部动态地区 bucket（推荐默认）
 * - 如需限制，可填写 ["HK", "JP"] 等
 */
const tmpSourceRegions = [];

/**
 * NOTE: TUN 路由层绕过网段
 * - 这些网段将直接绕过 mihomo TUN，不再进入代理栈
 * - 用于规避 2.4.x 对局域网访问的回归问题
 * - 建议至少保留 RFC1918 私网段
 */
const tunRouteExcludeAddress = [
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
];

/**
 * 地区识别顺序：
 * - 用于节点名称归类
 * - 与 GUI 展示顺序分离
 */
const regionOrder = ["HK", "JP", "SG", "TW", "US", "MISC"];

/**
 * GUI 中的地区组展示顺序
 */
const displayRegionOrder = ["HK", "US", "JP", "SG", "TW", "MISC"];

/**
 * GUI 中的核心组展示顺序
 * - 按你的要求，优先于 AI 服务组和地区组
 */
const coreGroupDisplayOrder = ["Proxies", "🟩SecUS", "Tmp"];

/**
 * GUI 中的 AI 服务组展示顺序
 * - 这些组是实际规则入口组，不是纯展示组
 */
const aiServiceGroupOrder = ["OpenAI", "Claude", "Gemini", "PayPal"];

/**
 * 用于识别“其他 AI 相关策略组”的关键字
 * - 只影响 GUI 排序归类，不影响实际路由
 */
const aiPolicyKeywords = [
  "openai",
  "chatgpt",
  "claude",
  "gemini",
  "cursor",
  "copilot",
  "sora",
  "anthropic",
  "paypal",
  "ai",
];

/**
 * 核心保留 AI 服务组的别名收敛映射
 * - 这里只处理 OpenAI / PayPal / Claude / Gemini
 * - 不处理 SecUS / Tmp，因为你明确说明外部订阅通常不会携带这些 group name
 */
const canonicalGroupNameMap = {
  openai: "OpenAI",
  paypal: "PayPal",
  claude: "Claude",
  gemini: "Gemini",
};

const regionPatterns = {
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

/**
 * 兼容 kebab-case / camelCase 两种字段名
 * - Clash/Mihomo 配置实际使用 kebab-case
 * - 某些脚本或运行时对象可能带 camelCase
 */
function readConfigList(obj, kebabKey, camelKey) {
  const kebabValue = obj?.[kebabKey];
  if (Array.isArray(kebabValue)) return kebabValue;

  const camelValue = obj?.[camelKey];
  if (Array.isArray(camelValue)) return camelValue;

  return [];
}

/**
 * 按 name 覆盖或插入策略组
 * - 已存在则覆盖为脚本定义的结构
 * - 不存在则追加
 */
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

/**
 * 末尾兜底规则专用：
 * - 先移除重复项
 * - 再保证 MATCH,Final 永远在规则尾部
 */
function appendTrailingRule(config, rule) {
  const currentRules = ensureArray(config, "rules").filter(
    (item) => item !== rule,
  );
  config.rules = [...currentRules, rule];
}

/**
 * 把组名转换为通用比较键：
 * - 去首尾空格
 * - Unicode 归一化
 * - 转小写
 * - 移除空格 / 下划线 / 连字符
 *
 * 示例：
 * - openai / OPENAI / Open-AI / open_ai -> openai
 * - paypal / PAY_PAL -> paypal
 */
function normalizeGroupAliasKey(name = "") {
  return String(name)
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

/**
 * 核心 AI 服务组名称归一化：
 * - 只对 OpenAI / PayPal / Claude / Gemini 生效
 * - 其他订阅组保持原样，避免误合并
 */
function canonicalizeGroupName(name = "") {
  const raw = String(name).trim();
  if (!raw) return raw;

  const normalizedKey = normalizeGroupAliasKey(raw);
  return canonicalGroupNameMap[normalizedKey] || raw;
}

/**
 * 对订阅自带策略组做名称收敛：
 * - 主要解决 OpenAI / PayPal 等不同大小写或不同分隔符写法导致的重复组并存问题
 * - 同名收敛后会合并 proxy 列表
 */
function normalizeExistingGroupNames(config) {
  const groups = ensureArray(config, "proxy-groups");
  const merged = [];

  for (const group of groups) {
    if (!group?.name) continue;
    const normalizedName = canonicalizeGroupName(group.name);
    const normalizedGroup = {
      ...group,
      name: normalizedName,
    };

    const existing = merged.find((item) => item?.name === normalizedName);
    if (!existing) {
      merged.push({
        ...normalizedGroup,
        proxies: uniq(normalizedGroup.proxies || []),
      });
      continue;
    }

    existing.proxies = uniq([
      ...(existing.proxies || []),
      ...(normalizedGroup.proxies || []),
    ]);
    existing.type = normalizedGroup.type || existing.type;
    existing.url = normalizedGroup.url || existing.url;
    existing.interval = normalizedGroup.interval || existing.interval;
    existing.lazy =
      typeof normalizedGroup.lazy === "boolean"
        ? normalizedGroup.lazy
        : existing.lazy;
    existing.tolerance = normalizedGroup.tolerance || existing.tolerance;
    existing.strategy = normalizedGroup.strategy || existing.strategy;
    existing["max-failed-times"] =
      normalizedGroup["max-failed-times"] || existing["max-failed-times"];
  }

  config["proxy-groups"] = merged;
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

  for (const region of regionOrder) {
    const patterns = regionPatterns[region] || [];
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
  PayPal: {
    type: "http",
    behavior: "classical",
    url: "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/refs/heads/master/rule/Clash/PayPal/PayPal.yaml",
    path: "./rules/PayPal.yaml",
    interval: 86400,
  },
  Gemini: {
    type: "http",
    behavior: "classical",
    url: "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Gemini/Gemini.yaml",
    path: "./rules/Gemini.yaml",
    interval: 86400,
  },
  OpenAI: {
    type: "http",
    behavior: "classical",
    url: "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/OpenAI/OpenAI.yaml",
    path: "./rules/OpenAI.yaml",
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

const aiRuleSets = ["Gemini", "PayPal", "OpenAI", "Claude"];

const dnsConstants = {
  forceDomain: [
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

  basicFakeIpFilter: [
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
   * bootstrap DNS：
   * - 仅用于 DoH / 域名解析器本身的启动解析
   * - 不混入国外 DNS / DoH
   */
  defaultNameServer: ["223.5.5.5", "119.29.29.29"],

  /**
   * 受控直连 DNS：
   * - 仅用于 geosite:cn / geosite:private / direct-nameserver / proxy-server-nameserver
   */
  directNameServer: ["223.5.5.5#DIRECT", "119.29.29.29#DIRECT"],

  /**
   * 代理主链路解析器：
   * - 默认 nameserver 和 AI nameserver-policy 都基于它
   */
  proxyDoh: ["https://1.1.1.1/dns-query", "https://8.8.8.8/dns-query"],
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
  const buckets = Object.fromEntries(regionOrder.map((region) => [region, []]));

  for (const proxyName of proxyNames) {
    const region = detectRegion(proxyName);
    buckets[region].push(proxyName);
  }

  for (const region of regionOrder) {
    buckets[region] = uniq(buckets[region]);
  }

  return buckets;
}

function buildRegionGroups(regionBuckets) {
  return regionOrder.map((region) => ({
    name: region,
    type: "select",
    proxies: uniq([...(regionBuckets[region] || []), "REJECT"]),
  }));
}

function buildProxiesGroup(regionBuckets) {
  const availableRegionGroups = regionOrder.filter(
    (region) => (regionBuckets[region] || []).length > 0,
  );

  return {
    name: "Proxies",
    type: "select",
    proxies: uniq([...availableRegionGroups, "REJECT"]),
  };
}

function buildTmpGroup(regionBuckets) {
  const sourceRegions = tmpSourceRegions.length
    ? tmpSourceRegions.filter((region) => regionOrder.includes(region))
    : regionOrder;

  const proxyNames = uniq(
    sourceRegions.flatMap((region) => regionBuckets[region] || []),
  );

  return {
    name: "Tmp",
    type: "select",
    proxies: uniq([...proxyNames, "REJECT"]),
  };
}

function buildSecUSGroup() {
  return {
    name: "🟩SecUS",
    type: "select",
    proxies: uniq([...getSecUSProxyNames(), "REJECT"]),
  };
}

/**
 * AI 服务入口组：
 * - 规则先命中服务组（OpenAI / Claude / Gemini / PayPal）
 * - 服务组默认再指向 🟩SecUS / REJECT
 * - 这样 GUI 展示与实际命中链一致
 */
function buildAiServiceGroups() {
  return aiServiceGroupOrder.map((groupName) => ({
    name: groupName,
    type: "select",
    proxies: ["🟩SecUS", "REJECT"],
  }));
}

/**
 * 最终兜底组：
 * - 所有未命中流量最终走 Final
 * - GUI 可在 Proxies / DIRECT 之间切换
 */
function buildFinalGroup() {
  return {
    name: "Final",
    type: "select",
    proxies: ["Proxies", "DIRECT"],
  };
}

/**
 * 前置规则：
 * - 不在这里插入 MATCH,Final
 * - MATCH,Final 统一由 appendTrailingRule 放到规则尾部，避免吞掉订阅原有后续规则
 *
 * NOTE:
 * - 这里的私网 DIRECT 规则仍然保留
 * - 但当前更关键的是 tun.route-exclude-address，它优先于规则层
 */
function buildPrependRules(commonPolicy) {
  return [
    "IP-CIDR,10.0.0.0/8,DIRECT,no-resolve",
    "IP-CIDR,172.16.0.0/12,DIRECT,no-resolve",
    "IP-CIDR,192.168.0.0/16,DIRECT,no-resolve",
    "IP-CIDR,127.0.0.0/8,DIRECT,no-resolve",
    "IP-CIDR,198.18.0.0/30,DIRECT,no-resolve",
    "IP-CIDR,66.154.108.107/32,DIRECT",

    "DOMAIN-SUFFIX,cn,DIRECT",

    "RULE-SET,Gemini,Gemini",
    "RULE-SET,PayPal,PayPal",
    "RULE-SET,OpenAI,OpenAI",
    "RULE-SET,Claude,Claude",
    "DOMAIN-SUFFIX,ai,🟩SecUS",
    "DOMAIN-KEYWORD,cursor,🟩SecUS",

    "RULE-SET,AD,REJECT",
    "RULE-SET,EasyList,REJECT",
    "RULE-SET,EasyListChina,REJECT",
    "RULE-SET,EasyPrivacy,REJECT",
    "RULE-SET,ProgramAD,REJECT",

    `RULE-SET,Twitter,${commonPolicy}`,
    `DOMAIN-SUFFIX,io,${commonPolicy}`,
    `DOMAIN-SUFFIX,steampowered.com,${commonPolicy}`,
    `RULE-SET,Adobe,${commonPolicy}`,
  ];
}

function resolvePolicies(config) {
  return {
    secUSPolicy: selectPolicy(config, ["🟩SecUS"], "REJECT"),
    commonPolicy: selectPolicy(config, ["Proxies", "Final"], "REJECT"),
  };
}

function buildAiNameServerPolicy(policyName) {
  const entries = {};
  for (const name of aiRuleSets) {
    entries[`rule-set:${name}`] = dnsConstants.proxyDoh.map(
      (dns) => `${dns}#${policyName}`,
    );
  }
  return entries;
}

function isFinalGroupName(name = "") {
  return /^final$/i.test(String(name).trim());
}

/**
 * 用于把“其他 AI 相关策略组”放到 AI 区段后面
 * - 不包括核心组
 * - 不包括标准 AI 服务入口组
 */
function isAiPolicyGroupName(name = "") {
  const normalized = String(name).toLowerCase();

  if (!normalized) return false;
  if (regionOrder.includes(name)) return false;
  if (displayRegionOrder.includes(name)) return false;
  if (coreGroupDisplayOrder.includes(name)) return false;
  if (aiServiceGroupOrder.includes(name)) return false;
  if (name === "🟩SecUS" || name === "Tmp" || name === "Proxies") return false;
  if (isFinalGroupName(name)) return false;

  return aiPolicyKeywords.some((keyword) => normalized.includes(keyword));
}

/**
 * GUI 顺序：
 * 1. 核心组
 * 2. AI 服务组
 * 3. 地区组
 * 4. 其他 AI 相关组
 * 5. 其他普通组
 * 6. Final
 */
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

  coreGroupDisplayOrder.forEach(pushByName);
  aiServiceGroupOrder.forEach(pushByName);
  displayRegionOrder.forEach(pushByName);

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

  const currentRouteExcludeAddress = readConfigList(
    config.tun,
    "route-exclude-address",
    "routeExcludeAddress",
  );

  const mergedRouteExcludeAddress = uniq([
    ...currentRouteExcludeAddress,
    ...tunRouteExcludeAddress,
  ]);

  config.tun = {
    ...config.tun,
    enable: true,
    stack: "system",
    "auto-route": true,
    "auto-detect-interface": true,
    "strict-route": true,
    "dns-hijack": ["any:53", "tcp://any:53"],

    /**
     * 关键优化：
     * - 直接在路由层绕过 RFC1918 私网段
     * - 避免局域网流量进入 TUN 后再命中 DIRECT
     * - 这是当前针对 CVR 2.4.x 内网访问异常的主要 workaround
     */
    "route-exclude-address": mergedRouteExcludeAddress,
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
    "force-domain": uniq([...currentForceDomain, ...dnsConstants.forceDomain]),
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
      ...dnsConstants.basicFakeIpFilter,
    ]),

    // bootstrap DNS：只用于 DoH 启动解析
    "default-nameserver": dnsConstants.defaultNameServer,

    // 默认普通解析：走 commonPolicy（优先 Proxies，其次 Final）
    nameserver: dnsConstants.proxyDoh.map(
      (dns) => `${dns}#${policies.commonPolicy}`,
    ),

    // AI 规则集解析：强制走 SecUS 链
    "nameserver-policy": {
      ...(config.dns["nameserver-policy"] || {}),
      "geosite:cn": dnsConstants.directNameServer,
      "geosite:private": dnsConstants.directNameServer,
      ...buildAiNameServerPolicy(policies.secUSPolicy),
    },

    "fallback-filter": {
      geoip: true,
      "geoip-code": "CN",
      ipcidr: ["240.0.0.0/4", "0.0.0.0/32"],
      domain: ["+.google.com", "+.facebook.com", "+.youtube.com"],
    },

    fallback: [],

    "proxy-server-nameserver": uniq([...dnsConstants.directNameServer]),
    "direct-nameserver": uniq([...dnsConstants.directNameServer]),
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

  /**
   * 0. 先对订阅已有策略组做名称收敛
   * - 主要处理 OpenAI / PayPal 等常见大小写或分隔符差异
   */
  normalizeExistingGroupNames(config);

  /**
   * 1. 注入静态自定义节点
   */
  customProxies.forEach((proxy) => addNamed(config.proxies, proxy));
  customSecUSProxies.forEach((proxy) => addNamed(config.proxies, proxy));

  /**
   * 2. 构建动态地区桶
   * - 仅服务于 Proxies / Tmp 链
   */
  const dynamicProxyNames = getDynamicProxyNames(config);
  const regionBuckets = buildRegionBuckets(dynamicProxyNames);

  /**
   * 3. 注入核心动态组
   */
  buildRegionGroups(regionBuckets).forEach((group) => {
    upsertGroup(config["proxy-groups"], group);
  });
  upsertGroup(config["proxy-groups"], buildProxiesGroup(regionBuckets));
  upsertGroup(config["proxy-groups"], buildTmpGroup(regionBuckets));
  upsertGroup(config["proxy-groups"], buildSecUSGroup());

  /**
   * 4. 注入 AI 服务入口组
   * - OpenAI / Claude / Gemini / PayPal
   * - 默认只给 🟩SecUS / REJECT
   */
  buildAiServiceGroups().forEach((group) => {
    upsertGroup(config["proxy-groups"], group);
  });

  /**
   * 5. 注入 Final 组
   */
  upsertGroup(config["proxy-groups"], buildFinalGroup());

  /**
   * 6. 统一重排 GUI 顺序
   */
  reorderProxyGroups(config);

  /**
   * 7. 注入 rule-providers
   */
  Object.entries(ruleProviders).forEach(([name, provider]) => {
    setRuleProvider(config, name, provider);
  });

  /**
   * 8. 统一解析策略
   */
  const policies = resolvePolicies(config);

  /**
   * 9. 注入前置规则
   * - AI 规则先打服务组
   * - 普通规则走 commonPolicy
   */
  prependRules(config, buildPrependRules(policies.commonPolicy));

  /**
   * 10. 所有未匹配流量最终走 Final
   * - 必须保证在规则尾部
   */
  appendTrailingRule(config, "MATCH,Final");

  /**
   * 11. 注入网络配置
   */
  applyNetworkConfig(config, policies);

  return config;
}
