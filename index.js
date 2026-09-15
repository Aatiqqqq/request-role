// ============================================================
// FAMILY APPLICATION BOT
// Discord.js v14
// ============================================================

const express = require("express");

process.on("unhandledRejection", err => console.error("Unhandled Rejection:", err));
process.on("uncaughtException", err => console.error("Uncaught Exception:", err));

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

// ============================================================
// CONFIG
// ============================================================

const TOKEN = process.env.TOKEN;

const REQUEST_ROLE_CHANNEL_ID = "1454175656182288596";
const LOGS_CHANNEL_ID = "1456002175707906129";
const STAFF_ROLE_ID = "1433112127287332964";

const GAME_ROLES = {
  valorant: "1436304907551375390",
  grandrp: "1433136876574736484",
  fortnite: "1433333680436416552"
};

const GAME_INFO = {
  valorant: {
    label: "VALORANT",
    emoji: "🔫",
    roleId: GAME_ROLES.valorant
  },
  grandrp: {
    label: "Grand RP",
    emoji: "🫀",
    roleId: GAME_ROLES.grandrp
  },
  fortnite: {
    label: "Fortnite",
    emoji: "🪓",
    roleId: GAME_ROLES.fortnite
  }
};

const APPLICATION_COOLDOWN = 10 * 60 * 1000;

// ============================================================
// RENDER WEB SERVER
// ============================================================

const app = express();

app.get("/", (req, res) => {
  res.status(200).send("Family Application Bot is online.");
});

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Web server listening on port ${PORT}`);
});

// ============================================================
// CLIENT
// ============================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ============================================================
// TEMPORARY APPLICATION DATA
// ============================================================

const pendingSelections = new Map();
const cooldowns = new Map();
let applicationCounter = 0;

// ============================================================
// HELPERS
// ============================================================

function createApplicationId() {
  applicationCounter++;
  const time = Date.now().toString(36).toUpperCase();
  return `FAM-${time}-${String(applicationCounter).padStart(3, "0")}`;
}

function getGameButtons(userId, selectedGames = []) {
  const row = new ActionRowBuilder();

  for (const [key, game] of Object.entries(GAME_INFO)) {
    const selected = selectedGames.includes(key);

    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`game:${key}:${userId}`)
        .setLabel(`${selected ? "✅ " : ""}${game.label}`)
        .setEmoji(game.emoji)
        .setStyle(selected ? ButtonStyle.Success : ButtonStyle.Secondary)
    );
  }

  return row;
}

function getConfirmButton(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`confirm_games:${userId}`)
      .setLabel("Confirm Game Selection")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Primary)
  );
}

function getSelectedGameText(selectedGames) {
  if (!selectedGames.length) return "None selected";

  return selectedGames
    .map(game => `${GAME_INFO[game].emoji} **${GAME_INFO[game].label}**`)
    .join("\n");
}

function isStaff(member) {
  return member?.roles?.cache?.has(STAFF_ROLE_ID);
}

// ============================================================
// READY
// ============================================================

client.once("clientReady", async () => {
  console.log("=================================");
  console.log("✅ Family Application Bot Online");
  console.log(`🤖 Logged in as ${client.user.tag}`);
  console.log("=================================");

  try {
    const channel = await client.channels.fetch(REQUEST_ROLE_CHANNEL_ID);

    if (!channel) {
      console.error("❌ Application channel not found.");
      return;
    }

    const messages = await channel.messages.fetch({ limit: 50 });

    const existingPanel = messages.find(message =>
      message.author.id === client.user.id &&
      message.components.some(row =>
        row.components.some(component =>
          component.customId === "open_application"
        )
      )
    );

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("👑 Welcome to Family")
      .setDescription(
        "Welcome! If you want to join our family, submit your application using the button below.\n\n" +
        "📋 **Application Requirements**\n" +
        "• Enter your real information correctly\n" +
        "• Provide your correct in-game name\n" +
        "• Tell us your gaming experience\n" +
        "• Select all games you currently play\n\n" +
        "🎮 **Available Games**\n" +
        "🔫 VALORANT\n" +
        "🫀 Grand RP\n" +
        "🪓 Fortnite\n\n" +
        "⚠️ Please make sure all information is correct before submitting."
      )
      .setFooter({ text: "Family Application System" })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("open_application")
        .setLabel("Fill Application")
        .setEmoji("✍️")
        .setStyle(ButtonStyle.Primary)
    );

    if (existingPanel) {
      await existingPanel.edit({ embeds: [embed], components: [row] });
      console.log("📌 Existing application panel updated.");
    } else {
      await channel.send({ embeds: [embed], components: [row] });
      console.log("📌 New application panel created.");
    }
  } catch (err) {
    console.error("❌ Error setting application panel:", err);
  }
});

// ============================================================
// INTERACTIONS
// ============================================================

client.on("interactionCreate", async interaction => {
  // ==========================================================
  // OPEN APPLICATION
  // ==========================================================

  if (interaction.isButton() && interaction.customId === "open_application") {
    const existingCooldown = cooldowns.get(interaction.user.id);

    if (
      existingCooldown &&
      Date.now() - existingCooldown < APPLICATION_COOLDOWN
    ) {
      const remaining = Math.ceil(
        (APPLICATION_COOLDOWN - (Date.now() - existingCooldown)) / 60000
      );

      return interaction.reply({
        content:
          `⏳ You recently submitted an application.\n` +
          `Please wait approximately **${remaining} minute(s)** before submitting another.`,
        ephemeral: true
      });
    }

    const modal = new ModalBuilder()
      .setCustomId("family_application")
      .setTitle("Family Application");

    const name = new TextInputBuilder()
      .setCustomId("name")
      .setLabel("👤 Name")
      .setPlaceholder("Enter your name")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(50);

    const region = new TextInputBuilder()
      .setCustomId("region")
      .setLabel("🌍 Region")
      .setPlaceholder("Example: India / Kashmir")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(50);

    const ign = new TextInputBuilder()
      .setCustomId("ign")
      .setLabel("🎮 In-Game Name")
      .setPlaceholder("Enter your exact in-game name")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const experience = new TextInputBuilder()
      .setCustomId("experience")
      .setLabel("⭐ Gaming Experience")
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

    return interaction.showModal(modal);
  }

  // ==========================================================
  // APPLICATION SUBMITTED
  // ==========================================================

  if (
    interaction.isModalSubmit() &&
    interaction.customId === "family_application"
  ) {
    const name = interaction.fields.getTextInputValue("name");
    const region = interaction.fields.getTextInputValue("region");
    const ign = interaction.fields.getTextInputValue("ign");
    const experience = interaction.fields.getTextInputValue("experience");

    const applicationId = createApplicationId();

    pendingSelections.set(interaction.user.id, {
      applicationId,
      name,
      region,
      ign,
      experience,
      selectedGames: [],
      createdAt: Date.now()
    });

    return interaction.reply({
      content:
        "## 🎮 Choose Your Games\n\n" +
        "Select **one or multiple games** that you play.\n\n" +
        "You can select all three if you want.\n\n" +
        "After selecting your games, press **Confirm Game Selection**.",

      embeds: [
        new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle("🎮 Game Selection")
          .setDescription(
            `**Application ID:** \`${applicationId}\`\n\n` +
            "Choose your game roles below.\n\n" +
            "🔫 VALORANT\n" +
            "🫀 Grand RP\n" +
            "🪓 Fortnite"
          )
          .setFooter({ text: "You can select multiple games." })
      ],

      components: [
        getGameButtons(interaction.user.id),
        getConfirmButton(interaction.user.id)
      ],

      ephemeral: true
    });
  }

  // ==========================================================
  // GAME ROLE SELECTION
  // ==========================================================

  if (interaction.isButton() && interaction.customId.startsWith("game:")) {
    const [, gameKey, userId] = interaction.customId.split(":");

    if (interaction.user.id !== userId) {
      return interaction.reply({
        content: "❌ These game selection buttons belong to another user.",
        ephemeral: true
      });
    }

    const application = pendingSelections.get(interaction.user.id);

    if (!application) {
      return interaction.reply({
        content:
          "❌ Your application session has expired. Please start a new application.",
        ephemeral: true
      });
    }

    if (!GAME_INFO[gameKey]) {
      return interaction.reply({
        content: "❌ Invalid game selection.",
        ephemeral: true
      });
    }

    const selected = application.selectedGames;

    if (selected.includes(gameKey)) {
      application.selectedGames = selected.filter(game => game !== gameKey);
    } else {
      application.selectedGames.push(gameKey);
    }

    pendingSelections.set(interaction.user.id, application);

    return interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle("🎮 Game Selection")
          .setDescription(
            `**Application ID:** \`${application.applicationId}\`\n\n` +
            "**Your selected games:**\n" +
            getSelectedGameText(application.selectedGames) +
            "\n\nSelect more games or press **Confirm Game Selection**."
          )
      ],
      components: [
        getGameButtons(interaction.user.id, application.selectedGames),
        getConfirmButton(interaction.user.id)
      ]
    });
  }

  // ==========================================================
  // CONFIRM GAME SELECTION
  // ==========================================================

  if (
    interaction.isButton() &&
    interaction.customId.startsWith("confirm_games:")
  ) {
    const [, userId] = interaction.customId.split(":");

    if (interaction.user.id !== userId) {
      return interaction.reply({
        content: "❌ This selection belongs to another user.",
        ephemeral: true
      });
    }

    const application = pendingSelections.get(interaction.user.id);

    if (!application) {
      return interaction.reply({
        content:
          "❌ Your application session has expired. Please start a new application.",
        ephemeral: true
      });
    }

    if (!application.selectedGames.length) {
      return interaction.reply({
        content:
          "⚠️ Please select at least **one game** before confirming.",
        ephemeral: true
      });
    }

    await interaction.deferUpdate();

    try {
      const member = await interaction.guild.members.fetch(interaction.user.id);

      const allGameRoleIds = Object.values(GAME_ROLES);

      for (const roleId of allGameRoleIds) {
        if (
          member.roles.cache.has(roleId) &&
          !application.selectedGames.some(
            game => GAME_INFO[game].roleId === roleId
          )
        ) {
          try {
            await member.roles.remove(roleId);
          } catch (err) {
            console.error(`Could not remove role ${roleId}:`, err);
          }
        }
      }

      for (const game of application.selectedGames) {
        const roleId = GAME_INFO[game].roleId;

        if (!member.roles.cache.has(roleId)) {
          try {
            await member.roles.add(roleId);
          } catch (err) {
            console.error(`Could not add role ${roleId}:`, err);
          }
        }
      }

      const logs = await client.channels.fetch(LOGS_CHANNEL_ID);

      if (!logs) {
        throw new Error("Logs channel not found.");
      }

      const selectedGamesText = application.selectedGames
        .map(game => {
          const info = GAME_INFO[game];
          return `${info.emoji} **${info.label}**`;
        })
        .join("\n");

      const embed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle("📥 New Family Application")
        .setDescription(
          `### Application ID\n\`${application.applicationId}\`\n\n` +
          `👤 **Applicant:** ${interaction.user}\n` +
          `🆔 **Discord ID:** \`${interaction.user.id}\``
        )
        .addFields(
          {
            name: "👤 Name",
            value: application.name,
            inline: true
          },
          {
            name: "🌍 Region",
            value: application.region,
            inline: true
          },
          {
            name: "🎮 In-Game Name",
            value: application.ign,
            inline: true
          },
          {
            name: "⭐ Gaming Experience",
            value: application.experience,
            inline: false
          },
          {
            name: "🎮 Selected Games",
            value: selectedGamesText,
            inline: false
          },
          {
            name: "📌 Status",
            value: "⏳ Pending",
            inline: true
          },
          {
            name: "🕐 Submitted",
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: true
          }
        )
        .setThumbnail(
          interaction.user.displayAvatarURL({ size: 256 })
        )
        .setFooter({ text: "Family Application System" })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(
            `approve:${interaction.user.id}:${application.applicationId}`
          )
          .setLabel("Approve")
          .setEmoji("✅")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId(
            `reject:${interaction.user.id}:${application.applicationId}`
          )
          .setLabel("Reject")
          .setEmoji("❌")
          .setStyle(ButtonStyle.Danger)
      );

      await logs.send({
        content: `${interaction.user}`,
        embeds: [embed],
        components: [row]
      });

      cooldowns.set(interaction.user.id, Date.now());
      pendingSelections.delete(interaction.user.id);

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle("✅ Application Submitted")
            .setDescription(
              `Your application has been successfully submitted!\n\n` +
              `📋 **Application ID:** \`${application.applicationId}\`\n\n` +
              `🎮 **Selected Games:**\n` +
              selectedGamesText +
              `\n\n` +
              "Your selected game roles have been updated.\n" +
              "Our staff will review your application shortly."
            )
            .setFooter({ text: "Family Application System" })
            .setTimestamp()
        ],
        components: []
      });
    } catch (err) {
      console.error("❌ Application confirmation error:", err);

      return interaction.editReply({
        content:
          "❌ Something went wrong while submitting your application. Please contact staff.",
        embeds: [],
        components: []
      });
    }
  }

  // ==========================================================
  // APPROVE
  // ==========================================================

  if (interaction.isButton() && interaction.customId.startsWith("approve:")) {
    const member = await interaction.guild.members.fetch(interaction.user.id);

    if (!isStaff(member)) {
      return interaction.reply({
        content: "❌ You do not have permission to handle applications.",
        ephemeral: true
      });
    }

    const parts = interaction.customId.split(":");
    const userId = parts[1];
    const applicationId = parts[2];

    await interaction.deferUpdate();

    try {
      const user = await client.users.fetch(userId);
      const oldEmbed = interaction.message.embeds[0];

      const updatedEmbed = EmbedBuilder.from(oldEmbed)
        .setColor(0x57F287);

      const fields = updatedEmbed.data.fields || [];
      const statusIndex = fields.findIndex(
        field => field.name === "📌 Status"
      );

      if (statusIndex !== -1) {
        fields[statusIndex] = {
          name: "📌 Status",
          value: "✅ Approved",
          inline: true
        };
      }

      updatedEmbed.setFields(fields);

      updatedEmbed.addFields({
        name: "👮 Handled By",
        value: `${interaction.user}\n\`${interaction.user.tag}\``,
        inline: true
      });

      updatedEmbed.addFields({
        name: "🕐 Decision",
        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
        inline: false
      });

      updatedEmbed.setFooter({
        text: `Family Application • ${applicationId}`
      });

      await interaction.message.edit({
        embeds: [updatedEmbed],
        components: []
      });

      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle("🎉 Family Application Approved!")
          .setDescription(
            "Congratulations! Your family application has been **approved** by our staff."
          )
          .addFields({
            name: "📋 Application ID",
            value: `\`${applicationId}\``
          })
          .setFooter({ text: "Family Application System" })
          .setTimestamp();

        await user.send({ embeds: [dmEmbed] });
      } catch (err) {
        console.log(
          `⚠️ Could not DM ${user.tag}. Their DMs may be disabled.`
        );
      }

      console.log(
        `✅ Application ${applicationId} approved by ${interaction.user.tag}`
      );
    } catch (err) {
      console.error("❌ Approve error:", err);
    }

    return;
  }

  // ==========================================================
  // REJECT -> OPEN REASON MODAL
  // ==========================================================

  if (interaction.isButton() && interaction.customId.startsWith("reject:")) {
    const member = await interaction.guild.members.fetch(interaction.user.id);

    if (!isStaff(member)) {
      return interaction.reply({
        content: "❌ You do not have permission to handle applications.",
        ephemeral: true
      });
    }

    const parts = interaction.customId.split(":");
    const userId = parts[1];
    const applicationId = parts[2];

    const modal = new ModalBuilder()
      .setCustomId(`reject_reason:${userId}:${applicationId}`)
      .setTitle("Reject Application");

    const reason = new TextInputBuilder()
      .setCustomId("reason")
      .setLabel("Reason for rejection")
      .setPlaceholder("Enter the reason for rejecting this application...")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMinLength(2)
      .setMaxLength(1000);

    modal.addComponents(
      new ActionRowBuilder().addComponents(reason)
    );

    return interaction.showModal(modal);
  }

  // ==========================================================
  // REJECTION REASON SUBMITTED
  // ==========================================================

  if (
    interaction.isModalSubmit() &&
    interaction.customId.startsWith("reject_reason:")
  ) {
    const parts = interaction.customId.split(":");
    const userId = parts[1];
    const applicationId = parts[2];

    const member = await interaction.guild.members.fetch(interaction.user.id);

    if (!isStaff(member)) {
      return interaction.reply({
        content: "❌ You do not have permission to handle applications.",
        ephemeral: true
      });
    }

    const reason = interaction.fields.getTextInputValue("reason").trim();

    await interaction.deferReply({ ephemeral: true });

    try {
      const user = await client.users.fetch(userId);

      const message = await interaction.channel.messages.fetch(
        interaction.message.id
      );

      const oldEmbed = message.embeds[0];

      const updatedEmbed = EmbedBuilder.from(oldEmbed)
        .setColor(0xED4245);

      const fields = updatedEmbed.data.fields || [];
      const statusIndex = fields.findIndex(
        field => field.name === "📌 Status"
      );

      if (statusIndex !== -1) {
        fields[statusIndex] = {
          name: "📌 Status",
          value: "❌ Rejected",
          inline: true
        };
      }

      updatedEmbed.setFields(fields);

      updatedEmbed.addFields(
        {
          name: "❌ Rejection Reason",
          value: reason,
          inline: false
        },
        {
          name: "👮 Handled By",
          value: `${interaction.user}\n\`${interaction.user.tag}\``,
          inline: true
        },
        {
          name: "🕐 Decision",
          value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: false
        }
      );

      updatedEmbed.setFooter({
        text: `Family Application • ${applicationId}`
      });

      await message.edit({
        embeds: [updatedEmbed],
        components: []
      });

      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle("❌ Family Application Rejected")
          .setDescription(
            "Unfortunately, your family application has been **rejected** by our staff."
          )
          .addFields(
            {
              name: "📋 Application ID",
              value: `\`${applicationId}\``
            },
            {
              name: "❌ Reason",
              value: reason
            }
          )
          .setFooter({ text: "Family Application System" })
          .setTimestamp();

        await user.send({ embeds: [dmEmbed] });
      } catch (err) {
        console.log(
          `⚠️ Could not DM ${user.tag}. Their DMs may be disabled.`
        );
      }

      console.log(
        `❌ Application ${applicationId} rejected by ${interaction.user.tag}. Reason: ${reason}`
      );

      return interaction.editReply({
        content: "✅ Application rejected and the reason has been recorded."
      });
    } catch (err) {
      console.error("❌ Reject error:", err);

      return interaction.editReply({
        content: "❌ Something went wrong while rejecting the application."
      });
    }
  }
});

// ============================================================
// LOGIN
// ============================================================

if (!TOKEN) {
  console.error("❌ TOKEN environment variable is missing!");
  process.exit(1);
}

client.login(TOKEN);
