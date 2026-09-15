\const {
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
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  Events,
} = require("discord.js");
const express = require("express");
const crypto = require("crypto");

// =========================
// CONFIG
// =========================
const TOKEN = process.env.TOKEN;

const VERIFICATION_CHANNEL_ID = "1433117197177323601";
const REQUEST_ROLE_CHANNEL_ID = "1454175656182288596";
const MEMBER_ROLE_ID = "1433112536642879608";

// Existing Family Application settings
const LOGS_CHANNEL_ID = "1456002175707906129";
const STAFF_ROLE_ID = "1433112127287332964";

const GAME_ROLES = {
  valorant: "1436304907551375390",
  grandrp: "1433136876574736484",
  fortnite: "1433333680436416552",
};

if (!TOKEN) {
  console.error("❌ TOKEN environment variable is missing.");
  process.exit(1);
}

// =========================
// WEB SERVER FOR RENDER
// =========================
const app = express();

app.get("/", (req, res) => {
  res.status(200).send("Family Manager is online.");
});

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Web server listening on port ${PORT}`);
});

// =========================
// DISCORD CLIENT
// =========================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

// In-memory verification challenges.
// They expire quickly and do not need a database.
const verificationChallenges = new Map();

// In-memory application data for the current process.
const applications = new Map();

function makeCaptcha() {
  const a = crypto.randomInt(2, 10);
  const b = crypto.randomInt(2, 10);
  const operations = [
    { symbol: "+", answer: a + b },
    { symbol: "-", answer: a - b },
    { symbol: "×", answer: a * b },
  ];
  const op = operations[crypto.randomInt(0, operations.length)];
  return {
    a,
    b,
    symbol: op.symbol,
    answer: op.answer,
    question: `${a} ${op.symbol} ${b}`,
  };
}

function verificationPanel() {
  const embed = new EmbedBuilder()
    .setTitle("🔐 Server Verification")
    .setDescription(
      "Welcome to the server!\n\n" +
      "Click **Verify ✅** below to complete a quick CAPTCHA.\n" +
      "After successful verification, you will receive the **Member** role and instructions for the application."
    )
    .setFooter({ text: "Family Manager • Verification" });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("verify_start")
      .setLabel("Verify ✅")
      .setStyle(ButtonStyle.Success)
  );

  return { embeds: [embed], components: [row] };
}

function requestRoleLink(guild) {
  const channel = guild.channels.cache.get(REQUEST_ROLE_CHANNEL_ID);
  return channel
    ? `<#${REQUEST_ROLE_CHANNEL_ID}>`
    : "the Request Role channel";
}

async function sendVerificationSuccess(interaction) {
  const guild = interaction.guild;
  const member = await guild.members.fetch(interaction.user.id);
  const role = guild.roles.cache.get(MEMBER_ROLE_ID);

  if (!role) {
    return interaction.reply({
      content: "❌ Member role was not found. Please contact an administrator.",
      ephemeral: true,
    });
  }

  if (role.position >= guild.members.me.roles.highest.position) {
    return interaction.reply({
      content:
        "❌ I cannot assign the Member role. Please move the Member role **below my bot role** in Server Settings → Roles.",
      ephemeral: true,
    });
  }

  if (!member.roles.cache.has(MEMBER_ROLE_ID)) {
    await member.roles.add(role, "Successful CAPTCHA verification");
  }

  const channelMention = requestRoleLink(guild);

  const successEmbed = new EmbedBuilder()
    .setTitle("✅ Successfully Verified!")
    .setDescription(
      `Welcome to **${guild.name}**!\n\n` +
      `You have successfully completed verification and received the **Member** role.\n\n` +
      `📝 Please fill out the **Family Application Form** in ${channelMention} now.`
    )
    .setFooter({ text: "Family Manager • Verification" });

  await interaction.reply({
    embeds: [successEmbed],
    ephemeral: true,
  });

  try {
    await interaction.user.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🎉 You are successfully verified!")
          .setDescription(
            `Welcome to **${guild.name}**!\n\n` +
            `Your verification was successful and you have received the **Member** role.\n\n` +
            `📝 **Next step:** Please fill out the Family Application Form in ${channelMention}.\n\n` +
            `Click the channel mention above to open it directly.`
          )
          .setFooter({ text: "Family Manager" }),
      ],
    });
  } catch (error) {
    console.log(`⚠️ Could not DM ${interaction.user.tag}. Their DMs may be closed.`);
  }
}

function applicationModal() {
  const modal = new ModalBuilder()
    .setCustomId("application_modal")
    .setTitle("Family Application");

  const name = new TextInputBuilder()
    .setCustomId("name")
    .setLabel("Name")
    .setPlaceholder("Enter your name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  const region = new TextInputBuilder()
    .setCustomId("region")
    .setLabel("Region")
    .setPlaceholder("Example: India / EU / NA")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  const ign = new TextInputBuilder()
    .setCustomId("ign")
    .setLabel("In-Game Name")
    .setPlaceholder("Enter your in-game name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  const experience = new TextInputBuilder()
    .setCustomId("experience")
    .setLabel("Gaming Experience")
    .setPlaceholder("Example: 3 years / 2 years VALORANT")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(500);

  modal.addComponents(
    new ActionRowBuilder().addComponents(name),
    new ActionRowBuilder().addComponents(region),
    new ActionRowBuilder().addComponents(ign),
    new ActionRowBuilder().addComponents(experience)
  );

  return modal;
}

function gameSelectionMessage() {
  const embed = new EmbedBuilder()
    .setTitle("🎮 Select Your Game")
    .setDescription("Choose the game you mainly want the role for.");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("game_valorant")
      .setLabel("VALORANT")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("game_grandrp")
      .setLabel("Grand RP")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("game_fortnite")
      .setLabel("Fortnite")
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row], ephemeral: true };
}

function applicationButtons(userId, applicationId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`approve:${userId}:${applicationId}`)
      .setLabel("Approve")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`reject:${userId}:${applicationId}`)
      .setLabel("Reject")
      .setStyle(ButtonStyle.Danger)
  );
}

function rejectModal(userId, applicationId) {
  return new ModalBuilder()
    .setCustomId(`reject_reason:${userId}:${applicationId}`)
    .setTitle("Reject Application")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("reason")
          .setLabel("Reason for rejection")
          .setPlaceholder("Enter the reason the application was rejected")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000)
      )
    );
}

async function isStaff(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  return (
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.roles.cache.has(STAFF_ROLE_ID)
  );
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`✅ Logged in as ${readyClient.user.tag}`);

  try {
    await readyClient.application.commands.set([
      {
        name: "setup-verification",
        description: "Post the CAPTCHA verification panel in the verification channel.",
      },
      {
        name: "open_application",
        description: "Open the Family Application Form.",
      },
      {
        name: "my_application",
        description: "Check your current application status.",
      },
    ]);
    console.log("✅ Slash commands registered.");
  } catch (error) {
    console.error("❌ Could not register slash commands:", error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // =========================
    // SLASH COMMANDS
    // =========================
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "setup-verification") {
        if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
          return interaction.reply({
            content: "❌ Only server administrators can use this command.",
            ephemeral: true,
          });
        }

        const channel = interaction.guild.channels.cache.get(
          VERIFICATION_CHANNEL_ID
        );

        if (!channel || !channel.isTextBased()) {
          return interaction.reply({
            content: "❌ Verification channel was not found.",
            ephemeral: true,
          });
        }

        await channel.send(verificationPanel());

        return interaction.reply({
          content: `✅ Verification panel posted in <#${VERIFICATION_CHANNEL_ID}>.`,
          ephemeral: true,
        });
      }

      if (interaction.commandName === "open_application") {
        return interaction.showModal(applicationModal());
      }

      if (interaction.commandName === "my_application") {
        const appData = applications.get(interaction.user.id);

        if (!appData) {
          return interaction.reply({
            content: `❌ You do not have an application yet. Please use the form in <#${REQUEST_ROLE_CHANNEL_ID}>.`,
            ephemeral: true,
          });
        }

        return interaction.reply({
          content:
            `📋 **Application Status:** ${appData.status}\n` +
            (appData.reason ? `\n**Reason:** ${appData.reason}` : ""),
          ephemeral: true,
        });
      }
    }

    // =========================
    // VERIFY BUTTON
    // =========================
    if (interaction.isButton() && interaction.customId === "verify_start") {
      const member = await interaction.guild.members.fetch(interaction.user.id);

      if (member.roles.cache.has(MEMBER_ROLE_ID)) {
        return interaction.reply({
          content:
            `✅ You are already verified. Please fill out the application in <#${REQUEST_ROLE_CHANNEL_ID}>.`,
          ephemeral: true,
        });
      }

      const challenge = makeCaptcha();
      verificationChallenges.set(interaction.user.id, {
        answer: challenge.answer,
        question: `${challenge.a} ${challenge.symbol} ${challenge.b}`,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });

      const captchaModal = new ModalBuilder()
        .setCustomId("captcha_modal")
        .setTitle("CAPTCHA Verification")
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("answer")
              .setLabel(`Solve: ${challenge.question}`)
              .setPlaceholder("Enter the answer")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMaxLength(10)
          )
        );

      return interaction.showModal(captchaModal);
    }

    // =========================
    // CAPTCHA MODAL
    // =========================
    if (interaction.isModalSubmit() && interaction.customId === "captcha_modal") {
      const challenge = verificationChallenges.get(interaction.user.id);

      if (!challenge || challenge.expiresAt < Date.now()) {
        verificationChallenges.delete(interaction.user.id);
        return interaction.reply({
          content: "❌ CAPTCHA expired. Please click Verify again.",
          ephemeral: true,
        });
      }

      const answer = Number.parseInt(
        interaction.fields.getTextInputValue("answer").trim(),
        10
      );

      if (!Number.isInteger(answer) || answer !== challenge.answer) {
        verificationChallenges.delete(interaction.user.id);
        return interaction.reply({
          content: "❌ Incorrect CAPTCHA. Please click Verify and try again.",
          ephemeral: true,
        });
      }

      verificationChallenges.delete(interaction.user.id);
      return sendVerificationSuccess(interaction);
    }

    // =========================
    // APPLICATION MODAL
    // =========================
    if (
      interaction.isModalSubmit() &&
      interaction.customId === "application_modal"
    ) {
      const data = {
        userId: interaction.user.id,
        username: interaction.user.tag,
        name: interaction.fields.getTextInputValue("name"),
        region: interaction.fields.getTextInputValue("region"),
        ign: interaction.fields.getTextInputValue("ign"),
        experience: interaction.fields.getTextInputValue("experience"),
        status: "Pending",
        createdAt: new Date(),
      };

      applications.set(interaction.user.id, data);

      await interaction.reply({
        ...gameSelectionMessage(),
      });
      return;
    }

    // =========================
    // GAME SELECTION
    // =========================
    if (
      interaction.isButton() &&
      ["valorant", "grandrp", "fortnite"].some(
        (game) => interaction.customId === `game_${game}`
      )
    ) {
      const game = interaction.customId.replace("game_", "");
      const appData = applications.get(interaction.user.id);

      if (!appData) {
        return interaction.reply({
          content: "❌ Application data was not found. Please submit again.",
          ephemeral: true,
        });
      }

      appData.game = game;
      applications.set(interaction.user.id, appData);

      const logsChannel = interaction.guild.channels.cache.get(LOGS_CHANNEL_ID);

      if (!logsChannel || !logsChannel.isTextBased()) {
        return interaction.update({
          content: "❌ Logs channel was not found. Please contact staff.",
          embeds: [],
          components: [],
        });
      }

      const applicationId = crypto.randomUUID().slice(0, 8).toUpperCase();
      appData.applicationId = applicationId;

      const embed = new EmbedBuilder()
        .setTitle("📋 New Family Application")
        .setDescription(`Application ID: **${applicationId}**`)
        .addFields(
          { name: "👤 User", value: `<@${appData.userId}>`, inline: true },
          { name: "📝 Name", value: appData.name, inline: true },
          { name: "🌍 Region", value: appData.region, inline: true },
          { name: "🎮 In-Game Name", value: appData.ign, inline: true },
          { name: "⭐ Gaming Experience", value: appData.experience, inline: false },
          { name: "🎯 Game", value: game.toUpperCase(), inline: true },
          { name: "📌 Status", value: "Pending", inline: true }
        )
        .setFooter({ text: "Family Manager • Application System" })
        .setTimestamp();

      const sent = await logsChannel.send({
        embeds: [embed],
        components: [applicationButtons(appData.userId, applicationId)],
      });

      appData.logMessageId = sent.id;
      applications.set(interaction.user.id, appData);

      return interaction.update({
        content: "✅ Your application has been submitted successfully!",
        embeds: [],
        components: [],
      });
    }

    // =========================
    // APPROVE / REJECT BUTTONS
    // =========================
    if (interaction.isButton() && interaction.customId.startsWith("approve:")) {
      if (!(await isStaff(interaction))) {
        return interaction.reply({
          content: "❌ You do not have permission to manage applications.",
          ephemeral: true,
        });
      }

      const [, userId, applicationId] = interaction.customId.split(":");
      const appData = applications.get(userId);

      if (!appData || appData.applicationId !== applicationId) {
        return interaction.reply({
          content: "❌ Application data is no longer available.",
          ephemeral: true,
        });
      }

      appData.status = "Approved";
      applications.set(userId, appData);

      const roleId = GAME_ROLES[appData.game];
      const member = await interaction.guild.members.fetch(userId);

      if (roleId) {
        const role = interaction.guild.roles.cache.get(roleId);
        if (role && role.position < interaction.guild.members.me.roles.highest.position) {
          await member.roles.add(role, "Family application approved");
        }
      }

      const oldEmbed = interaction.message.embeds[0];
      const updated = EmbedBuilder.from(oldEmbed)
        .setColor(0x57f287)
        .setFields(
          ...(oldEmbed.fields || []).filter((f) => f.name !== "📌 Status"),
          { name: "📌 Status", value: "✅ Approved", inline: true }
        )
        .setFooter({ text: `Approved by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.update({
        embeds: [updated],
        components: [],
      });

      try {
        await member.send(
          `🎉 **Your Family Application has been approved!**\n\n` +
          `Your application **${applicationId}** was approved by the staff team.\n` +
          `You have received the appropriate game role.`
        );
      } catch (_) {}

      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("reject:")) {
      if (!(await isStaff(interaction))) {
        return interaction.reply({
          content: "❌ You do not have permission to manage applications.",
          ephemeral: true,
        });
      }

      const [, userId, applicationId] = interaction.customId.split(":");
      return interaction.showModal(rejectModal(userId, applicationId));
    }

    // =========================
    // REJECTION REASON MODAL
    // =========================
    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("reject_reason:")
    ) {
      if (!(await isStaff(interaction))) {
        return interaction.reply({
          content: "❌ You do not have permission to manage applications.",
          ephemeral: true,
        });
      }

      const [, userId, applicationId] = interaction.customId.split(":");
      const reason = interaction.fields.getTextInputValue("reason").trim();
      const appData = applications.get(userId);

      if (!appData || appData.applicationId !== applicationId) {
        return interaction.reply({
          content: "❌ Application data is no longer available.",
          ephemeral: true,
        });
      }

      appData.status = "Rejected";
      appData.reason = reason;
      applications.set(userId, appData);

      const oldEmbed = interaction.message.embeds[0];
      const updated = EmbedBuilder.from(oldEmbed)
        .setColor(0xed4245)
        .setFields(
          ...(oldEmbed.fields || []).filter(
            (f) => f.name !== "📌 Status" && f.name !== "❌ Rejection Reason"
          ),
          { name: "📌 Status", value: "❌ Rejected", inline: true },
          { name: "❌ Rejection Reason", value: reason, inline: false }
        )
        .setFooter({ text: `Rejected by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.update({
        embeds: [updated],
        components: [],
      });

      try {
        const member = await interaction.guild.members.fetch(userId);
        await member.send(
          `❌ **Your Family Application was rejected.**\n\n` +
          `Application: **${applicationId}**\n` +
          `**Reason:** ${reason}\n\n` +
          `You may re-apply after addressing the reason above.`
        );
      } catch (_) {}

      return;
    }
  } catch (error) {
    console.error("❌ Interaction error:", error);

    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Something went wrong. Please try again or contact staff.",
        ephemeral: true,
      }).catch(() => {});
    }
  }
});

client.on(Events.Error, (error) => {
  console.error("❌ Discord client error:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled promise rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught exception:", error);
});

client.login(TOKEN);
