const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  PermissionsBitField,
  Events,
  MessageFlags,
} = require("discord.js");
const express = require("express");
const crypto = require("crypto");

process.on("unhandledRejection", err => console.error("Unhandled Rejection:", err));
process.on("uncaughtException", err => console.error("Uncaught Exception:", err));

const TOKEN = process.env.TOKEN;
const VERIFICATION_CHANNEL_ID = "1433117197177323601";
const REQUEST_ROLE_CHANNEL_ID = "1454175656182288596";
const MEMBER_ROLE_ID = "1433112536642879608";
const LOGS_CHANNEL_ID = "1456002175707906129";
const STAFF_ROLE_ID = "1433112127287332964";

const GAME_INFO = {
  valorant: { label: "VALORANT", emoji: "🔫", roleId: "1436304907551375390", text: "Competitive FPS • Tactical 5v5" },
  grandrp: { label: "Grand RP", emoji: "🫀", roleId: "1433136876574736484", text: "Roleplay • Open World" },
  fortnite: { label: "Fortnite", emoji: "🪓", roleId: "1433333680436416552", text: "Battle Royale • Creative" },
};

const applications = new Map();
const verificationChallenges = new Map();
const cooldowns = new Map();
const APPLICATION_COOLDOWN = 10 * 60 * 1000;

const app = express();
app.get("/", (_, res) => res.status(200).send("Family Manager is online."));
app.get("/health", (_, res) => res.status(200).send("OK"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`🌐 Web server listening on port ${PORT}`));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.Channel],
});

function makeCaptcha() {
  const a = crypto.randomInt(2, 10);
  const b = crypto.randomInt(2, 10);
  const ops = [
    { symbol: "+", answer: a + b },
    { symbol: "−", answer: a - b },
    { symbol: "×", answer: a * b },
  ];
  const op = ops[crypto.randomInt(0, ops.length)];
  return { question: `${a} ${op.symbol} ${b}`, answer: op.answer };
}

function verificationPanel() {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({ name: "FAMILY MANAGER • SECURITY" })
    .setTitle("🛡️  WELCOME • VERIFY YOURSELF")
    .setDescription(
      "**Your journey starts here.**\n\n" +
      "Before accessing the family recruitment area, complete our quick security check.\n\n" +
      "🔐 **Secure CAPTCHA Verification**\n" +
      "✅ Receive the **Member** role instantly\n" +
      "📩 Get your next-step instructions by DM\n" +
      "📝 Continue to the Family Application"
    )
    .addFields(
      { name: "⚡ QUICK & EASY", value: "Takes only a few seconds.", inline: true },
      { name: "🔒 WHY VERIFY?", value: "Keeps recruitment protected.", inline: true },
      { name: "📋 NEXT STEP", value: "Apply after verification.", inline: true }
    )
    .setFooter({ text: "Family Manager • Verification System" })
    .setTimestamp();
  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("verify_start").setLabel("VERIFY NOW").setEmoji("🔐").setStyle(ButtonStyle.Success)
    )],
  };
}

function requestRolePanel() {
  const embed = new EmbedBuilder()
    .setColor(0x7c5cff)
    .setAuthor({ name: "FAMILY MANAGER • RECRUITMENT" })
    .setTitle("👑  JOIN THE FAMILY")
    .setDescription(
      "### 🎮 Ready to become part of the squad?\n" +
      "Tell us about yourself, your gaming experience and the games you play. Our staff team will review your application.\n\n" +
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
      "### 📋 APPLICATION CHECKLIST\n" +
      "> 👤 **Personal Information** — Name & region\n" +
      "> 🎮 **Gaming Profile** — In-game name & experience\n" +
      "> 🕹️ **Game Selection** — Choose one or more games\n" +
      "> 👮 **Staff Review** — Your application is reviewed by staff\n\n" +
      "### 🎯 AVAILABLE GAMES\n" +
      "🔫 **VALORANT**  •  Tactical 5v5\n" +
      "🫀 **Grand RP**  •  Open-world roleplay\n" +
      "🪓 **Fortnite**  •  Battle Royale & Creative\n\n" +
      "### ⚠️ BEFORE YOU APPLY\n" +
      "Please enter **accurate information** and use your correct in-game name. Duplicate/spam applications may be ignored.\n\n" +
      "**🚀 Ready? Click `REQUEST ROLE` below to begin.**"
    )
    .setFooter({ text: "Family Manager • Recruitment Center • Applications are reviewed by staff" })
    .setTimestamp();

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("request_role").setLabel("REQUEST ROLE").setEmoji("📝").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("request_how").setLabel("HOW IT WORKS").setEmoji("📖").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("request_faq").setLabel("FAQ").setEmoji("❓").setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [buttons] };
}

function applicationModal() {
  return new ModalBuilder()
    .setCustomId("application_modal")
    .setTitle("👑 Family Recruitment Application")
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("name").setLabel("👤 Your Name").setPlaceholder("Enter your name").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("region").setLabel("🌍 Your Region").setPlaceholder("Example: India / EU / NA").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("ign").setLabel("🎮 In-Game Name").setPlaceholder("Enter your exact in-game name").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("experience").setLabel("⭐ Gaming Experience").setPlaceholder("Tell us about your gaming experience").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)),
    );
}

function gameSelection(userId) {
  const appData = applications.get(userId);
  const selected = appData?.selectedGames || [];
  const embed = new EmbedBuilder()
    .setColor(0x7c5cff)
    .setTitle("🎮  CHOOSE YOUR GAMES")
    .setDescription(
      `**Application ID:** \`${appData?.applicationId || "Pending"}\`\n\n` +
      "Select every game you actively play. You can choose **multiple games**.\n\n" +
      (selected.length ? `### ✅ SELECTED\n${selected.map(k => `${GAME_INFO[k].emoji} **${GAME_INFO[k].label}**`).join("  •  ")}` : "### 🎯 SELECT YOUR GAMES\nNothing selected yet.")
    )
    .setFooter({ text: "Select your games, then press CONFIRM APPLICATION." });
  const row = new ActionRowBuilder();
  for (const [key, game] of Object.entries(GAME_INFO)) {
    row.addComponents(new ButtonBuilder()
      .setCustomId(`game_${key}`)
      .setLabel(game.label)
      .setEmoji(game.emoji)
      .setStyle(selected.includes(key) ? ButtonStyle.Success : ButtonStyle.Secondary));
  }
  const confirm = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`confirm_application:${userId}`).setLabel("CONFIRM APPLICATION").setEmoji("🚀").setStyle(ButtonStyle.Primary)
  );
  return { embeds: [embed], components: [row, confirm], flags: MessageFlags.Ephemeral };
}

function applicationButtons(userId, applicationId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`approve:${userId}:${applicationId}`).setLabel("APPROVE").setEmoji("✅").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`reject:${userId}:${applicationId}`).setLabel("REJECT").setEmoji("❌").setStyle(ButtonStyle.Danger),
  );
}

function rejectModal(userId, applicationId) {
  return new ModalBuilder().setCustomId(`reject_reason:${userId}:${applicationId}`).setTitle("❌ Reject Family Application").addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("reason").setLabel("Reason for rejection").setPlaceholder("Give the applicant a clear reason").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000))
  );
}

async function isStaff(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  return member.permissions.has(PermissionsBitField.Flags.Administrator) || member.roles.cache.has(STAFF_ROLE_ID);
}

async function postOrUpdatePanel(channelId, builder, markerId) {
  const channel = await client.channels.fetch(channelId);
  if (!channel?.isTextBased()) throw new Error("Target channel not found");
  const messages = await channel.messages.fetch({ limit: 50 });
  const existing = messages.find(m => m.author.id === client.user.id && m.components.some(r => r.components.some(c => c.customId === markerId)));
  if (existing) await existing.edit(builder());
  else await channel.send(builder());
}

async function verificationSuccess(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const role = interaction.guild.roles.cache.get(MEMBER_ROLE_ID);
  if (!role) return interaction.reply({ content: "❌ Member role was not found. Contact an administrator.", flags: MessageFlags.Ephemeral });
  if (role.position >= interaction.guild.members.me.roles.highest.position) return interaction.reply({ content: "❌ I cannot assign the Member role. Move the Member role below my bot role.", flags: MessageFlags.Ephemeral });
  if (!member.roles.cache.has(MEMBER_ROLE_ID)) await member.roles.add(role, "Successful CAPTCHA verification");
  const channel = `<#${REQUEST_ROLE_CHANNEL_ID}>`;
  const embed = new EmbedBuilder().setColor(0x57f287).setTitle("🎉  VERIFICATION COMPLETE").setDescription(`Welcome to **${interaction.guild.name}**!\n\n✅ CAPTCHA passed\n🛡️ **Member** role granted\n\n📝 **Next:** Open ${channel} and submit your Family Application.`).setFooter({ text: "Family Manager • You are verified" }).setTimestamp();
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  try { await interaction.user.send({ embeds: [embed.setDescription(`Welcome to **${interaction.guild.name}**!\n\nYou are now verified and have received the **Member** role.\n\n📝 **Next step:** Open ${channel} and submit your Family Application.`)] }); } catch (_) { console.log(`⚠️ Could not DM ${interaction.user.tag}.`); }
}

client.once(Events.ClientReady, async readyClient => {
  console.log(`✅ Logged in as ${readyClient.user.tag}`);
  try {
    await readyClient.application.commands.set([
      { name: "setup-verification", description: "Post/update the premium CAPTCHA verification panel." },
      { name: "setup-request-role", description: "Post/update the premium Family recruitment panel." },
      { name: "open_application", description: "Open the Family Application Form." },
      { name: "my_application", description: "Check your current application status." },
    ]);
    await postOrUpdatePanel(VERIFICATION_CHANNEL_ID, verificationPanel, "verify_start");
    await postOrUpdatePanel(REQUEST_ROLE_CHANNEL_ID, requestRolePanel, "request_role");
    console.log("📌 Premium verification and Request Role panels are ready.");
    console.log("✅ Slash commands registered.");
  } catch (err) { console.error("❌ Startup panel error:", err); }
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "setup-verification") {
        if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: "❌ Only server administrators can use this command.", flags: MessageFlags.Ephemeral });
        await postOrUpdatePanel(VERIFICATION_CHANNEL_ID, verificationPanel, "verify_start");
        return interaction.reply({ content: `✅ Premium verification panel is ready in <#${VERIFICATION_CHANNEL_ID}>.`, flags: MessageFlags.Ephemeral });
      }
      if (interaction.commandName === "setup-request-role") {
        if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: "❌ Only server administrators can use this command.", flags: MessageFlags.Ephemeral });
        await postOrUpdatePanel(REQUEST_ROLE_CHANNEL_ID, requestRolePanel, "request_role");
        return interaction.reply({ content: `✅ Premium Request Role panel is ready in <#${REQUEST_ROLE_CHANNEL_ID}>.`, flags: MessageFlags.Ephemeral });
      }
      if (interaction.commandName === "open_application") return interaction.showModal(applicationModal());
      if (interaction.commandName === "my_application") {
        const a = applications.get(interaction.user.id);
        if (!a) return interaction.reply({ content: `❌ No application found. Use <#${REQUEST_ROLE_CHANNEL_ID}>.`, flags: MessageFlags.Ephemeral });
        return interaction.reply({ content: `📋 **Application:** \`${a.applicationId}\`\n📌 **Status:** ${a.status}\n🎮 **Game:** ${a.game ? GAME_INFO[a.game].label : "Not selected"}${a.reason ? `\n❌ **Reason:** ${a.reason}` : ""}`, flags: MessageFlags.Ephemeral });
      }
    }

    if (interaction.isButton() && interaction.customId === "request_how") {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle("📖 HOW THE FAMILY APPLICATION WORKS").setDescription("**1️⃣ Verify** — Complete the CAPTCHA.\n**2️⃣ Apply** — Fill in your personal & gaming details.\n**3️⃣ Choose Games** — Select the games you play.\n**4️⃣ Submit** — Your application goes to staff.\n**5️⃣ Staff Review** — Staff approve or reject it.\n**6️⃣ Welcome** — Approved applicants receive their game role and a DM.").setFooter({ text: "Family Manager • Recruitment Guide" })], flags: MessageFlags.Ephemeral });
    }
    if (interaction.isButton() && interaction.customId === "request_faq") {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle("❓ FAMILY APPLICATION FAQ").addFields(
        { name: "Can I select multiple games?", value: "Yes. Select every game you actively play." },
        { name: "Who reviews applications?", value: "Only authorized staff/administrators can approve or reject." },
        { name: "Can I apply again?", value: "A short cooldown helps prevent duplicate/spam submissions." },
        { name: "What if my DMs are closed?", value: "Your application is still processed, but you may not receive the DM notification." },
      ).setFooter({ text: "Family Manager • FAQ" })], flags: MessageFlags.Ephemeral });
    }

    if (interaction.isButton() && interaction.customId === "verify_start") {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      if (member.roles.cache.has(MEMBER_ROLE_ID)) return interaction.reply({ content: `✅ You are already verified. Continue in <#${REQUEST_ROLE_CHANNEL_ID}>.`, flags: MessageFlags.Ephemeral });
      const challenge = makeCaptcha();
      verificationChallenges.set(interaction.user.id, { ...challenge, expiresAt: Date.now() + 5 * 60 * 1000 });
      return interaction.showModal(new ModalBuilder().setCustomId("captcha_modal").setTitle("🔐 Security CAPTCHA").addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("answer").setLabel(`Solve: ${challenge.question}`).setPlaceholder("Enter the answer").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(10))
      ));
    }

    if (interaction.isModalSubmit() && interaction.customId === "captcha_modal") {
      const c = verificationChallenges.get(interaction.user.id);
      if (!c || c.expiresAt < Date.now()) { verificationChallenges.delete(interaction.user.id); return interaction.reply({ content: "❌ CAPTCHA expired. Click Verify again.", flags: MessageFlags.Ephemeral }); }
      const answer = Number.parseInt(interaction.fields.getTextInputValue("answer").trim(), 10);
      verificationChallenges.delete(interaction.user.id);
      if (!Number.isInteger(answer) || answer !== c.answer) return interaction.reply({ content: "❌ Incorrect CAPTCHA. Click Verify and try again.", flags: MessageFlags.Ephemeral });
      return verificationSuccess(interaction);
    }

    if (interaction.isButton() && interaction.customId === "request_role") {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      if (!member.roles.cache.has(MEMBER_ROLE_ID)) return interaction.reply({ content: `🔐 Please complete verification first in <#${VERIFICATION_CHANNEL_ID}>.`, flags: MessageFlags.Ephemeral });
      const last = cooldowns.get(interaction.user.id);
      if (last && Date.now() - last < APPLICATION_COOLDOWN) return interaction.reply({ content: `⏳ You recently submitted an application. Please wait before applying again.`, flags: MessageFlags.Ephemeral });
      return interaction.showModal(applicationModal());
    }

    if (interaction.isModalSubmit() && interaction.customId === "application_modal") {
      const applicationId = `FAM-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
      applications.set(interaction.user.id, {
        userId: interaction.user.id,
        username: interaction.user.tag,
        name: interaction.fields.getTextInputValue("name").trim(),
        region: interaction.fields.getTextInputValue("region").trim(),
        ign: interaction.fields.getTextInputValue("ign").trim(),
        experience: interaction.fields.getTextInputValue("experience").trim(),
        applicationId,
        selectedGames: [],
        status: "Pending",
        createdAt: Date.now(),
      });
      return interaction.reply(gameSelection(interaction.user.id));
    }

    if (interaction.isButton() && interaction.customId.startsWith("game_")) {
      const key = interaction.customId.replace("game_", "");
      const a = applications.get(interaction.user.id);
      if (!a || !GAME_INFO[key]) return interaction.reply({ content: "❌ Application session not found. Please start again.", flags: MessageFlags.Ephemeral });
      a.selectedGames = a.selectedGames.includes(key) ? a.selectedGames.filter(x => x !== key) : [...a.selectedGames, key];
      applications.set(interaction.user.id, a);
      return interaction.update(gameSelection(interaction.user.id));
    }

    if (interaction.isButton() && interaction.customId.startsWith("confirm_application:")) {
      const [, userId] = interaction.customId.split(":");
      if (userId !== interaction.user.id) return interaction.reply({ content: "❌ This application belongs to another user.", flags: MessageFlags.Ephemeral });
      const a = applications.get(userId);
      if (!a || !a.selectedGames.length) return interaction.reply({ content: "⚠️ Select at least one game first.", flags: MessageFlags.Ephemeral });
      const logs = await client.channels.fetch(LOGS_CHANNEL_ID);
      if (!logs?.isTextBased()) return interaction.update({ content: "❌ Logs channel was not found.", embeds: [], components: [] });
      const gamesText = a.selectedGames.map(k => `${GAME_INFO[k].emoji} **${GAME_INFO[k].label}**`).join("\n");
      const embed = new EmbedBuilder().setColor(0xfee75c).setAuthor({ name: "FAMILY MANAGER • NEW APPLICATION" }).setTitle("📥  NEW FAMILY APPLICATION").setDescription(`### 📋 Application ID\n\`${a.applicationId}\`\n\n👤 **Applicant:** ${interaction.user}\n🆔 **Discord ID:** \`${interaction.user.id}\``).addFields(
        { name: "👤 Name", value: a.name, inline: true },
        { name: "🌍 Region", value: a.region, inline: true },
        { name: "🎮 In-Game Name", value: a.ign, inline: true },
        { name: "⭐ Gaming Experience", value: a.experience, inline: false },
        { name: "🎯 Selected Games", value: gamesText, inline: false },
        { name: "📌 Status", value: "⏳ Pending Staff Review", inline: true },
        { name: "🕐 Submitted", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
      ).setThumbnail(interaction.user.displayAvatarURL({ size: 256 })).setFooter({ text: `Family Application • ${a.applicationId}` }).setTimestamp();
      await logs.send({ content: `${interaction.user}`, embeds: [embed], components: [applicationButtons(userId, a.applicationId)] });
      cooldowns.set(userId, Date.now());
      a.logMessageId = logs.lastMessageId;
      applications.set(userId, a);
      return interaction.update({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle("🎉  APPLICATION SUBMITTED").setDescription(`Your application **${a.applicationId}** has been sent to the staff team.\n\n🎮 **Games:** ${gamesText}\n⏳ **Status:** Pending Staff Review\n\nPlease wait for the staff decision.`).setFooter({ text: "Family Manager • Recruitment" }).setTimestamp()], components: [] });
    }

    if (interaction.isButton() && interaction.customId.startsWith("approve:")) {
      if (!(await isStaff(interaction))) return interaction.reply({ content: "❌ You do not have permission to manage applications.", flags: MessageFlags.Ephemeral });
      const [, userId, applicationId] = interaction.customId.split(":");
      const a = applications.get(userId);
      if (!a || a.applicationId !== applicationId) return interaction.reply({ content: "❌ Application data is no longer available.", flags: MessageFlags.Ephemeral });
      a.status = "Approved";
      const member = await interaction.guild.members.fetch(userId);
      for (const gameKey of a.selectedGames) {
        const role = interaction.guild.roles.cache.get(GAME_INFO[gameKey]?.roleId);
        if (role && role.position < interaction.guild.members.me.roles.highest.position && !member.roles.cache.has(role.id)) {
          await member.roles.add(role, "Family application approved");
        }
      }
      applications.set(userId, a);
      const old = interaction.message.embeds[0];
      const updated = EmbedBuilder.from(old).setColor(0x57f287).addFields({ name: "📌 Decision", value: `✅ **Approved** by ${interaction.user}`, inline: false }).setFooter({ text: `Approved • ${applicationId}` }).setTimestamp();
      await interaction.update({ embeds: [updated], components: [] });
      try { await member.send({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle("🎉  WELCOME TO THE FAMILY!").setDescription(`Your application **${applicationId}** has been **approved**.\n\n👑 Welcome to the family!\n🎮 Your selected game role has been processed.`).setFooter({ text: "Family Manager • Application Approved" }).setTimestamp()] }); } catch (_) {}
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("reject:")) {
      if (!(await isStaff(interaction))) return interaction.reply({ content: "❌ You do not have permission to manage applications.", flags: MessageFlags.Ephemeral });
      const [, userId, applicationId] = interaction.customId.split(":");
      return interaction.showModal(rejectModal(userId, applicationId));
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("reject_reason:")) {
      if (!(await isStaff(interaction))) return interaction.reply({ content: "❌ You do not have permission to manage applications.", flags: MessageFlags.Ephemeral });
      const [, userId, applicationId] = interaction.customId.split(":");
      const a = applications.get(userId);
      if (!a || a.applicationId !== applicationId) return interaction.reply({ content: "❌ Application data is no longer available.", flags: MessageFlags.Ephemeral });
      a.status = "Rejected";
      a.reason = interaction.fields.getTextInputValue("reason").trim();
      applications.set(userId, a);
      const old = interaction.message.embeds[0];
      const updated = EmbedBuilder.from(old).setColor(0xed4245).addFields({ name: "📌 Decision", value: `❌ **Rejected** by ${interaction.user}\n**Reason:** ${a.reason}`, inline: false }).setFooter({ text: `Rejected • ${applicationId}` }).setTimestamp();
      await interaction.update({ embeds: [updated], components: [] });
      try { const user = await client.users.fetch(userId); await user.send({ embeds: [new EmbedBuilder().setColor(0xed4245).setTitle("❌  FAMILY APPLICATION UPDATE").setDescription(`Your application **${applicationId}** was not approved this time.\n\n**Reason:** ${a.reason}\n\nYou may apply again when eligible.`).setFooter({ text: "Family Manager • Application Update" }).setTimestamp()] }); } catch (_) {}
      return;
    }
  } catch (err) {
    console.error("❌ Interaction error:", err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      try { await interaction.reply({ content: "❌ Something went wrong. Please try again or contact staff.", flags: MessageFlags.Ephemeral }); } catch (_) {}
    }
  }
});

if (!TOKEN) {
  console.error("❌ TOKEN environment variable is missing!");
  process.exit(1);
}
client.login(TOKEN);
