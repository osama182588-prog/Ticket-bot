import { ChannelType, SlashCommandBuilder } from 'discord.js';
import { statusOptions, ticketTypes } from './constants.js';

const typeChoices = ticketTypes.map((type) => ({ name: type, value: type }));
const statusChoices = statusOptions.map((status) => ({ name: status, value: status }));

export const commands = [
  {
    data: new SlashCommandBuilder()
      .setName('إنشاء-داشبورد')
      .setDescription('إنشاء لوحة تذاكر جديدة')
      .addStringOption((opt) =>
        opt.setName('اسم_الداشبورد').setDescription('اسم اللوحة').setRequired(true)
      )
      .addChannelOption((opt) =>
        opt
          .setName('الروم')
          .setDescription('القناة التي سترسل بها اللوحة')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
      .setDMPermission(false)
  },
  {
    data: new SlashCommandBuilder()
      .setName('إضافة-زر')
      .setDescription('إضافة زر إلى داشبورد موجود')
      .addStringOption((opt) =>
        opt.setName('الداشبورد').setDescription('اسم الداشبورد أو معرفه').setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName('اسم_الزر').setDescription('النص العربي للزر').setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName('الإيموجي').setDescription('إيموجي اختياري').setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName('نوع_التذكرة')
          .setDescription('نوع التذكرة لهذا الزر')
          .addChoices(...typeChoices)
          .setRequired(true)
      )
      .addChannelOption((opt) =>
        opt
          .setName('روم_اللوغ')
          .setDescription('قناة اللوغ الخاصة لهذا النوع')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(false)
      )
      .setDMPermission(false)
  },
  {
    data: new SlashCommandBuilder()
      .setName('عرض-الداشبوردات')
      .setDescription('عرض جميع الداشبوردات المسجلة')
      .setDMPermission(false)
  },
  {
    data: new SlashCommandBuilder()
      .setName('حذف-زر')
      .setDescription('حذف زر من داشبورد')
      .addStringOption((opt) =>
        opt.setName('الداشبورد').setDescription('الداشبورد المستهدف').setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName('اسم_الزر').setDescription('اسم الزر أو معرفه').setRequired(true)
      )
      .setDMPermission(false)
  },
  {
    data: new SlashCommandBuilder()
      .setName('ربط-رتبة-بنوع')
      .setDescription('ربط نوع تذكرة برتبة')
      .addStringOption((opt) =>
        opt
          .setName('نوع_التذكرة')
          .setDescription('النوع الرسمي')
          .addChoices(...typeChoices)
          .setRequired(true)
      )
      .addRoleOption((opt) =>
        opt.setName('الرتبة').setDescription('الرتبة المربوطة').setRequired(true)
      )
      .setDMPermission(false)
  },
  {
    data: new SlashCommandBuilder()
      .setName('عرض-الأدوار-لنوع')
      .setDescription('عرض الرتب المربوطة بنوع تذكرة')
      .addStringOption((opt) =>
        opt
          .setName('نوع_التذكرة')
          .setDescription('النوع المطلوب')
          .addChoices(...typeChoices)
          .setRequired(true)
      )
      .setDMPermission(false)
  },
  {
    data: new SlashCommandBuilder()
      .setName('حذف-رتبة-من-نوع')
      .setDescription('إزالة رتب من نوع تذكرة')
      .addStringOption((opt) =>
        opt
          .setName('نوع_التذكرة')
          .setDescription('النوع المطلوب')
          .addChoices(...typeChoices)
          .setRequired(true)
      )
      .addRoleOption((opt) =>
        opt.setName('الرتبة').setDescription('الرتبة المراد إزالتها').setRequired(true)
      )
      .setDMPermission(false)
  },
  {
    data: new SlashCommandBuilder()
      .setName('إلغاء-الاستلام')
      .setDescription('إلغاء استلام التذكرة الحالية')
      .setDMPermission(false)
  },
  {
    data: new SlashCommandBuilder()
      .setName('نقل-التذكرة')
      .setDescription('نقل مسؤولية التذكرة لموظف آخر')
      .addUserOption((opt) =>
        opt.setName('الموظف_الجديد').setDescription('الموظف الجديد').setRequired(true)
      )
      .setDMPermission(false)
  },
  {
    data: new SlashCommandBuilder()
      .setName('تغيير-حالة-التذكرة')
      .setDescription('تحديث حالة التذكرة الحالية')
      .addStringOption((opt) =>
        opt.setName('الحالة').setDescription('الحالة الجديدة').addChoices(...statusChoices).setRequired(true)
      )
      .setDMPermission(false)
  },
  {
    data: new SlashCommandBuilder()
      .setName('إضافة-وسم')
      .setDescription('إضافة وسم للتذكرة')
      .addStringOption((opt) =>
        opt.setName('الوسم').setDescription('الوسم المطلوب').setRequired(true)
      )
      .setDMPermission(false)
  },
  {
    data: new SlashCommandBuilder()
      .setName('حذف-وسم')
      .setDescription('حذف وسم من التذكرة')
      .addStringOption((opt) =>
        opt.setName('الوسم').setDescription('الوسم المراد حذفه').setRequired(true)
      )
      .setDMPermission(false)
  },
  {
    data: new SlashCommandBuilder()
      .setName('إعداد-أولي')
      .setDescription('معالج الإعداد الأولي للنظام')
      .addRoleOption((opt) =>
        opt.setName('رتبة_الإدارة').setDescription('رتبة الإدارة العليا').setRequired(true)
      )
      .addChannelOption((opt) =>
        opt
          .setName('روم_الرئيسية')
          .setDescription('قناة الواجهة الرئيسية')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
      .addChannelOption((opt) =>
        opt
          .setName('روم_اللوغ_الافتراضي')
          .setDescription('قناة اللوغ الافتراضية للأنواع')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(false)
      )
      .addChannelOption((opt) =>
        opt
          .setName('روم_لوق_الإعداد')
          .setDescription('قناة تسجيل تغييرات الإعدادات')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName('الأنواع_المفعلة')
          .setDescription('أنواع التذاكر المفعّلة (مفصولة بفاصلة)')
          .setRequired(false)
      )
      .setDMPermission(false)
  },
  {
    data: new SlashCommandBuilder()
      .setName('إعدادات-الاستلام')
      .setDescription('إعداد سلوك الاستلام')
      .addBooleanOption((opt) =>
        opt
          .setName('إخفاء_بعد_الاستلام')
          .setDescription('إخفاء زر الاستلام بعد الاستلام')
          .setRequired(true)
      )
      .addBooleanOption((opt) =>
        opt
          .setName('السماح_للادارة_برؤية_كل_شيء')
          .setDescription('سماح الإدارة برؤية كل التذاكر')
          .setRequired(true)
      )
      .setDMPermission(false)
  },
  {
    data: new SlashCommandBuilder()
      .setName('إعدادات-الإغلاق-التلقائي')
      .setDescription('التحكم في التذكير والإغلاق التلقائي')
      .addIntegerOption((opt) =>
        opt
          .setName('مدة_التذكير')
          .setDescription('الدقائق قبل التذكير')
          .setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt
          .setName('مدة_الإغلاق')
          .setDescription('الدقائق قبل الإغلاق')
          .setRequired(true)
      )
      .addBooleanOption((opt) =>
        opt.setName('التصعيد').setDescription('تصعيد عند التأخر').setRequired(false)
      )
      .setDMPermission(false)
  },
  {
    data: new SlashCommandBuilder()
      .setName('إعدادات-التذكير')
      .setDescription('إدارة التذكيرات')
      .addIntegerOption((opt) =>
        opt
          .setName('المدة_قبل_التذكير_الأول')
          .setDescription('بالدقائق')
          .setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt
          .setName('عدد_التذكيرات_الأقصى')
          .setDescription('عدد التذكيرات')
          .setRequired(true)
      )
      .setDMPermission(false)
  },
  {
    data: new SlashCommandBuilder()
      .setName('تبديل-وضع-النظام')
      .setDescription('تطبيق وضع/ملف إعدادات')
      .addStringOption((opt) =>
        opt
          .setName('الوضع')
          .setDescription('اختر الوضع')
          .addChoices(
            { name: 'عادي', value: 'عادي' },
            { name: 'ضغط عالي', value: 'ضغط عالي' },
            { name: 'صيانة', value: 'صيانة' }
          )
          .setRequired(true)
      )
      .setDMPermission(false)
  },
  {
    data: new SlashCommandBuilder()
      .setName('بحث-تذكرة')
      .setDescription('بحث متقدم في التذاكر')
      .addUserOption((opt) =>
        opt.setName('العضو').setDescription('صاحب التذكرة').setRequired(false)
      )
      .addUserOption((opt) =>
        opt.setName('الموظف').setDescription('الموظف المستلم').setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName('نوع_التذكرة')
          .setDescription('نوع التذكرة')
          .addChoices(...typeChoices)
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName('الحالة')
          .setDescription('حالة التذكرة')
          .addChoices(...statusChoices)
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt.setName('الوسم').setDescription('وسم محدد').setRequired(false)
      )
      .addStringOption((opt) =>
        opt.setName('من_تاريخ').setDescription('YYYY-MM-DD').setRequired(false)
      )
      .addStringOption((opt) =>
        opt.setName('إلى_تاريخ').setDescription('YYYY-MM-DD').setRequired(false)
      )
      .setDMPermission(false)
  },
  {
    data: new SlashCommandBuilder()
      .setName('تذاكري')
      .setDescription('عرض تذاكر العضو')
      .setDMPermission(false)
  },
  {
    data: new SlashCommandBuilder()
      .setName('ملف-دعم')
      .setDescription('عرض بروفايل موظف الدعم')
      .addUserOption((opt) =>
        opt.setName('الموظف').setDescription('الموظف المطلوب').setRequired(true)
      )
      .setDMPermission(false)
  },
  {
    data: new SlashCommandBuilder()
      .setName('تقارير-التذاكر')
      .setDescription('تقرير فوري لعدد التذاكر')
      .addStringOption((opt) =>
        opt
          .setName('النطاق')
          .setDescription('نطاق زمني')
          .addChoices(
            { name: 'اليوم', value: 'day' },
            { name: 'الأسبوع', value: 'week' },
            { name: 'الشهر', value: 'month' }
          )
          .setRequired(true)
      )
      .setDMPermission(false)
  },
  {
    data: new SlashCommandBuilder()
      .setName('فتح-تذكرة')
      .setDescription('فتح تذكرة عبر أمر سلاش')
      .addStringOption((opt) =>
        opt
          .setName('نوع_التذكرة')
          .setDescription('حدد النوع')
          .addChoices(...typeChoices)
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName('التفاصيل').setDescription('تفاصيل الطلب أو المشكلة').setRequired(false)
      )
      .setDMPermission(false)
  },
  {
    data: new SlashCommandBuilder()
      .setName('إغلاق-تذكرتي')
      .setDescription('طلب إغلاق التذكرة الحالية')
      .addStringOption((opt) =>
        opt.setName('السبب').setDescription('سبب الإغلاق').setRequired(false)
      )
      .setDMPermission(false)
  },
  {
    data: new SlashCommandBuilder()
      .setName('مركز-المساعدة')
      .setDescription('إرسال مركز مساعدة بأنواع التذاكر')
      .setDMPermission(false)
  },
  {
    data: new SlashCommandBuilder()
      .setName('إعدادات-الحدود')
      .setDescription('إدارة حدود فتح التذاكر')
      .addIntegerOption((opt) =>
        opt.setName('الحد_اليومي').setDescription('أقصى تذاكر باليوم').setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt.setName('التبريد_بالدقائق').setDescription('دقائق بين كل تذكرتين').setRequired(true)
      )
      .setDMPermission(false)
  },
  {
    data: new SlashCommandBuilder()
      .setName('حظر-من-التذاكر')
      .setDescription('منع عضو من فتح التذاكر')
      .addUserOption((opt) =>
        opt.setName('العضو').setDescription('العضو المستهدف').setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName('السبب').setDescription('سبب الحظر').setRequired(false)
      )
      .setDMPermission(false)
  },
  {
    data: new SlashCommandBuilder()
      .setName('إلغاء-حظر-التذاكر')
      .setDescription('إزالة الحظر عن عضو')
      .addUserOption((opt) =>
        opt.setName('العضو').setDescription('العضو المستهدف').setRequired(true)
      )
      .setDMPermission(false)
  },
  {
    data: new SlashCommandBuilder()
      .setName('قائمة-المحظورين-من-التذاكر')
      .setDescription('عرض قائمة المحظورين')
      .setDMPermission(false)
  },
  {
    data: new SlashCommandBuilder()
      .setName('ملاحظة-داخلية')
      .setDescription('إضافة ملاحظة داخلية لا تظهر للعضو')
      .addStringOption((opt) =>
        opt.setName('المحتوى').setDescription('نص الملاحظة').setRequired(true)
      )
      .setDMPermission(false)
  }
];

export const commandMap = new Map(commands.map((command) => [command.data.name, command]));

