const { mongoose } = require("mongoose")
require("dotenv").config()
const { Bot, InlineKeyboard, session } = require("grammy")
const { ethers } = require("ethers")

//Mongoose Connection String

mongoose.connect("mongodb://127.0.0.1:27017/test").then(() => {
    console.log("MongoDb is successfully connected")
}).catch((e) => {
    console.log("Some error might have occured", e)
})

//Schema Creation

const txSchema = new mongoose.Schema({
    _id : String,
    data : Object,
})
const txModel = new mongoose.model("faucetTx",txSchema);

//Creation of Wallet

const provider = new ethers.JsonRpcProvider(process.env.RPC)
const wallet = new ethers.Wallet(
    process.env.PRIVATE_KEY,
    provider
);

// Creating Session Storage

const mongoLegacyStorage = () => ({
    async read(key) {
        try {
            if(!txModel)
                throw new Error("MongoDB is not ready")
            const doc = await txModel.findById(key).lean()
            return doc?.data || {}
        } catch (error) {
            console.log("Error in read")
            console.log(error)
        }
    },
    async write (key, data){
        try {
            await txModel.findOneAndUpdate(
                { _id: key },
                { data },
                { upsert: true, new: true }
            )
        } catch (error) {
            console.log("Error in Write")
            console.log(error)
        }
    }
})

const bot = new Bot(process.env.BOT_API)
bot.use(session({
    initial: () => ({ _id: null, walletAddress: null, lastClaim: null, step: false }),
    storage: mongoLegacyStorage(),
    getSessionKey: (ctx) => ctx.from?.id.toString()
}
))



bot.command("start", async (ctx) => {
    ctx.reply("Hello Welcome to my bot")
    await ctx.reply("Come Here Every 24 Hours to collect free MONAD faucets", {
        reply_markup: new InlineKeyboard()
            .url("\u2705 Join My Group", "https://t.me/InfinityLoot").row()
            .url("\u{1F534} Join My Youtube Channel", "https://www.youtube.com/channel/UCYiTB7PeBxSsDHtbQOnLVUQ").row()
            .url("\u{1D54F}Follow me on X", "https://x.com/InvestioCS").row()
            .url("\u{1F4F7}Follow me on Instagram", "https://www.instagram.com/investiocs").row()
            .text("\u2705Check Membership", "check_join").row()
    })
})

// Checks Whether the User has joined the Group or not

bot.callbackQuery("check_join", async (ctx) => {
    try {
        const member = await ctx.api.getChatMember("@InfinityLoot", ctx.from.id)
        if (["member", "adminstrator", "creator"].includes(member.status)) {
            console.log("Membership Verified")
            await ctx.reply("Membership Verified \u2705, Kindly send your wallet address now")
            ctx.session.step = true
            ctx.session._id = ctx.from.id
        }
        else {
            ctx.reply("Sorry! You are not a member till now", {
                reply_markup: new InlineKeyboard().url("Join My Group\n", "https://t.me/InfinityLoot").row()
                    .text("Check Again\n", "check_join")
            })
        }
    }
    catch (err) {
        console.log("Sahil Bhai Error : ", err)
        ctx.reply("\u274C Some Error Might have occured \u274C")
    }
})

//Upon receiving any message

bot.on("message:text", async (ctx) => {
    if (ctx.session.step) {
        const walletAddress = ctx.message.text.trim();
        if (!ethers.isAddress(walletAddress)) {
            console.log("Invalid Wallet Address")
            await ctx.reply("\u274C Invalid Wallet Address \u274C")
            return;
        }
        const now = Date.now();
        const coolDownPeriod = 24 * 60 * 60 * 1000
        const lastClaim = ctx.session.lastClaim
        if (lastClaim && (now - lastClaim) < coolDownPeriod) {
            let leftHours = Math.ceil((coolDownPeriod - (now - lastClaim) )/ 3600000)
            await ctx.reply(`There are still ${leftHours} hours left to claim`)
            console.log(`Still ${leftHours} hours left to claim`)
            ctx.session.step = false
            return;
        }
        else{
            try {
                const tx = await wallet.sendTransaction({
                    to: walletAddress,
                    value: ethers.parseEther("0.05")
                })
                const receipt = await tx.wait(1)
                console.log(`Transaction has been successfully processed for ${walletAddress} \n Tx Hash is : `,tx.hash)
                await ctx.reply(`\u2705Success Your Tokens are sent successfully : \n Your Transaction Hash is :${tx.hash}`)
                await ctx.reply(`Success Your Transaction has been Processed \u2705. Come again in 24 Hours \u2705`)
                ctx.session.walletAddress = walletAddress
                ctx.session.lastClaim = Date.now();
                ctx.session.step = false
            } catch (err) {
                console.log("Some error might Have Occured",err)
                await ctx.reply("There is Some Error Please try again later")
            }
        }
    }
    else {
        ctx.reply("Invalid Input")
    }
})
bot.catch((err) => {
    console.log("Some error has occured and it is", err)
})
bot.start().then(() => {
    console.log("Your Bot has started working")
}).catch((err) => {
    console.log("Error Occured while starting bot", err)
})