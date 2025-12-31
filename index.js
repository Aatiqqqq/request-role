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

// ========= CONFIG =========
const TOKEN = process.env.TOKEN;
const REQUEST_ROLE_CHANNEL_ID = "1454175656182288596";
const LOGS_CHANNEL_ID = "1433167140201955581";
const STAFF_ROLE_ID = "1433160218703040674"; // staff who can approve/reject
// ==========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ]
});

// ===== READY =====
client.once("clientReady", async () => {
  console.log("✅ Family Application Bot Online");

  // Post panel automatically
  const channel = await client.channels.fetch(REQUEST_ROLE_CHANNEL_ID);

  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle("👑 Welcome to Family")
    .setDescription(
      "Please fill your data **correctly** by pressing the button below.\n\n" +
      "📋 **Family Role Application**"
    )
    .setFooter({ text: "Family Application System" });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("open_application")
      .setLabel("✍️ Fill Application")
      .setStyle(ButtonStyle.Primary)
  );

  await channel.send({ embeds: [embed], components: [row] });
});

// ===== INTERACTIONS =====
client.on("interactionCreate", async interaction => {

  /* ───── OPEN MODAL ───── */
  if (interaction.isButton() &&
      interaction.customId === "open_application") {

    const modal = new ModalBuilder()
      .setCustomId("family_application")
      .setTitle("Family Application");

    const name = new TextInputBuilder()
      .setCustomId("name")
      .setLabel("👤 Name")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const region = new TextInputBuilder()
      .setCustomId("region")
      .setLabel("🌍 Region")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const ign = new TextInputBuilder()
      .setCustomId("ign")
      .setLabel("🎮 In-Game Name")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(name),
      new ActionRowBuilder().addComponents(region),
      new ActionRowBuilder().addComponents(ign)
    );

    return interaction.showModal(modal);
  }

  /* ───── SUBMIT APPLICATION ───── */
  if (interaction.isModalSubmit() &&
      interaction.customId === "family_application") {

    const name = interaction.fields.getTextInputValue("name");
    const region = interaction.fields.getTextInputValue("region");
    const ign = interaction.fields.getTextInputValue("ign");

    const logs = await client.channels.fetch(LOGS_CHANNEL_ID);

    const embed = new EmbedBuilder()
      .setColor(0xffff00)
      .setTitle("📥 New Family Application")
      .addFields(
        { name: "👤 Name", value: name, inline: true },
        { name: "🌍 Region", value: region, inline: true },
        { name: "🎮 In-Game Name", value: ign, inline: true },
        { name: "👤 Applicant", value: interaction.user.tag, inline: false },
        { name: "📌 Status", value: "⏳ Pending", inline: false }
      )
      .setFooter({ text: interaction.user.id })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("approve")
        .setLabel("✅ Approve")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("reject")
        .setLabel("❌ Reject")
        .setStyle(ButtonStyle.Danger)
    );

    await logs.send({ embeds: [embed], components: [row] });

    return interaction.reply({
      content: "✅ Application submitted successfully!",
      ephemeral: true
    });
  }

  /* ───── APPROVE / REJECT ───── */
  if (interaction.isButton() &&
      (interaction.customId === "approve" ||
       interaction.customId === "reject")) {

    // Staff check
    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
      return interaction.reply({
        content: "❌ You are not authorized to do this.",
        ephemeral: true
      });
    }

    const embed = EmbedBuilder.from(interaction.message.embeds[0]);
    const userId = embed.footer.text;
    const user = await client.users.fetch(userId);

    const approved = interaction.customId === "approve";

    embed.setColor(approved ? 0x00ff00 : 0xff0000);
    embed.spliceFields(4, 1, {
      name: "📌 Status",
      value: approved ? "✅ Approved" : "❌ Rejected"
    });
    embed.addFields({
      name: "👮 Handled By",
      value: interaction.user.tag
    });

    await interaction.message.edit({
      embeds: [embed],
      components: []
    });

    // DM applicant
    await user.send(
      approved
        ? "🎉 **Your family application has been APPROVED!**"
        : "❌ **Your family application has been REJECTED.**"
    ).catch(() => {});

    return interaction.reply({
      content: "✅ Action completed.",
      ephemeral: true
    });
  }
});

client.login(TOKEN);
