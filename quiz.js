import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
} from "discord.js";
import fetch from "node-fetch";

export const quizCommand = new SlashCommandBuilder()
  .setName("quiz")
  .setDescription("Start a 3-question Sentient quiz!");

const leaderboard = {};
const activeQuestions = new Map();

async function getQuizQuestions() {
  try {
    const response = await fetch("https://api.fireworks.ai/inference/v1/chat/completions", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.FIREWORKS_API_KEY}`
      },
      body: JSON.stringify({
        model: "accounts/sentientfoundation/models/dobby-unhinged-llama-3-3-70b-new",
        max_tokens: 512,
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: "You are Dobby a quiz generator, your questions will be only focused on Sentient AGI project. Docs: https://github.com/sentient-agi/ROMA, https://blog.sentient.xyz/posts/what-is-sentient , https://blog.sentient.xyz/posts/what-is-grid."
          },
          {
            role: "user",
            content: "Generate 3 questions in JSON array format: [{ question: string, options: [4 strings], correct: index }]. Only output JSON."
          }
        ]
      })
    });

    const data = await response.json();
    console.log("📥 API response:", data);

    const clean = data?.choices?.[0]?.message?.content
      ?.replace(/```json/i, "")
      ?.replace(/```/g, "")
      ?.trim();

    const parsed = JSON.parse(clean);
    if (!Array.isArray(parsed) || parsed.length !== 3) {
      throw new Error("Unexpected question format");
    }

    return parsed;
  } catch (err) {
    console.error("❌ Error fetching quiz:", err);
    return null;
  }
}

export async function handleQuiz(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const channelId = interaction.channel.id;
  if (activeQuestions.has(channelId)) {
    return interaction.followUp({
      content: "⚠️ A quiz is already active in this channel!",
      ephemeral: true
    });
  }

  for (const key in leaderboard) delete leaderboard[key];

  const questions = await getQuizQuestions();
  if (!questions) {
    return interaction.followUp({
      content: "⚠️ Could not fetch quiz questions. Try again later.",
      ephemeral: true
    });
  }

  await interaction.followUp({
    content: "🧠 Quiz started!",
    ephemeral: true
  });

  activeQuestions.set(channelId, {
    questions,
    answeredUsers: new Set(),
    questionNumber: 1
  });

  sendNextQuestion(interaction.channel, channelId);
}

// Send Question
async function sendNextQuestion(channel, channelId) {
  const active = activeQuestions.get(channelId);
  if (!active) return;

  const currentIndex = active.questionNumber - 1;
  if (currentIndex >= active.questions.length) {
    const board = Object.entries(leaderboard)
      .sort((a, b) => b[1] - a[1])
      .map(([id, score], i) => `${i + 1}. <@${id}> — ${score} points`)
      .join("\n") || "No participants 😅";

    channel.send(`🏆 **Quiz Over! Leaderboard:**\n${board}`);
    activeQuestions.delete(channelId);
    return;
  }

  const q = active.questions[currentIndex];

  const row = new ActionRowBuilder().addComponents(
    q.options.map((opt, index) =>
      new ButtonBuilder()
        .setCustomId(`quiz_${index}_${q.correct}_${active.questionNumber}`)
        .setLabel(opt)
        .setStyle(ButtonStyle.Primary)
    )
  );

  const embed = new EmbedBuilder()
    .setTitle(`🧠 Question ${active.questionNumber}`)
    .setDescription(q.question)
    .setColor("Blue");

  const message = await channel.send({ embeds: [embed], components: [row] });
  active.messageId = message.id;
  active.answeredUsers = new Set(); 
}

export function quizButtonHandler(client) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;

    const channelId = interaction.channel.id;
    const active = activeQuestions.get(channelId);
    if (!active) return;

    const [_, choice, correct, qNumber] = interaction.customId.split("_");
    const clickedIndex = parseInt(choice);
    const correctIndex = parseInt(correct);
    const userId = interaction.user.id;

    if (active.answeredUsers.has(userId)) {
      return interaction.reply({
        content: "❌ You already answered this question.",
        ephemeral: true
      });
    }

    active.answeredUsers.add(userId);

    if (clickedIndex === correctIndex) {
      const row = new ActionRowBuilder().addComponents(
        interaction.message.components[0].components.map((btn, i) =>
          new ButtonBuilder()
            .setLabel(btn.label)
            .setCustomId(btn.customId)
            .setStyle(i === correctIndex ? ButtonStyle.Success : ButtonStyle.Danger)
            .setDisabled(true)
        )
      );

      await interaction.update({ components: [row] });

      leaderboard[userId] = (leaderboard[userId] || 0) + 1;

      await interaction.followUp({
        content: `✅ Correct, ${interaction.user}!`,
        ephemeral: true
      });

      active.questionNumber += 1;
      setTimeout(() => sendNextQuestion(interaction.channel, channelId), 2000);

    } else {
      const row = new ActionRowBuilder().addComponents(
        interaction.message.components[0].components.map((btn, i) =>
          new ButtonBuilder()
            .setLabel(btn.label)
            .setCustomId(btn.customId)
            .setStyle(
              i === correctIndex
                ? ButtonStyle.Success
                : i === clickedIndex
                ? ButtonStyle.Secondary
                : ButtonStyle.Danger
            )
            .setDisabled(i === clickedIndex)
        )
      );

      await interaction.reply({
        content: `❌ Wrong!`,
        components: [row],
        ephemeral: true
      });
    }
  });
}
