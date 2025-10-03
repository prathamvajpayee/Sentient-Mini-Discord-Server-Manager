import "dotenv/config";
import { Client, Events, GatewayIntentBits, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import fetch from "node-fetch";
import promotion from "./promotion.js";
import UserStats from "./schema.js";
import mongoose from "mongoose";
import { quizCommand, handleQuiz, quizButtonHandler } from "./quiz.js";

const bannedWords = [
  "fuck", "shit", "bitch", "asshole", "bastard",
  "dick", "pussy", "cunt", "motherfucker",
  "retard", "faggot", "nigger", "tranny",
  "free nitro", "discord nitro", "airdrop", "giveaway",
  // "http://", "https://", 
];

await mongoose.connect("process.env.MONGODB_URI")


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready",async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log("✅ Bot is ready! Registering quiz handler...");
  quizButtonHandler(client);


  const guild = client.guilds.cache.get("1423083022466551953");
    const channel = guild.channels.cache.find(c => c.name === "verify" && c.isTextBased());
    console.log(channel)
    await channel.bulkDelete(1)
    if (!channel) return console.log("Channel not found!");

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("verify_button")
                .setLabel("✅ Verify Me")
                .setStyle(ButtonStyle.Success)
        );
    
      const embed = new EmbedBuilder()
            .setTitle("Server Verification")
            .setDescription(`Welcome!
              Click the button below to verify yourself`)
            .setColor(0x00FF00)

    await channel.send({
        embeds:[embed],
        components: [row],
        ephemeral: true
    });

    console.log("✅ Verification message sent!");
});
client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "quiz") {
      await handleQuiz(interaction);
    }
  }
});

client.on("interactionCreate", async(interaction)=>{
  if(!interaction.isButton()) return

  if(interaction.customId === "verify_button"){
    const role = interaction.guild.roles.cache.find(r => r.name === "Verified"); 

    if (!role) {
            return interaction.reply({ content: "❌ Verified role not found!", ephemeral: true });
    }

    if(interaction.member.roles.cache.has(role.id)){
            return interaction.reply({ content: "✅ You are already verified!", ephemeral: true });
    }

    await interaction.member.roles.add(role)
    await UserStats.create({guildId: interaction.guildId, userId:interaction.user.id, roles:[role.id]})
    await interaction.reply({ content: `🎉 ${interaction.user} You are now verified!`, ephemeral: true });
  }

})

client.on(Events.InteractionCreate, async (interaction) => {
  if(interaction.commandName === "role" && interaction.channel.name == "role"){
  promotion(interaction, UserStats)
  
  }
})


client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  let stats = await UserStats.findOne({userId:message.author.id})

  if(bannedWords.some(word => message.content.toLowerCase().includes(word))){
    message.delete()
    stats.warnings++
    await stats.save()
    return message.channel.send(`🤡<@${message.author.id}>, that word isn't allowed.`)
          .then(botMessage => {
          setTimeout(() => {
              botMessage.delete().catch(err => console.log(err));
          }, 3000);
      });
  }

  stats.messages += message.content.length
  stats.lastActive = Date.now()
  await stats.save()

  if (message.channel.name === "karma" && message.content === "!check") {
        const embed = new EmbedBuilder()
            .setTitle("📊 Karma Balance")
            .setDescription(`Balance: **${stats.messages}** \n `)
            .setColor(0x00FF00);

        message.reply({ embeds: [embed] });
    }

  if (message.content.startsWith("!ask")) {
    const prompt = message.content.replace("!ask", "").trim();
    if (!prompt) {
      message.reply("❌ Please provide a question.");
      return;
    }

    message.channel.send("🤖 Thinking...")
     .then(async(botMessage) => {
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
                  { role: "system", content: "You are a proffessional Dobby, a very helpful, wise, neutral AI Discord Server Manager. You are product of the company Sentient AGI. So you need to be more focused on Sentient AGI. You dont use absusive language at all. You are very good AI and supportive and very positive. You dont use abusive words. You always write response in a very professional format for clear visibility of messages." },
                  { role: "user", content:"How to get roles ?"},
                  { role:""},
                  {"role": "user", "content": "How do I start the quiz?"},
                  {"role": "assistant", "content": "🧠 Quiz Time!\nTo start, use `/quiz` in #quiz channel. Each question must be answered before the next one appears. Correct answers increase your leaderboard points."},
                  { role: "user", content: prompt }
                ]
              })
            });
            
            const data = await response.json();
            const answer = data?.choices?.[0]?.message?.content || "⚠️ No response.";
            
            message.reply(answer);
            botMessage.delete().catch(err => console.log(err));
          } catch (err) {
            console.error(err);
            message.reply("❌ Error talking to Dobby.")
            .then(async(botMessage2)=>{
              setTimeout(() => {
                botMessage2.delete().catch(err => console.log(err));
              }, 5000);
            })
            botMessage.delete().catch(err => console.log(err));
          }
      });

  }
});

client.login(process.env.DISCORD_BOT_TOKEN);

