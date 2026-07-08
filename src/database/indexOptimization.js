import { saveSiteOptions, debug, getSettingByKey } from '../utils/settings.js';
import { getAllServers } from '../utils/cache.js';

export const HISTORY_PARTITION_MULTIPLIER = 10000000000000;
export const HISTORY_AUTO_OPTIMIZED_MIN_ID = HISTORY_PARTITION_MULTIPLIER;
export const HISTORY_MAX_PARTITION_ID = 900;

// 确保servers历史记录分区优化
export async function ensureServerOptimization(db) {
  // 检查是否已优化, 这里后续可以删除检查，包括下面的保存操作
  if (getSettingByKey(db, 'servers_optimized')) {
    debug('服务器历史记录分区已优化');
    return;
  }

  // 新建history_partition_id字段
  await db.prepare(
    `ALTER TABLE servers ADD COLUMN history_partition_id INTEGER DEFAULT 0`
  ).run();

  const { results: columns = [] } = await db.prepare(`PRAGMA table_info(servers)`).all();
  const hasSortOrder = columns.some(column => column.name === 'sort_order');
  const sortOrderSelect = hasSortOrder ? ', sort_order' : '';
  const sortOrderSql = hasSortOrder ? 'sort_order ASC, ' : '';
  const { results: servers = [] } = await db.prepare(`
    SELECT id, history_partition_id AS history_partition_id${sortOrderSelect}
    FROM servers
    ORDER BY ${sortOrderSql}id ASC
  `).all();
  const usedIds = new Set();
  const updates = [];

  for (const server of servers) {
    let partitionId = normalizeHistoryPartitionId(server.history_partition_id);
    if (partitionId && !usedIds.has(partitionId)) {
      usedIds.add(partitionId);
      serverHistoryPartitionCache.set(server.id, partitionId);
      continue;
    }

    partitionId = nextAvailableHistoryPartitionId(usedIds);
    usedIds.add(partitionId);
    updates.push({ serverId: server.id, partitionId });
    serverHistoryPartitionCache.set(server.id, partitionId);
  }

  for (const update of updates) {
    await db.prepare(
      `UPDATE servers SET history_partition_id = ? WHERE id = ?`
    ).bind(update.partitionId, update.serverId).run();
  }

  debug('服务器历史记录分区优化完成');

  // 标记为已优化
  await saveSiteOptions(db, { servers_optimized: '1' });

  return { success: true, assigned: updates.length };
}

// 获取下一个可用的历史记录分区ID
export async function getNextServerHistoryPartitionId(db) {
  const servers = await getAllServers(db, true);
  const usedIds = new Set(
    servers
      .map(s => Number(s.history_partition_id))
      .filter(id => Number.isInteger(id) && id > 0 && id <= HISTORY_MAX_PARTITION_ID)
  );
  
  for (let id = 1; id <= HISTORY_MAX_PARTITION_ID; id++) {
    if (!usedIds.has(id)) return id;
  }
  debug(`No available history partition id`);
  throw new Error(`No available history partition id`);
}

// 格式化历史记录时间戳
export function normalizeHistoryTimestamp(value, fallback = Date.now()) {
  const ts = Number(value);
  if (!Number.isFinite(ts) || ts <= 0) return fallback;
  return ts < 10000000000 ? ts * 1000 : ts;
}

export function formatHistoryTimeKey(timestamp) {
  const normalized = normalizeHistoryTimestamp(timestamp);

  const date = new Date(normalized);
  const year = date.getUTCFullYear();
  if (year < 2000 || year > 2099) {
    debug(`Invalid year ${year} for history time key`);
    throw new Error(`Invalid year ${year} for history time key`);
  };

  return Number([
    padHistoryTimePart(year % 100),
    padHistoryTimePart(date.getUTCMonth() + 1),
    padHistoryTimePart(date.getUTCDate()),
    padHistoryTimePart(date.getUTCHours()),
    padHistoryTimePart(date.getUTCMinutes()),
    padHistoryTimePart(date.getUTCSeconds())
  ].join(''));
}