export const ticketTypes = [
  'الاستفسارات العامة',
  'مساعدة تقنية',
  'شكوى',
  'بلاغ',
  'شكاوي التعويض',
  'شكوى عامة',
  'الدعم الفني',
  'التقديم على وزارة العدل',
  'التقديم على وزارة الصحة',
  'التقديم على الشرطة',
  'قضايا الباند',
  'استفسار العصابات'
];

export const statusOptions = [
  'مفتوحة',
  'قيد المراجعة',
  'قيد المعالجة',
  'بانتظار رد العضو',
  'مجمّدة',
  'مغلقة'
];

export const typeColors = {
  'الاستفسارات العامة': 0x3498db,
  'مساعدة تقنية': 0x9b59b6,
  'شكوى': 0xe74c3c,
  'بلاغ': 0xf1c40f,
  'شكاوي التعويض': 0xe67e22,
  'شكوى عامة': 0xe74c3c,
  'الدعم الفني': 0x2ecc71,
  'التقديم على وزارة العدل': 0x1abc9c,
  'التقديم على وزارة الصحة': 0x1abc9c,
  'التقديم على الشرطة': 0x2980b9,
  'قضايا الباند': 0x8e44ad,
  'استفسار العصابات': 0x16a085
};

export const defaultSettings = {
  adminRoleId: null,
  mainChannelId: null,
  helpChannelId: null,
  configLogChannelId: null,
  defaultLogChannelId: null,
  claim: {
    hideAfterClaim: false,
    allowManagersViewAll: true
  },
  autoClose: {
    reminderAfterMinutes: 60,
    closeAfterMinutes: 180,
    escalate: true
  },
  reminders: {
    firstReminderMinutes: 45,
    maxReminders: 2
  },
  mode: 'عادي',
  spam: {
    dailyLimit: 3,
    cooldownMinutes: 15
  }
};

