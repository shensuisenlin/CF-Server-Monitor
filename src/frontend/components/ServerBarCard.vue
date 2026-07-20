<template>
  <router-link :to="to" class="server-card" :data-region="regionCode">
    <div class="server-card-header">
      <div class="server-identity">
        <span v-if="regionCode && regionCode !== 'xx'" class="country-os-icons">
          <img class="flag-img" :src="getPublicAssetUrl('flags/' + regionCode + '.svg')" :alt="regionCode">
          <OsIcon :os="server.os" />
        </span>
        <span v-else class="country-os-icons">
          <span class="flag-fallback">🏳️</span>
          <OsIcon :os="server.os" />
        </span>
        <span class="server-name">{{ server.name }}</span>
      </div>
      <span class="status-label" :style="{ color: statusColor, borderColor: statusColor }">{{ statusText }}</span>
    </div>
    <div class="server-meta">
      <div class="card-meta">
        <div v-if="sysConfig.show_price && server.price" class="card-meta-item">💰 {{ server.price }}</div>
        <div v-if="sysConfig.show_expire && server.expire_date" class="card-meta-item">📅 <span :class="{ 'expired': isExpired }">{{ expireText }}</span></div>
      </div>
      <div class="card-badges">
        <span v-for="(tag, index) in tagList" :key="tag" :class="['badge', 'badge-tag', tagColorClass(index)]">{{ tag }}</span>
        <span v-if="server.ip_v4 === '1' && server.ip_v6 === '1'" class="badge badge-v4-v6">IPv4/6</span>
        <template v-else>
          <span v-if="server.ip_v4 === '1'" class="badge badge-v4">IPv4</span>
          <span v-if="server.ip_v6 === '1'" class="badge badge-v6">IPv6</span>
        </template>
      </div>
    </div>
    <div class="server-stats">
      <div class="stat-row">
        <span class="stat-key">CPU</span>
        <div class="stat-bar-container">
          <div class="stat-bar-fill" :style="{ width: cpuPercent + '%', background: 'var(--accent-cyan)' }"></div>
        </div>
        <span class="stat-value">{{ cpuPercent.toFixed(2) }}%</span>
      </div>
      <div class="stat-row">
        <span class="stat-key">RAM</span>
        <div class="stat-bar-container">
          <div class="stat-bar-fill" :style="{ width: ramPercent + '%', background: 'var(--accent-purple)' }"></div>
        </div>
        <span class="stat-value">{{ ramPercent.toFixed(2) }}%</span>
      </div>
      <div class="stat-row">
        <span class="stat-key">DISK</span>
        <div class="stat-bar-container">
          <div class="stat-bar-fill" :style="{ width: diskPercent + '%', background: 'var(--accent-green)' }"></div>
        </div>
        <span class="stat-value">{{ diskPercent.toFixed(2) }}%</span>
      </div>
      <div class="stat-row" v-if="sysConfig.show_tf && server.traffic_limit">
        <span class="stat-key">USE</span>
        <div class="stat-bar-container">
          <div class="stat-bar-fill" :style="{ width: Math.min(100, trafficUsagePercent) + '%', background: 'var(--accent-blue)' }"></div>
        </div>
        <span class="stat-value">{{ trafficUsagePercentText }}%</span>
      </div>
      <div class="stat-row">
        <span class="stat-key">LOAD</span>
        <span class="net-down">{{ loadAvg[0].toFixed(2) }}</span>
        <span>{{ loadAvg[1].toFixed(2) }}</span>
        <span class="net-up">{{ loadAvg[2].toFixed(2) }}</span>
      </div>
      <div class="stat-row">
        <span class="stat-key">NET</span>
        <span class="net-down">▼ {{ netInSpeed }}/s</span>
        <span class="net-up">▲ {{ netOutSpeed }}/s</span>
      </div>
      <div class="stat-row">
        <span class="stat-key">TRF</span>
        <span class="net-down">▼ {{ totalRx }}</span>
        <span class="net-up">▲ {{ totalTx }}</span>
        <span v-if="sysConfig.show_tf && server.traffic_limit" class="stat-limit">/ 📦 {{ formatBytes(server.traffic_limit * 1024 * 1024 * 1024) }}</span>
      </div>
      <div v-if="sysConfig.show_time" class="stat-row stat-time-row">
        <span class="stat-key">TIME</span>
        <span class="stat-time-value">{{ dataTimeText }}</span>
      </div>
    </div>
    <div class="ping-panel">
      <div class="ping-item">
        <span class="ping-label">CT</span>
        <span class="ping-value" :style="{ color: getPingColor(server.ping_ct) }">{{ !isPingValid(server.ping_ct) ? trans.timeout : server.ping_ct + 'ms' }}</span>
      </div>
      <div class="ping-item">
        <span class="ping-label">CU</span>
        <span class="ping-value" :style="{ color: getPingColor(server.ping_cu) }">{{ !isPingValid(server.ping_cu) ? trans.timeout : server.ping_cu + 'ms' }}</span>
      </div>
      <div class="ping-item">
        <span class="ping-label">CM</span>
        <span class="ping-value" :style="{ color: getPingColor(server.ping_cm) }">{{ !isPingValid(server.ping_cm) ? trans.timeout : server.ping_cm + 'ms' }}</span>
      </div>
      <div class="ping-item">
        <span class="ping-label">BD</span>
        <span class="ping-value" :style="{ color: getPingColor(server.ping_bd) }">{{ !isPingValid(server.ping_bd) ? trans.timeout : server.ping_bd + 'ms' }}</span>
      </div>
    </div>
  </router-link>
</template>

<script setup>
import OsIcon from './OsIcon.vue'
import { DEFAULT_SERVER_CARD_CONFIG, useServerCardData } from '../composables/useServerCardData'

const props = defineProps({
  server: {
    type: Object,
    required: true
  },
  sysConfig: {
    type: Object,
    default: () => ({ ...DEFAULT_SERVER_CARD_CONFIG })
  },
  to: {
    type: String,
    default: ''
  }
})

const {
  trans,
  regionCode,
  statusColor,
  statusText,
  cpuPercent,
  ramPercent,
  diskPercent,
  trafficUsagePercent,
  trafficUsagePercentText,
  tagList,
  tagColorClass,
  netInSpeed,
  netOutSpeed,
  totalRx,
  totalTx,
  loadAvg,
  dataTimeText,
  isExpired,
  expireText,
  isPingValid,
  getPingColor,
  getPublicAssetUrl,
  formatBytes
} = useServerCardData(props)
</script>
