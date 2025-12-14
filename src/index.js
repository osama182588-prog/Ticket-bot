import 'dotenv/config';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  ModalBuilder,
  PermissionsBitField,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import crypto from 'crypto';
import { commands } from './commands.js';
import { statusOptions, ticketTypes, typeColors } from './constants.js';
import { getState, updateState } from './state.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const commandHandlers = {
  'إنشاء-داشبورد': handleCreateDashboard,
  'إضافة-زر': handleAddButton,
  'عرض-الداشبوردات': handleListDashboards,
  'حذف-زر': handleRemoveButton,
  'ربط-رتبة-بنوع': handleLinkRole,
  'عرض-الأدوار-لنوع': handleShowRoles,
  'حذف-رتبة-من-نوع': handleRemoveRole,
  'إلغاء-الاستلام': handleUnclaim,
  'نقل-التذكرة': handleTransfer,
  'تغيير-حالة-التذكرة': handleChangeStatus,
  'إضافة-وسم': handleAddTag,
  'حذف-وسم': handleRemoveTag,
  'إعداد-أولي': handleInitialSetup,
  'إعدادات-الاستلام': handleClaimSettings,
  'إعدادات-الإغلاق-التلقائي': handleAutoCloseSettings,
  'إعدادات-التذكير': handleReminderSettings,
  'تبديل-وضع-النظام': handleModeSwitch,
  'بحث-تذكرة': handleSearchTickets,
  'تذاكري': handleMyTickets,
  'ملف-دعم': handleSupportProfile,
  'تقارير-التذاكر': handleTicketReports,
  'فتح-تذكرة': handleSlashOpenTicket,
  'إغلاق-تذكرتي': handleCloseTicketCommand,
  'مركز-المساعدة': handleHelpCenter,
  'إعدادات-الحدود': handleLimitsSettings,
  'حظر-من-التذاكر': handleBanUser,
  'إلغاء-حظر-التذاكر': handleUnbanUser,
  'قائمة-المحظورين-من-التذاكر': handleListBanned,
  'ملاحظة-داخلية': handleInternalNote
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MINUTE_IN_MS = 60 * 1000;
const HALF_HOUR_MS = 30 * MINUTE_IN_MS;
const MAX_TICKETS_PER_CYCLE = 200;
let autoCloseCursor = 0;

const sanitizeChannelFragment = (text) =>
  (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  startAutoCloseLoop();
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const handler = commandHandlers[interaction.commandName];
      if (!handler) return;
      await handler(interaction);
    } else if (interaction.isButton()) {
      await handleButton(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModal(interaction);
    }
  } catch (error) {
    console.error('Interaction error', error);
    if (interaction.isRepliable()) {
      const content = 'حدث خطأ غير متوقع أثناء تنفيذ الأمر.';
      if (interaction.replied || interaction.deferred) {
        interaction.followUp({ content, ephemeral: true }).catch(() => {});
      } else {
        interaction.reply({ content, ephemeral: true }).catch(() => {});
      }
    }
  }
});

client.on('messageCreate', (message) => {
  if (message.author.bot) return;
  const ticket = getState().tickets[message.channel.id];
  if (!ticket) return;
  updateState((state) => {
    const target = state.tickets[message.channel.id];
    if (!target) return;
    target.lastActivityAt = Date.now();
  });
});

client.login(process.env.TOKEN || process.env.DISCORD_TOKEN);

// Helpers
function findDashboard(identifier) {
  const state = getState();
  return state.dashboards.find(
    (dash) =>
      dash.id === identifier ||
      dash.name === identifier ||
      dash.name.toLowerCase() === identifier.toLowerCase()
  );
}

async function renderDashboard(dashboard) {
  const state = getState();
  const channel = await client.channels.fetch(dashboard.channelId).catch(() => null);
  if (!channel) return;
  const embed = new EmbedBuilder()
    .setTitle(`لوحة ${dashboard.name}`)
    .setColor(0x00b894)
    .setDescription('اختر نوع التذكرة المناسب من الأزرار بالأسفل.')
    .addFields({
      name: 'عدد الأزرار',
      value: `${dashboard.buttons.length}`,
      inline: true
    });
  const rows = [];
  const buttons = dashboard.buttons.map((btn) => {
    const builder = new ButtonBuilder()
      .setCustomId(`ticket-open:${dashboard.id}:${btn.id}`)
      .setLabel(btn.label)
      .setStyle(ButtonStyle.Primary);
    if (btn.emoji) builder.setEmoji(btn.emoji);
    return builder;
  });
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }
  const payload = { embeds: [embed], components: rows };
  if (dashboard.messageId) {
    const message = await channel.messages.fetch(dashboard.messageId).catch(() => null);
    if (message) {
      await message.edit(payload);
      return;
    }
  }
  const msg = await channel.send(payload);
  updateState((state) => {
    const dash = state.dashboards.find((d) => d.id === dashboard.id);
    if (dash) dash.messageId = msg.id;
  });
}

function hasPermissionForType(member, type) {
  const state = getState();
  if (state.settings.adminRoleId && member.roles.cache.has(state.settings.adminRoleId)) {
    return true;
  }
  const roles = state.typeRoles[type] || [];
  return roles.some((roleId) => member.roles.cache.has(roleId));
}

function logTimeline(ticket, by, action, note) {
  ticket.timeline = ticket.timeline || [];
  ticket.timeline.push({
    at: Date.now(),
    by,
    action,
    note
  });
}

async function sendTicketLog(ticket, message) {
  const state = getState();
  const channelId = ticket.logChannelId || state.settings.defaultLogChannelId;
  if (!channelId) return;
  const logChannel = await client.channels.fetch(channelId).catch(() => null);
  if (!logChannel || !logChannel.isTextBased()) return;
  const embed = new EmbedBuilder()
    .setTitle(`لوغ تذكرة ${ticket.type}`)
    .setDescription(message)
    .addFields(
      { name: 'العضو', value: `<@${ticket.userId}>`, inline: true },
      { name: 'الحالة', value: ticket.status, inline: true }
    )
    .setColor(typeColors[ticket.type] || 0x2ecc71)
    .setTimestamp();
  logChannel.send({ embeds: [embed] }).catch(() => {});
}

async function logConfigChange(description) {
  const state = getState();
  if (!state.settings.configLogChannelId) return;
  const channel = await client.channels.fetch(state.settings.configLogChannelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;
  const embed = new EmbedBuilder()
    .setTitle('تعديل إعدادات التذاكر')
    .setDescription(description)
    .setColor(0xf39c12)
    .setTimestamp();
  channel.send({ embeds: [embed] }).catch(() => {});
}

function enforceSpam(userId) {
  const state = getState();
  const now = Date.now();
  const tracker = state.spamTracker[userId] || { opened: [] };
  tracker.opened = (tracker.opened || []).filter((ts) => now - ts < DAY_IN_MS);
  if (tracker.opened.length >= (state.settings.spam.dailyLimit || 3)) {
    return 'لقد وصلت للحد اليومي لفتح التذاكر.';
  }
  if (
    tracker.lastOpenedAt &&
    now - tracker.lastOpenedAt < (state.settings.spam.cooldownMinutes || 15) * MINUTE_IN_MS
  ) {
    return 'الرجاء الانتظار قبل فتح تذكرة جديدة.';
  }
  tracker.lastOpenedAt = now;
  tracker.opened.push(now);
  updateState((draft) => {
    draft.spamTracker[userId] = tracker;
  });
  return null;
}

function getTicket(channelId) {
  return getState().tickets[channelId];
}

async function refreshTicketMessage(ticket, state = getState()) {
  const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;
  const message = ticket.messageId
    ? await channel.messages.fetch(ticket.messageId).catch(() => null)
    : null;
  const embed = new EmbedBuilder()
    .setTitle(`تذكرة ${ticket.type}`)
    .setColor(typeColors[ticket.type] || 0x2ecc71)
    .setDescription(ticket.details || 'لا توجد تفاصيل إضافية.')
    .addFields(
      { name: 'صاحب التذكرة', value: `<@${ticket.userId}>`, inline: true },
      { name: 'الحالة', value: ticket.status, inline: true },
      { name: 'الوسوم', value: ticket.tags?.join('، ') || 'بدون', inline: false }
    )
    .setFooter({ text: 'نظام تذاكر عربي متقدم' })
    .setTimestamp();
  if (ticket.assignedTo) {
    embed.addFields({ name: 'المستلم', value: `<@${ticket.assignedTo}>`, inline: true });
  }
  const claimButton = new ButtonBuilder()
    .setCustomId('ticket-claim')
    .setLabel('📥 استلام التذكرة')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(Boolean(ticket.assignedTo && state.settings.claim.hideAfterClaim));
  const closeButton = new ButtonBuilder()
    .setCustomId('ticket-close')
    .setLabel('إغلاق التذكرة')
    .setStyle(ButtonStyle.Danger);
  const timelineButton = new ButtonBuilder()
    .setCustomId('ticket-timeline')
    .setLabel('المخطط الزمني')
    .setStyle(ButtonStyle.Secondary);
  const components = [new ActionRowBuilder().addComponents(claimButton, closeButton, timelineButton)];
  if (message) {
    await message.edit({ embeds: [embed], components });
  } else {
    const sent = await channel.send({ embeds: [embed], components });
    updateState((state) => {
      const t = state.tickets[ticket.channelId];
      if (t) t.messageId = sent.id;
    });
  }
}

async function closeTicket(channelId, closedBy, reason = 'إغلاق التذكرة') {
  const ticket = getTicket(channelId);
  if (!ticket || ticket.status === 'مغلقة') return;
  updateState((state) => {
    const target = state.tickets[channelId];
    if (!target) return;
    target.status = 'مغلقة';
    target.closedAt = Date.now();
    target.lastActivityAt = Date.now();
    logTimeline(target, closedBy, 'إغلاق', reason);
  });
  const updated = getTicket(channelId);
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (channel) {
    const perms = [
      { id: channel.guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: updated.userId, deny: [PermissionsBitField.Flags.SendMessages] }
    ];
    const state = getState();
    const roles = state.typeRoles[updated.type] || [];
    roles.forEach((roleId) =>
      perms.push({ id: roleId, allow: [PermissionsBitField.Flags.ViewChannel] })
    );
    if (state.settings.adminRoleId) {
      perms.push({ id: state.settings.adminRoleId, allow: [PermissionsBitField.Flags.ViewChannel] });
    }
    await channel.permissionOverwrites.set(perms).catch(() => {});
    await channel.send({
      content: `تم إغلاق التذكرة. السبب: ${reason} - ${closedBy ? `<@${closedBy}>` : ''}`
    });
  }
  const stateAfterClose = getState();
  await sendTicketLog(updated, `تم إغلاق التذكرة بواسطة ${closedBy ? `<@${closedBy}>` : 'النظام'}`);
  await refreshTicketMessage(updated, stateAfterClose);
}

function ensureTicketChannel(interaction) {
  const ticket = getTicket(interaction.channelId);
  if (!ticket) {
    interaction.reply({ content: 'هذا الأمر يعمل داخل قناة تذكرة فقط.', ephemeral: true });
    return null;
  }
  return ticket;
}

async function handleButton(interaction) {
  const [action, dashboardId, buttonId] = interaction.customId.split(':');
  if (action === 'ticket-open') {
    const state = getState();
    if (state.bannedUsers[interaction.user.id]) {
      return interaction.reply({
        content: 'تم حظرك من فتح التذاكر.',
        ephemeral: true
      });
    }
    const banReason = enforceSpam(interaction.user.id);
    if (banReason) {
      return interaction.reply({ content: banReason, ephemeral: true });
    }
    const dashboard = findDashboard(dashboardId);
    const button = dashboard?.buttons.find((b) => b.id === buttonId);
    if (!dashboard || !button) {
      return interaction.reply({ content: 'هذا الزر لم يعد متاحاً.', ephemeral: true });
    }
    const modal = new ModalBuilder()
      .setCustomId(`ticket-open:${dashboardId}:${buttonId}`)
      .setTitle(`فتح تذكرة: ${button.label}`);
    const subject = new TextInputBuilder()
      .setCustomId('الموضوع')
      .setLabel('الموضوع')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);
    const details = new TextInputBuilder()
      .setCustomId('الوصف')
      .setLabel('الوصف')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);
    modal.addComponents(
      new ActionRowBuilder().addComponents(subject),
      new ActionRowBuilder().addComponents(details)
    );
    return interaction.showModal(modal);
  }
  if (interaction.customId === 'ticket-claim') {
    const ticket = ensureTicketChannel(interaction);
    if (!ticket) return;
    const member = interaction.member;
    if (!hasPermissionForType(member, ticket.type)) {
      return interaction.reply({ content: 'ليس لديك صلاحية استلام هذه التذكرة.', ephemeral: true });
    }
    updateState((state) => {
      const t = state.tickets[interaction.channelId];
      if (!t) return;
      if (t.assignedTo && t.assignedTo !== interaction.user.id) return;
      t.assignedTo = interaction.user.id;
      logTimeline(t, interaction.user.id, 'استلام', 'تم استلام التذكرة');
    });
    const state = getState();
    const updatedTicket = state.tickets[interaction.channelId];
    await interaction.reply({ content: 'تم استلام التذكرة.', ephemeral: true });
    await refreshTicketMessage(updatedTicket, state);
    await sendTicketLog(updatedTicket, `تم استلام التذكرة بواسطة <@${interaction.user.id}>`);
    return;
  }
  if (interaction.customId === 'ticket-close') {
    const ticket = ensureTicketChannel(interaction);
    if (!ticket) return;
    if (interaction.user.id !== ticket.userId && !hasPermissionForType(interaction.member, ticket.type)) {
      return interaction.reply({ content: 'لا يمكنك إغلاق هذه التذكرة.', ephemeral: true });
    }
    await closeTicket(interaction.channelId, interaction.user.id, 'تم الإغلاق عبر الزر');
    return interaction.reply({ content: 'تم إغلاق التذكرة.', ephemeral: true });
  }
  if (interaction.customId === 'ticket-timeline') {
    const ticket = ensureTicketChannel(interaction);
    if (!ticket) return;
    const locale = getState().settings.locale || 'ar-EG';
    const lines = (ticket.timeline || []).slice(-15).map((item) => {
      const date = new Date(item.at).toLocaleString(locale);
      return `• ${date} - ${item.action}${item.by ? ` بواسطة <@${item.by}>` : ''}${item.note ? ` (${item.note})` : ''}`;
    });
    return interaction.reply({
      content: lines.join('\n') || 'لا يوجد سجل زمني بعد.',
      ephemeral: true
    });
  }
}

async function handleModal(interaction) {
  if (!interaction.customId.startsWith('ticket-open:')) return;
  const [, dashboardId, buttonId] = interaction.customId.split(':');
  const dashboard = findDashboard(dashboardId);
  const button = dashboard?.buttons.find((b) => b.id === buttonId);
  if (!dashboard || !button) {
    return interaction.reply({ content: 'تعذر تحديد الزر.', ephemeral: true });
  }
  const state = getState();
  if (state.bannedUsers[interaction.user.id]) {
    return interaction.reply({ content: 'تم حظرك من فتح التذاكر.', ephemeral: true });
  }
  const spam = enforceSpam(interaction.user.id);
  if (spam) return interaction.reply({ content: spam, ephemeral: true });
  const subject = interaction.fields.getTextInputValue('الموضوع');
  const description = interaction.fields.getTextInputValue('الوصف');
  await openTicket({
    interaction,
    type: button.type,
    details: `**${subject}**\n${description}`,
    dashboardId,
    buttonId,
    logChannelId: button.logChannelId
  });
}

async function openTicket({ interaction, type, details, dashboardId, buttonId, logChannelId }) {
  const state = getState();
  if (!ticketTypes.includes(type)) {
    return interaction.reply({ content: 'نوع التذكرة غير مدعوم.', ephemeral: true });
  }
  const existing = Object.values(state.tickets).find(
    (t) => t.userId === interaction.user.id && t.status !== 'مغلقة'
  );
  if (existing) {
    return interaction.reply({
      content: 'لديك تذكرة مفتوحة بالفعل. الرجاء إغلاقها أولاً.',
      ephemeral: true
    });
  }
  const guild = interaction.guild;
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory
      ]
    }
  ];
  const roles = state.typeRoles[type] || [];
  roles.forEach((roleId) =>
    overwrites.push({
      id: roleId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory
      ]
    })
  );
  if (state.settings.adminRoleId) {
    overwrites.push({
      id: state.settings.adminRoleId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory
      ]
    });
  }
  const safeUser = sanitizeChannelFragment(interaction.user.username) || interaction.user.id;
  const safeType = sanitizeChannelFragment(type) || 'ticket';
  const channelName = `ticket-${safeUser}-${safeType}`.slice(0, 90);
  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    permissionOverwrites: overwrites
  });
  const ticketData = {
    id: crypto.randomUUID(),
    channelId: channel.id,
    userId: interaction.user.id,
    type,
    details,
    status: 'مفتوحة',
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    assignedTo: null,
    dashboardId,
    buttonId,
    logChannelId: logChannelId || state.settings.defaultLogChannelId,
    tags: [],
    remindersSent: 0,
    timeline: []
  };
  logTimeline(ticketData, interaction.user.id, 'فتح', 'تم إنشاء التذكرة');
  updateState((draft) => {
    draft.tickets[channel.id] = ticketData;
  });
  const currentState = getState();
  await refreshTicketMessage(ticketData, currentState);
  await interaction.reply({
    content: `تم إنشاء تذكرة جديدة في <#${channel.id}>`,
    ephemeral: true
  });
  await sendTicketLog(ticketData, `تم فتح تذكرة جديدة بواسطة <@${interaction.user.id}>`);
}

// Command handlers
async function handleCreateDashboard(interaction) {
  const name = interaction.options.getString('اسم_الداشبورد', true);
  const channel = interaction.options.getChannel('الروم', true);
  const dashboard = {
    id: crypto.randomUUID(),
    name,
    channelId: channel.id,
    buttons: []
  };
  updateState((state) => {
    state.dashboards.push(dashboard);
  });
  await renderDashboard(dashboard);
  await interaction.reply({ content: 'تم إنشاء الداشبورد وإرساله.', ephemeral: true });
  await logConfigChange(`تم إنشاء داشبورد ${name} في <#${channel.id}> بواسطة <@${interaction.user.id}>`);
}

async function handleAddButton(interaction) {
  const identifier = interaction.options.getString('الداشبورد', true);
  const dash = findDashboard(identifier);
  if (!dash) {
    return interaction.reply({ content: 'لم يتم العثور على الداشبورد.', ephemeral: true });
  }
  const label = interaction.options.getString('اسم_الزر', true);
  const emoji = interaction.options.getString('الإيموجي', false);
  const type = interaction.options.getString('نوع_التذكرة', true);
  const logChannel = interaction.options.getChannel('روم_اللوغ', false);
  const button = { id: crypto.randomUUID(), label, emoji, type, logChannelId: logChannel?.id || null };
  updateState((state) => {
    const target = state.dashboards.find((d) => d.id === dash.id);
    if (target) target.buttons.push(button);
  });
  await renderDashboard({ ...dash, buttons: [...dash.buttons, button] });
  await interaction.reply({ content: 'تمت إضافة الزر للوحة.', ephemeral: true });
  await logConfigChange(
    `تمت إضافة زر "${label}" لنوع ${type} في الداشبورد ${dash.name} بواسطة <@${interaction.user.id}>`
  );
}

async function handleListDashboards(interaction) {
  const state = getState();
  if (!state.dashboards.length) {
    return interaction.reply({ content: 'لا توجد داشبوردات بعد.', ephemeral: true });
  }
  const embed = new EmbedBuilder().setTitle('الداشبوردات').setColor(0x3498db);
  state.dashboards.forEach((dash) => {
    embed.addFields({
      name: dash.name,
      value: `القناة: <#${dash.channelId}>\nالأزرار: ${dash.buttons.length}`,
      inline: false
    });
  });
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleRemoveButton(interaction) {
  const identifier = interaction.options.getString('الداشبورد', true);
  const buttonName = interaction.options.getString('اسم_الزر', true);
  const dash = findDashboard(identifier);
  if (!dash) return interaction.reply({ content: 'الداشبورد غير موجود.', ephemeral: true });
  const before = dash.buttons.length;
  updateState((state) => {
    const target = state.dashboards.find((d) => d.id === dash.id);
    if (!target) return;
    target.buttons = target.buttons.filter(
      (b) => b.id !== buttonName && b.label !== buttonName
    );
  });
  const after = getState().dashboards.find((d) => d.id === dash.id)?.buttons.length || 0;
  await renderDashboard(findDashboard(dash.id));
  await interaction.reply({
    content: before === after ? 'لم يتم العثور على الزر.' : 'تم حذف الزر.',
    ephemeral: true
  });
  if (before !== after) {
    await logConfigChange(
      `تم حذف زر "${buttonName}" من الداشبورد ${dash.name} بواسطة <@${interaction.user.id}>`
    );
  }
}

async function handleLinkRole(interaction) {
  const type = interaction.options.getString('نوع_التذكرة', true);
  const role = interaction.options.getRole('الرتبة', true);
  updateState((state) => {
    state.typeRoles[type] = Array.from(new Set([...(state.typeRoles[type] || []), role.id]));
  });
  await interaction.reply({
    content: `تم ربط ${role} بنوع ${type}.`,
    ephemeral: true
  });
  await logConfigChange(
    `تم ربط الرتبة ${role} بنوع ${type} بواسطة <@${interaction.user.id}>`
  );
}

async function handleShowRoles(interaction) {
  const type = interaction.options.getString('نوع_التذكرة', true);
  const roles = (getState().typeRoles[type] || []).map((id) => `<@&${id}>`).join('، ');
  await interaction.reply({
    content: roles || 'لا توجد رتب مرتبطة بعد.',
    ephemeral: true
  });
}

async function handleRemoveRole(interaction) {
  const type = interaction.options.getString('نوع_التذكرة', true);
  const role = interaction.options.getRole('الرتبة', true);
  updateState((state) => {
    state.typeRoles[type] = (state.typeRoles[type] || []).filter((id) => id !== role.id);
  });
  await interaction.reply({ content: 'تم حذف الربط.', ephemeral: true });
  await logConfigChange(
    `تم حذف الرتبة ${role} من نوع ${type} بواسطة <@${interaction.user.id}>`
  );
}

async function handleUnclaim(interaction) {
  const ticket = ensureTicketChannel(interaction);
  if (!ticket) return;
  const member = interaction.member;
  if (
    ticket.assignedTo &&
    ticket.assignedTo !== interaction.user.id &&
    !hasPermissionForType(member, ticket.type)
  ) {
    return interaction.reply({ content: 'لا يمكنك إلغاء الاستلام.', ephemeral: true });
  }
  updateState((state) => {
    const t = state.tickets[interaction.channelId];
    if (t) {
      t.assignedTo = null;
      logTimeline(t, interaction.user.id, 'إلغاء الاستلام', 'تم إلغاء الاستلام');
    }
  });
  const state = getState();
  await refreshTicketMessage(state.tickets[interaction.channelId], state);
  await interaction.reply({ content: 'تم إلغاء الاستلام.', ephemeral: true });
}

async function handleTransfer(interaction) {
  const ticket = ensureTicketChannel(interaction);
  if (!ticket) return;
  if (!hasPermissionForType(interaction.member, ticket.type)) {
    return interaction.reply({ content: 'لا تملك صلاحية نقل التذكرة.', ephemeral: true });
  }
  const target = interaction.options.getUser('الموظف_الجديد', true);
  updateState((state) => {
    const t = state.tickets[interaction.channelId];
    if (t) {
      t.assignedTo = target.id;
      logTimeline(t, interaction.user.id, 'نقل', `تم النقل إلى ${target.id}`);
    }
  });
  const state = getState();
  await refreshTicketMessage(state.tickets[interaction.channelId], state);
  await interaction.reply({ content: `تم نقل التذكرة إلى ${target}.`, ephemeral: true });
  await sendTicketLog(state.tickets[interaction.channelId], `تم نقل التذكرة إلى <@${target.id}>`);
}

async function handleChangeStatus(interaction) {
  const ticket = ensureTicketChannel(interaction);
  if (!ticket) return;
  if (!hasPermissionForType(interaction.member, ticket.type)) {
    return interaction.reply({ content: 'لا تملك صلاحية تغيير الحالة.', ephemeral: true });
  }
  const status = interaction.options.getString('الحالة', true);
  if (!statusOptions.includes(status)) {
    return interaction.reply({ content: 'حالة غير مدعومة.', ephemeral: true });
  }
  updateState((state) => {
    const t = state.tickets[interaction.channelId];
    if (t) {
      t.status = status;
      logTimeline(t, interaction.user.id, 'حالة', status);
    }
  });
  const state = getState();
  await refreshTicketMessage(state.tickets[interaction.channelId], state);
  await interaction.reply({ content: 'تم تحديث الحالة.', ephemeral: true });
  await sendTicketLog(state.tickets[interaction.channelId], `تم تغيير الحالة إلى ${status}`);
}

async function handleAddTag(interaction) {
  const ticket = ensureTicketChannel(interaction);
  if (!ticket) return;
  const tag = interaction.options.getString('الوسم', true);
  updateState((state) => {
    const t = state.tickets[interaction.channelId];
    if (!t) return;
    t.tags = Array.from(new Set([...(t.tags || []), tag]));
    logTimeline(t, interaction.user.id, 'إضافة وسم', tag);
  });
  const state = getState();
  await refreshTicketMessage(state.tickets[interaction.channelId], state);
  await interaction.reply({ content: 'تمت إضافة الوسم.', ephemeral: true });
}

async function handleRemoveTag(interaction) {
  const ticket = ensureTicketChannel(interaction);
  if (!ticket) return;
  const tag = interaction.options.getString('الوسم', true);
  updateState((state) => {
    const t = state.tickets[interaction.channelId];
    if (!t) return;
    t.tags = (t.tags || []).filter((item) => item !== tag);
    logTimeline(t, interaction.user.id, 'حذف وسم', tag);
  });
  const state = getState();
  await refreshTicketMessage(state.tickets[interaction.channelId], state);
  await interaction.reply({ content: 'تم حذف الوسم.', ephemeral: true });
}

async function handleInitialSetup(interaction) {
  const adminRole = interaction.options.getRole('رتبة_الإدارة', true);
  const mainChannel = interaction.options.getChannel('روم_الرئيسية', true);
  const defaultLog = interaction.options.getChannel('روم_اللوغ_الافتراضي', false);
  const configLog = interaction.options.getChannel('روم_لوق_الإعداد', false);
  const enabledTypesRaw = interaction.options.getString('الأنواع_المفعلة', false);
  const enabledTypes =
    enabledTypesRaw?.split(',').map((v) => v.trim()).filter((v) => ticketTypes.includes(v)) ||
    ticketTypes;
  updateState((state) => {
    state.settings.adminRoleId = adminRole.id;
    state.settings.mainChannelId = mainChannel.id;
    state.settings.defaultLogChannelId = defaultLog?.id || null;
    state.settings.configLogChannelId = configLog?.id || null;
    state.settings.enabledTypes = enabledTypes;
  });
  await interaction.reply({
    content: 'تم حفظ الإعداد الأولي. يمكنك الآن إضافة الأزرار والربط.',
    ephemeral: true
  });
  await logConfigChange(
    `إعداد أولي بواسطة <@${interaction.user.id}> - تم تعيين رتبة الإدارة ${adminRole} وروم الواجهة <#${mainChannel.id}>`
  );
}

async function handleClaimSettings(interaction) {
  const hide = interaction.options.getBoolean('إخفاء_بعد_الاستلام', true);
  const allow = interaction.options.getBoolean('السماح_للادارة_برؤية_كل_شيء', true);
  updateState((state) => {
    state.settings.claim.hideAfterClaim = hide;
    state.settings.claim.allowManagersViewAll = allow;
  });
  await interaction.reply({ content: 'تم تحديث إعدادات الاستلام.', ephemeral: true });
  await logConfigChange(
    `تعديل إعدادات الاستلام (إخفاء:${hide}, رؤية الإدارة:${allow}) بواسطة <@${interaction.user.id}>`
  );
}

async function handleAutoCloseSettings(interaction) {
  const reminder = interaction.options.getInteger('مدة_التذكير', true);
  const close = interaction.options.getInteger('مدة_الإغلاق', true);
  const escalate = interaction.options.getBoolean('التصعيد', false) ?? true;
  updateState((state) => {
    state.settings.autoClose.reminderAfterMinutes = reminder;
    state.settings.autoClose.closeAfterMinutes = close;
    state.settings.autoClose.escalate = escalate;
  });
  await interaction.reply({ content: 'تم تحديث إعدادات الإغلاق التلقائي.', ephemeral: true });
  await logConfigChange(
    `تعديل الإغلاق التلقائي (تذكير ${reminder}د، إغلاق ${close}د) بواسطة <@${interaction.user.id}>`
  );
}

async function handleReminderSettings(interaction) {
  const first = interaction.options.getInteger('المدة_قبل_التذكير_الأول', true);
  const max = interaction.options.getInteger('عدد_التذكيرات_الأقصى', true);
  updateState((state) => {
    state.settings.reminders.firstReminderMinutes = first;
    state.settings.reminders.maxReminders = max;
  });
  await interaction.reply({ content: 'تم تحديث إعدادات التذكير.', ephemeral: true });
  await logConfigChange(
    `تعديل التذكيرات (أول ${first}د، أقصى ${max}) بواسطة <@${interaction.user.id}>`
  );
}

async function handleModeSwitch(interaction) {
  const mode = interaction.options.getString('الوضع', true);
  updateState((state) => {
    state.settings.mode = mode;
  });
  await interaction.reply({ content: `تم تغيير الوضع إلى ${mode}.`, ephemeral: true });
  await logConfigChange(`تم تبديل وضع النظام إلى ${mode} بواسطة <@${interaction.user.id}>`);
}

async function handleSearchTickets(interaction) {
  const opts = {
    user: interaction.options.getUser('العضو'),
    staff: interaction.options.getUser('الموظف'),
    type: interaction.options.getString('نوع_التذكرة'),
    status: interaction.options.getString('الحالة'),
    tag: interaction.options.getString('الوسم'),
    from: interaction.options.getString('من_تاريخ'),
    to: interaction.options.getString('إلى_تاريخ')
  };
  const fromTs = opts.from ? Date.parse(opts.from) : null;
  const toTs = opts.to ? Date.parse(opts.to) : null;
  const results = Object.values(getState().tickets).filter((t) => {
    if (opts.user && t.userId !== opts.user.id) return false;
    if (opts.staff && t.assignedTo !== opts.staff.id) return false;
    if (opts.type && t.type !== opts.type) return false;
    if (opts.status && t.status !== opts.status) return false;
    if (opts.tag && !(t.tags || []).includes(opts.tag)) return false;
    if (fromTs && t.createdAt < fromTs) return false;
    if (toTs && t.createdAt > toTs) return false;
    return true;
  });
  const lines = results.slice(0, 15).map(
    (t) =>
      `• [${t.type}](https://discord.com/channels/${interaction.guildId}/${t.channelId}) - ${t.status} - <@${t.userId}>`
  );
  await interaction.reply({
    content: lines.join('\n') || 'لم يتم العثور على نتائج.',
    ephemeral: true
  });
}

async function handleMyTickets(interaction) {
  const userId = interaction.user.id;
  const tickets = Object.values(getState().tickets).filter((t) => t.userId === userId);
  const open = tickets.filter((t) => t.status !== 'مغلقة');
  const closed = tickets
    .filter((t) => t.status === 'مغلقة')
    .sort((a, b) => b.closedAt - a.closedAt)
    .slice(0, 5);
  const embed = new EmbedBuilder().setTitle('تذاكري').setColor(0x2ecc71);
  embed.addFields({
    name: 'التذاكر المفتوحة',
    value: open.length
      ? open.map((t) => `• ${t.type} - <#${t.channelId}>`).join('\n')
      : 'لا يوجد',
    inline: false
  });
  embed.addFields({
    name: 'مغلقة مؤخراً',
    value: closed.length
      ? closed.map((t) => `• ${t.type} - <#${t.channelId}>`).join('\n')
      : 'لا يوجد',
    inline: false
  });
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleSupportProfile(interaction) {
  const user = interaction.options.getUser('الموظف', true);
  const tickets = Object.values(getState().tickets).filter((t) => t.assignedTo === user.id);
  const closed = tickets.filter((t) => t.status === 'مغلقة').length;
  const embed = new EmbedBuilder()
    .setTitle(`بروفايل الدعم: ${user.username}`)
    .addFields(
      { name: 'مجموع التذاكر', value: `${tickets.length}`, inline: true },
      { name: 'مغلقة', value: `${closed}`, inline: true }
    )
    .setColor(0x9b59b6);
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleTicketReports(interaction) {
  const range = interaction.options.getString('النطاق', true);
  const now = Date.now();
  const start =
    range === 'day'
      ? now - DAY_IN_MS
      : range === 'week'
        ? now - 7 * DAY_IN_MS
        : now - 30 * DAY_IN_MS;
  const tickets = Object.values(getState().tickets).filter((t) => t.createdAt >= start);
  const byStatus = statusOptions.map((s) => ({
    status: s,
    count: tickets.filter((t) => t.status === s).length
  }));
  const embed = new EmbedBuilder().setTitle('تقرير التذاكر').setColor(0x2980b9);
  embed.setDescription(
    byStatus.map((s) => `• ${s.status}: ${s.count}`).join('\n') || 'لا توجد تذاكر في هذه الفترة.'
  );
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleSlashOpenTicket(interaction) {
  const type = interaction.options.getString('نوع_التذكرة', true);
  const details = interaction.options.getString('التفاصيل', false) || 'لا يوجد وصف.';
  const ban = getState().bannedUsers[interaction.user.id];
  if (ban) {
    return interaction.reply({ content: `لا يمكنك فتح التذاكر: ${ban.reason || ''}`, ephemeral: true });
  }
  const spam = enforceSpam(interaction.user.id);
  if (spam) return interaction.reply({ content: spam, ephemeral: true });
  await openTicket({ interaction, type, details });
}

async function handleCloseTicketCommand(interaction) {
  const ticket = ensureTicketChannel(interaction);
  if (!ticket) return;
  const reason = interaction.options.getString('السبب', false) || 'طلب الإغلاق من صاحب التذكرة';
  if (interaction.user.id !== ticket.userId && !hasPermissionForType(interaction.member, ticket.type)) {
    return interaction.reply({ content: 'لا يمكنك إغلاق هذه التذكرة.', ephemeral: true });
  }
  await closeTicket(interaction.channelId, interaction.user.id, reason);
  await interaction.reply({ content: 'تم إغلاق التذكرة.', ephemeral: true });
}

async function handleHelpCenter(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('مركز المساعدة')
    .setDescription('تعرف على أنواع التذاكر ومتى تستخدم كل واحدة.')
    .setColor(0x1abc9c);
  ticketTypes.forEach((type) => embed.addFields({ name: type, value: 'استخدم النوع عند الحاجة.', inline: false }));
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleLimitsSettings(interaction) {
  const daily = interaction.options.getInteger('الحد_اليومي', true);
  const cooldown = interaction.options.getInteger('التبريد_بالدقائق', true);
  updateState((state) => {
    state.settings.spam.dailyLimit = daily;
    state.settings.spam.cooldownMinutes = cooldown;
  });
  await interaction.reply({ content: 'تم تحديث حدود التذاكر.', ephemeral: true });
  await logConfigChange(
    `تعديل حدود التذاكر (يومي ${daily}، تبريد ${cooldown}د) بواسطة <@${interaction.user.id}>`
  );
}

async function handleBanUser(interaction) {
  const user = interaction.options.getUser('العضو', true);
  const reason = interaction.options.getString('السبب', false) || 'بدون سبب';
  updateState((state) => {
    state.bannedUsers[user.id] = { reason, by: interaction.user.id, at: Date.now() };
  });
  await interaction.reply({ content: `تم حظر ${user} من نظام التذاكر.`, ephemeral: true });
  await logConfigChange(`تم حظر ${user} من التذاكر. السبب: ${reason}`);
}

async function handleUnbanUser(interaction) {
  const user = interaction.options.getUser('العضو', true);
  updateState((state) => {
    delete state.bannedUsers[user.id];
  });
  await interaction.reply({ content: `تم إلغاء حظر ${user}.`, ephemeral: true });
  await logConfigChange(`تم إلغاء حظر ${user} من التذاكر بواسطة <@${interaction.user.id}>`);
}

async function handleListBanned(interaction) {
  const banned = getState().bannedUsers;
  if (!Object.keys(banned).length) {
    return interaction.reply({ content: 'لا يوجد أعضاء محظورين.', ephemeral: true });
  }
  const lines = Object.entries(banned).map(
    ([id, info]) => `• <@${id}> - ${info.reason || 'بدون سبب'}`
  );
  await interaction.reply({ content: lines.join('\n'), ephemeral: true });
}

async function handleInternalNote(interaction) {
  const ticket = ensureTicketChannel(interaction);
  if (!ticket) return;
  if (!hasPermissionForType(interaction.member, ticket.type)) {
    return interaction.reply({ content: 'هذا الأمر مخصص للطاقم.', ephemeral: true });
  }
  const content = interaction.options.getString('المحتوى', true);
  updateState((state) => {
    const t = state.tickets[interaction.channelId];
    if (t) {
      logTimeline(t, interaction.user.id, 'ملاحظة داخلية', content);
    }
  });
  await interaction.reply({ content: 'تم تسجيل الملاحظة داخلياً.', ephemeral: true });
}

function startAutoCloseLoop() {
  setInterval(async () => {
    const state = getState();
    const tickets = Object.values(state.tickets).filter((t) => t.status !== 'مغلقة');
    if (!tickets.length) return;
    if (autoCloseCursor >= tickets.length) autoCloseCursor = 0;
    const batch = tickets.slice(autoCloseCursor, autoCloseCursor + MAX_TICKETS_PER_CYCLE);
    const now = Date.now();
    for (const ticket of batch) {
      const last = ticket.lastActivityAt || ticket.createdAt;
      const diffMinutes = (now - last) / 60000;
      if (
        ticket.remindersSent < (state.settings.reminders.maxReminders || 2) &&
        diffMinutes >= (state.settings.reminders.firstReminderMinutes || 45) &&
        (!ticket.lastReminderAt || now - ticket.lastReminderAt > HALF_HOUR_MS)
      ) {
        const channel =
          client.channels.cache.get(ticket.channelId) ||
          (await client.channels.fetch(ticket.channelId).catch(() => null));
        if (channel && channel.isTextBased()) {
          channel
            .send({
              content: `<@${ticket.userId}> هناك تذكرة بانتظار ردك (${ticket.type}).`
            })
            .catch(() => {});
        }
        updateState((draft) => {
          const t = draft.tickets[ticket.channelId];
          if (t) {
            t.remindersSent = (t.remindersSent || 0) + 1;
            t.lastReminderAt = now;
            logTimeline(t, null, 'تذكير تلقائي', 'تم إرسال تذكير للعضو');
          }
        });
      }
      if (diffMinutes >= (state.settings.autoClose.closeAfterMinutes || 180)) {
        await closeTicket(ticket.channelId, null, 'إغلاق تلقائي لعدم الرد');
      }
    }
    autoCloseCursor += batch.length;
  }, MINUTE_IN_MS);
}
