import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { commands } from './commands.js';

const token = process.env.TOKEN || process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
  console.error('يرجى ضبط المتغيرات البيئية TOKEN و CLIENT_ID و GUILD_ID قبل التسجيل.');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

async function register() {
  try {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands.map((command) => command.data.toJSON())
    });
    console.log('✅ تم نشر أوامر السلاش بنجاح');
  } catch (error) {
    console.error('فشل نشر الأوامر', error);
    process.exit(1);
  }
}

register();
