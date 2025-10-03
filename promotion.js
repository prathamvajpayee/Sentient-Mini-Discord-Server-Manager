
async function promotion(interaction, UserStats) {
    
    if(!interaction.isChatInputCommand()) return
    const allowedRoles = ["Helper", "OG"];
    const roleName = interaction.options.getString("choice")
    
    if (interaction.member.roles.cache.some(r => r.name === roleName)) {
        return interaction.reply({ content: "❌ You already picked this role!", ephemeral: true });
    }
    const role = interaction.guild.roles.cache.find(r => r.name === roleName)
    if(!role){
        return interaction.reply({ content: "❌ Role not found.", ephemeral: true });
    }
    let stats = await UserStats.findOne({userId:interaction.user.id})
    
    if(stats.messages > 10 || stats.messages > 50){
        await interaction.member.roles.add(role)
        await interaction.reply({
        content: `✅ ${interaction.user} has been promoted to **${roleName}**!`,
        ephemeral: false
        });
    }
    else{
         await interaction.reply({
        content: `❌ ${interaction.user} is not worthy of **${roleName}**!`,
        ephemeral: true
        });
    }
    
        stats.roles.push(role.id)
        await stats.save()

}

export default promotion;
