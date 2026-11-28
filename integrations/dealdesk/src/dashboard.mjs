import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { project, scopeOrgQuery, fail } from './domain.mjs';

const POTENTIAL_STATUSES = new Set([
  'No Offer Made Yet',
  'Made Written Offer On Property',
  'Seller Counter-Offered',
  'Monitoring Pending Status Before Offer',
  'Requires A Buyers Agent',
  'Made Verbal Offer On Property',
  'Monitoring Pending Status After Offer',
  'Monitoring Offer After Seller Declined',
  'Research',
]);

const UNDER_CONTRACT_STATUSES = new Set([
  'Seller Accepted Offer',
  'Agent Sending Contract',
  'Deal Under Contract',
]);

const DECLINED_STATUSES = new Set([
  'Listing Removed - Now Off Market',
  'Offer Declined',
  'Offer Declined and Sold',
  'Sold To Another Investor',
  'Priced Too High To Buy',
  'No Longer Interested In Buying',
  'Declined',
  'Deal No Longer Available',
]);

const CLOSED_STATUSES = new Set(['Deal Successfully Closed']);

const ACTIVE_STATUSES = new Set([...POTENTIAL_STATUSES, ...UNDER_CONTRACT_STATUSES]);

const timeframeEnum = z.enum(['today', 'week', 'month', 'year']);

export const getDashboardSchema = z.object({
  timeframe: timeframeEnum.default('week'),
  deals_added_timeframe: timeframeEnum.optional(),
  lois_timeframe: timeframeEnum.optional(),
  agent_texts_timeframe: timeframeEnum.optional(),
  owner_texts_timeframe: timeframeEnum.optional(),
  recent_deals_limit: z.number().int().min(1).max(50).default(10),
  upcoming_tasks_limit: z.number().int().min(1).max(50).default(20),
  activity_limit: z.number().int().min(1).max(50).default(20),
  include_chart: z.boolean().default(true),
}).strict();

export const getActivityFeedSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).max(100000).default(0),
  action_type: z.string().trim().min(1).max(100).optional(),
  entity_type: z.string().trim().min(1).max(100).optional(),
  entity_id: z.string().trim().min(1).max(200).optional(),
  user_id: z.string().trim().min(1).max(200).optional(),
  sent_text_to_agent_only: z.boolean().default(false),
  since: z.string().trim().min(1).max(100).optional(),
}).strict();

export const logActivitySchema = z.object({
  action_type: z.string().trim().min(1).max(100),
  entity_type: z.string().trim().min(1).max(100),
  entity_id: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  user_id: z.string().trim().min(1).max(200).optional(),
  user_name: z.string().trim().min(1).max(200).optional(),
  entity_display: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  group_updates: z.boolean().default(true),
  request_id: z.uuid().optional(),
}).strict();

export const dashboardReadTools = [
  {
    name: 'get_dashboard',
    description: 'Read live AZRE DealDesk Dashboard KPIs, 7-day trends, timeframe metrics (LOIs, agent/owner texts, deals added/removed/declined/canceled), 14-day chart series, recent deals, upcoming follow-up tasks, and recent activity feed.',
    schema: getDashboardSchema,
    write: false,
  },
  {
    name: 'get_activity_feed',
    description: 'Read the organization Activity Feed (activity_logs) ordered newest-first, with optional filters for action_type, entity_type, entity_id, user_id, sent_text_to_agent_only, and since timestamp.',
    schema: getActivityFeedSchema,
    write: false,
  },
];

export const dashboardWriteTools = [
  {
    name: 'log_activity',
    description: 'Write an entry to the DealDesk Activity Feed (activity_logs), automatically grouping consecutive UPDATE events for the same user and entity within 5 minutes.',
    schema: logActivitySchema,
    write: true,
  },
];

function startDateForTimeframe(timeframe, now = new Date()) {
  const startDate = new Date(now);
  if (timeframe === 'today') {
    startDate.setHours(0, 0, 0, 0);
  } else if (timeframe === 'week') {
    const day = startDate.getDay();
    const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
    startDate.setDate(diff);
    startDate.setHours(0, 0, 0, 0);
  } else if (timeframe === 'month') {
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
  } else if (timeframe === 'year') {
    startDate.setMonth(0, 1);
    startDate.setHours(0, 0, 0, 0);
  }
  return startDate;
}

function parseJson(val, fallback) {
  if (val == null) return fallback;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return fallback; }
  }
  return val;
}

async function fetchAllOrgRows(db, table, org, { excludeArchived = true, orderCol = 'id', ascending = true, maxRows = 10000, selectCols = '*' } = {}) {
  const pageSize = 1000;
  const rows = [];
  let offset = 0;

  while (rows.length < maxRows) {
    let q = scopeOrgQuery(db.from(table).select(selectCols), table, org);
    if (excludeArchived) q = q.is('pluginArchivedAt', null);
    const { data, error } = await q.order(orderCol, { ascending }).range(offset, offset + pageSize - 1);
    if (error) fail('DATABASE_ERROR', `Failed reading ${table} for dashboard.`);
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    offset += batch.length;
  }

  return rows;
}

function formatDateOnly(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
}

export async function executeGetActivityFeed(db, input, org) {
  const args = getActivityFeedSchema.parse(input || {});
  let q = db.from('activity_logs').select('*').eq('organization_id', org).is('pluginArchivedAt', null);

  if (args.sent_text_to_agent_only) {
    q = q.eq('action_type', 'UPDATE').eq('entity_type', 'AGENT');
  } else {
    if (args.action_type) q = q.eq('action_type', args.action_type);
    if (args.entity_type) q = q.eq('entity_type', args.entity_type);
  }
  if (args.entity_id) q = q.eq('entity_id', args.entity_id);
  if (args.user_id) q = q.eq('user_id', args.user_id);

  const needsPostFilter = args.sent_text_to_agent_only || Boolean(args.since);
  const sinceTime = args.since ? new Date(args.since).getTime() : null;
  if (args.since && !Number.isFinite(sinceTime)) {
    fail('INVALID_REQUEST', 'since must be a valid ISO date or timestamp.');
  }

  if (!needsPostFilter) {
    const { data, error } = await q.order('created_at', { ascending: false }).range(args.offset, args.offset + args.limit);
    if (error) fail('DATABASE_ERROR', 'Failed loading activity feed.');
    const rows = data || [];
    return {
      activities: rows.slice(0, args.limit).map(r => project('activity_logs', r)),
      next_offset: rows.length > args.limit ? args.offset + args.limit : null,
    };
  }

  const allMatching = [];
  let offset = 0;
  const batchSize = 500;
  while (true) {
    const { data, error } = await q.order('created_at', { ascending: false }).range(offset, offset + batchSize - 1);
    if (error) fail('DATABASE_ERROR', 'Failed loading activity feed.');
    const batch = data || [];
    for (const row of batch) {
      const meta = parseJson(row.metadata, {});
      if (args.sent_text_to_agent_only && meta?.sentTextToAgent !== true) continue;
      if (sinceTime !== null && new Date(row.created_at).getTime() < sinceTime) continue;
      allMatching.push(row);
    }
    if (batch.length < batchSize || allMatching.length >= args.offset + args.limit + 1) break;
    offset += batch.length;
  }

  const page = allMatching.slice(args.offset, args.offset + args.limit);
  return {
    activities: page.map(r => project('activity_logs', r)),
    next_offset: allMatching.length > args.offset + args.limit ? args.offset + args.limit : null,
  };
}

export async function executeLogActivity(db, input, org, actor = {}) {
  const args = logActivitySchema.parse(input || {});
  const userId = args.user_id || actor.userId || 'api-operator';
  const userName = args.user_name || actor.userName || 'DealDesk API';
  const metadata = args.metadata && typeof args.metadata === 'object' ? args.metadata : {};
  const now = new Date();

  if (args.action_type === 'UPDATE' && args.group_updates !== false) {
    const fiveMinutesAgo = now.getTime() - 5 * 60 * 1000;
    const { data: recentLogs, error: fetchError } = await db
      .from('activity_logs')
      .select('*')
      .eq('organization_id', org)
      .eq('user_id', userId)
      .eq('action_type', 'UPDATE')
      .eq('entity_type', args.entity_type)
      .eq('entity_id', args.entity_id)
      .is('pluginArchivedAt', null)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!fetchError && Array.isArray(recentLogs) && recentLogs.length > 0) {
      const candidate = recentLogs.find(log => new Date(log.created_at).getTime() >= fiveMinutesAgo);
      if (candidate) {
        const existingMeta = parseJson(candidate.metadata, {});
        const mergedMetadata = { ...existingMeta, ...metadata };
        const changedFields = Object.keys(mergedMetadata);
        const newDescription =
          changedFields.length > 0
            ? `Updated ${changedFields.join(', ')} on ${args.entity_display || candidate.entity_display || args.entity_type}`
            : args.description;

        const { data: updated, error: updateError } = await db
          .from('activity_logs')
          .update({
            description: newDescription,
            metadata: mergedMetadata,
            created_at: now.toISOString(),
            ...(args.entity_display !== undefined ? { entity_display: args.entity_display } : {}),
          })
          .eq('id', candidate.id)
          .eq('organization_id', org)
          .select('*');

        if (updateError) fail('DATABASE_ERROR', 'Failed grouping activity log update.');
        if (updated?.length === 1) {
          return { grouped: true, activity: project('activity_logs', updated[0]) };
        }
      }
    }
  }

  const row = {
    id: randomUUID(),
    organization_id: org,
    user_id: userId,
    user_name: userName,
    action_type: args.action_type,
    entity_type: args.entity_type,
    entity_id: args.entity_id,
    entity_display: args.entity_display || '',
    description: args.description,
    metadata,
    created_at: now.toISOString(),
  };

  const { data: inserted, error: insertError } = await db.from('activity_logs').insert(row).select('*');
  if (insertError || !inserted?.length) fail('DATABASE_ERROR', 'Failed recording activity log.');
  return { grouped: false, activity: project('activity_logs', inserted[0]) };
}

export async function executeGetDashboard(db, input, org) {
  const args = getDashboardSchema.parse(input || {});
  const now = new Date();

  const [deals, agents, buyers, offMarketProps, activityRows, pluginTasks, usersRows] = await Promise.all([
    fetchAllOrgRows(db, 'Deals', org),
    fetchAllOrgRows(db, 'Agents', org),
    fetchAllOrgRows(db, 'Buyers', org),
    fetchAllOrgRows(db, 'OffMarketProperties', org, { maxRows: 10000 }),
    fetchAllOrgRows(db, 'activity_logs', org, { orderCol: 'created_at', ascending: false, maxRows: 1000 }),
    fetchAllOrgRows(db, 'PluginTasks', org),
    fetchAllOrgRows(db, 'Users', org, { selectCols: 'id,name,position,loginStatus' }),
  ]);

  // Users summary (never expose password or signature)
  const usersSummary = usersRows.map(u => ({
    id: u.id,
    name: u.name,
    position: u.position || null,
    loginStatus: u.loginStatus || null,
  }));

  // 1. KPIs + 7-day trends (matching Dashboard.tsx)
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const getDealsInPeriod = (start, end) =>
    deals.filter(d => {
      const date = new Date(d.createdAt || now);
      return date >= start && date < end;
    });
  const currentPeriodDeals = getDealsInPeriod(oneWeekAgo, now);
  const previousPeriodDeals = getDealsInPeriod(twoWeeksAgo, oneWeekAgo);

  const totalDeals = deals.filter(d => ACTIVE_STATUSES.has(d.offerDecision)).length;
  const totalTrend =
    currentPeriodDeals.filter(d => ACTIVE_STATUSES.has(d.offerDecision)).length -
    previousPeriodDeals.filter(d => ACTIVE_STATUSES.has(d.offerDecision)).length;

  const underContract = deals.filter(d => UNDER_CONTRACT_STATUSES.has(d.offerDecision)).length;
  const ucTrend =
    currentPeriodDeals.filter(d => UNDER_CONTRACT_STATUSES.has(d.offerDecision)).length -
    previousPeriodDeals.filter(d => UNDER_CONTRACT_STATUSES.has(d.offerDecision)).length;

  const closedDeals = deals.filter(d => CLOSED_STATUSES.has(d.offerDecision)).length;
  const closedTrend =
    currentPeriodDeals.filter(d => CLOSED_STATUSES.has(d.offerDecision)).length -
    previousPeriodDeals.filter(d => CLOSED_STATUSES.has(d.offerDecision)).length;

  const sumRevenue = list =>
    list
      .filter(d => ACTIVE_STATUSES.has(d.offerDecision))
      .reduce((sum, d) => sum + (Number(d.desiredWholesaleProfit) || 0), 0);

  const potentialRevenue = sumRevenue(deals);
  const revenueTrend = sumRevenue(currentPeriodDeals) - sumRevenue(previousPeriodDeals);

  // 2. Timeframe Metrics
  const dealsTf = args.deals_added_timeframe || args.timeframe;
  const loisTf = args.lois_timeframe || args.timeframe;
  const agentTextsTf = args.agent_texts_timeframe || args.timeframe;
  const ownerTextsTf = args.owner_texts_timeframe || args.timeframe;

  const dealsStart = startDateForTimeframe(dealsTf, now);
  const dealsAddedCount = deals.filter(d => new Date(d.createdAt || now) >= dealsStart).length;
  const listingsRemovedCount = deals.filter(
    d => d.offerDecision === 'Listing Removed - Now Off Market' && new Date(d.createdAt || now) >= dealsStart,
  ).length;
  const offersDeclinedCount = deals.filter(
    d => (d.offerDecision === 'Offer Declined' || d.offerDecision === 'Offer Declined and Sold') && new Date(d.createdAt || now) >= dealsStart,
  ).length;
  const dealCanceledCount = deals.filter(
    d => (d.offerDecision === 'Deal Canceled' || d.offerDecision === 'Canceled') && new Date(d.createdAt || now) >= dealsStart,
  ).length;

  const loisStart = startDateForTimeframe(loisTf, now);
  const loiSentByUser = Object.fromEntries(usersSummary.map(u => [u.name, 0]));
  let totalLoisSent = 0;

  for (const d of deals) {
    const hasLoi = d.loiSent || d.offerDecision === 'Made Written Offer On Property';
    if (!hasLoi) continue;
    let dateToUseStr = d.loiSentDate || d.createdAt;
    let sentBy = d.loiSentBy || d.acquisitionManager || 'Unknown User';
    const tracking = parseJson(d.offerDecisionTracking, []);
    if (Array.isArray(tracking) && tracking.length > 0) {
      const match = tracking.find(t => t.status === 'Made Written Offer On Property');
      if (match) {
        dateToUseStr = match.date || dateToUseStr;
        sentBy = match.user || sentBy;
      }
    }
    const dateToUse = dateToUseStr ? new Date(dateToUseStr) : now;
    if (dateToUse >= loisStart) {
      const dispo = parseJson(d.dispo, {});
      const weight = Math.max(1, Array.isArray(dispo?.loiSentAgents) ? dispo.loiSentAgents.length : 1);
      totalLoisSent += weight;
      loiSentByUser[sentBy] = (loiSentByUser[sentBy] || 0) + weight;
    }
  }

  const agentTextsStart = startDateForTimeframe(agentTextsTf, now);
  const agentTextsSentByUser = Object.fromEntries(usersSummary.map(u => [u.name, 0]));
  let totalAgentTextsSent = 0;
  let agentConversationsCount = 0;

  for (const a of agents) {
    const relDates = parseJson(a.agentRelationshipDates, {});
    const textDateStr = relDates?.sentTextToAgent || a.sentTextToAgentDate;
    if (textDateStr && new Date(textDateStr) >= agentTextsStart) {
      totalAgentTextsSent += 1;
      const sentBy = a.acquisitionManager || 'Unknown User';
      agentTextsSentByUser[sentBy] = (agentTextsSentByUser[sentBy] || 0) + 1;
    }
    const spokeDateStr = relDates?.spokeWithAgent || a.spokeWithAgentDate;
    if (spokeDateStr && new Date(spokeDateStr) >= agentTextsStart) {
      agentConversationsCount += 1;
    }
  }

  const ownerTextsStart = startDateForTimeframe(ownerTextsTf, now);
  const ownerTextsSentByUser = Object.fromEntries(usersSummary.map(u => [u.name, 0]));
  const propMap = new Map(offMarketProps.map(p => [String(p.id), p]));
  let totalOwnerTextsSent = 0;
  let ownerConversationsCount = 0;

  for (const p of offMarketProps) {
    if (p['Text Message Sent'] === true && p['TMS Date and Time'] && new Date(p['TMS Date and Time']) >= ownerTextsStart) {
      totalOwnerTextsSent += 1;
    }
    if (p['Owner Called'] === true && p['Called Date and Time'] && new Date(p['Called Date and Time']) >= ownerTextsStart) {
      ownerConversationsCount += 1;
    }
  }

  const seenPropertyIds = new Set();
  for (const log of activityRows) {
    if (log.action_type !== 'OWNER_TEXT_SENT') continue;
    const entityId = String(log.entity_id || '');
    const matchedProp = entityId ? propMap.get(entityId) : undefined;
    if (entityId) {
      if (seenPropertyIds.has(entityId)) continue;
      if (matchedProp && matchedProp['Text Message Sent'] !== true) continue;
      seenPropertyIds.add(entityId);
    }
    const meta = parseJson(log.metadata, {});
    const dateStr = matchedProp?.['TMS Date and Time'] || meta?.tmsDateTime || log.created_at;
    if (!dateStr) continue;
    if (new Date(dateStr) >= ownerTextsStart) {
      const sentBy = log.user_name || 'Unknown User';
      ownerTextsSentByUser[sentBy] = (ownerTextsSentByUser[sentBy] || 0) + 1;
    }
  }

  // 3. Chart Data (14 days)
  const chartData = [];
  if (args.include_chart) {
    for (let i = 13; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 1);
      const dealsInDay = deals.filter(d => {
        const dDate = new Date(d.createdAt || now);
        return dDate >= date && dDate < nextDate;
      });
      chartData.push({
        name: formatDateOnly(date),
        Potential: dealsInDay.filter(d => POTENTIAL_STATUSES.has(d.offerDecision)).length,
        UnderContract: dealsInDay.filter(d => UNDER_CONTRACT_STATUSES.has(d.offerDecision)).length,
        Closed: dealsInDay.filter(d => CLOSED_STATUSES.has(d.offerDecision)).length,
        Declined: dealsInDay.filter(d => DECLINED_STATUSES.has(d.offerDecision)).length,
      });
    }
  }

  // 4. Recent Deals
  const recentDeals = [...deals]
    .filter(d => !d.pipelineType || ['mls', 'off-market', 'dfd', 'azre-queue'].includes(d.pipelineType))
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, args.recent_deals_limit)
    .map(d => ({ ...project('Deals', d), _revision: d.pluginRevision }));

  // 5. Upcoming Tasks (Agent follow-ups + Buyer follow-ups + open PluginTasks)
  const todayMidnight = new Date(now);
  todayMidnight.setHours(0, 0, 0, 0);
  const upcomingTasks = [];

  for (const agent of agents) {
    if (!agent.nextFollowUpDate) continue;
    const d = new Date(agent.nextFollowUpDate);
    if (Number.isFinite(d.getTime()) && d >= todayMidnight) {
      upcomingTasks.push({
        id: agent.id,
        title: `Follow up with ${agent.name}`,
        date: d.toISOString(),
        type: 'agent',
      });
    }
  }
  for (const buyer of buyers) {
    if (!buyer.nextFollowUpDate) continue;
    const d = new Date(buyer.nextFollowUpDate);
    if (Number.isFinite(d.getTime()) && d >= todayMidnight) {
      upcomingTasks.push({
        id: buyer.id,
        title: `Follow up with buyer ${buyer.name}`,
        date: d.toISOString(),
        type: 'buyer',
      });
    }
  }
  for (const task of pluginTasks) {
    if (task.status !== 'Open' || !task.dueDate) continue;
    const d = new Date(task.dueDate);
    if (Number.isFinite(d.getTime()) && d >= todayMidnight) {
      upcomingTasks.push({
        id: task.id,
        title: task.title,
        date: d.toISOString(),
        type: 'task',
        entityType: task.entityType,
        entityId: task.entityId,
        priority: task.priority || 'Normal',
      });
    }
  }
  upcomingTasks.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // 6. Recent Activity
  const recentActivity = activityRows
    .slice(0, args.activity_limit)
    .map(r => project('activity_logs', r));

  return {
    kpis: {
      totalDeals,
      totalTrend,
      underContract,
      ucTrend,
      closedDeals,
      closedTrend,
      potentialRevenue,
      revenueTrend,
    },
    timeframeMetrics: {
      timeframe: args.timeframe,
      dealsAddedCount,
      listingsRemovedCount,
      offersDeclinedCount,
      dealCanceledCount,
      totalLoisSent,
      loiSentByUser,
      totalAgentTextsSent,
      agentTextsSentByUser,
      agentConversationsCount,
      totalOwnerTextsSent,
      ownerTextsSentByUser,
      ownerConversationsCount,
    },
    ...(args.include_chart ? { chartData } : {}),
    recentDeals,
    upcomingTasks: upcomingTasks.slice(0, args.upcoming_tasks_limit),
    recentActivity,
    usersSummary: {
      totalUsers: usersSummary.length,
      users: usersSummary,
    },
  };
}
