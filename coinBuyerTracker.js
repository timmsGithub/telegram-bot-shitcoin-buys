const crypto = require("crypto");
const tlsClient = require("./tlsClient/tlsClientSimpleWrapper");
let Web3 = require('web3');
const {ethers} = require("ethers");
const {default: axios} = require("axios");
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();
const { isValidBuyTransaction, addObjectToFile, removeObjectFromFile, getChatIdsFromFile, updateOptions,
    generateFormattedList, updateAgeFilter, compareTimeValues, findWalletsWithTracker, addTrackerToKey, getAddressData, removeTrackerFromWallet, updateMarketcapFilter
} = require('./coinBuyerHelper');
const fs = require('fs').promises;
const token = process.env.TELEGRAM_TOKEN;
const telegramBot = new TelegramBot(token, { polling: true });

const NODEURL = "https://eth-mainnet.g.alchemy.com/v2/Ig8ePYqgCF7j9CifR1iVD4vNq2t6y2SY"
const SOCKETURL = "wss://eth-mainnet.g.alchemy.com/v2/Ig8ePYqgCF7j9CifR1iVD4vNq2t6y2SY"
const provider = new ethers.providers.StaticJsonRpcProvider(NODEURL);
let web3 = new Web3(NODEURL)


let options = {
    clientConfig: {
        keepalive: true,
        keepaliveInterval: 60000,
    },
    reconnect: {
        auto: true,
        delay: 2500,
        onTimeout: true,
    }
};
let ws = new Web3.providers.WebsocketProvider(SOCKETURL, options);
let web3Socket = new Web3(ws)

const userGroups = {};
telegramBot.onText(/\/setGroup/i, function (msg) {
    const opts = {
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: 'All',
                        callback_data: '1'
                    },
                    {
                        text: '>5',
                        callback_data: '5'
                    }
                    ,
                    {
                        text: '>10',
                        callback_data: '10'
                    }
                ]
            ]
        }
    };
    telegramBot.sendMessage(msg.from.id, 'Choose the amount of contract hits from one wallet over 500k mCap for the wallet notifications:', opts);
});

telegramBot.onText(/\/setName/i, async function (msg) {
    if(msg.reply_to_message && msg.reply_to_message.from.id === 6772421903){
        const addressToRename = msg.reply_to_message.text.split("Buyer:  ")[1].split(" (")[0]
        const name = msg.text.split("ame ")[1]
        await updateOptions(msg.from.id, addressToRename, name)
        await telegramBot.sendMessage(msg.from.id, `The address ${addressToRename} successfully renamed to ${name}`);
    }
});

telegramBot.onText(/\/addwallet/i, async function (msg) {
    const wallets = await findWalletsWithTracker(msg.from.id)
    if(wallets.length > 75){
        await telegramBot.sendMessage(msg.from.id, `The address can not be added. Only 75 addresses allowed. Please remove an address with /removewallet WALLET`);
        return
    }
    let walletAddress = ""
    try{
        walletAddress = msg.text.split("let ")[1].toLowerCase()
    }catch(e){
        if(!walletAddress.includes("0x")){
            await telegramBot.sendMessage(msg.from.id, `The address can not be added. Only addresses that start with 0x are allowed. Format: /addwallet WALLET`);
            return
        }
    }
    
    await addTrackerToKey(walletAddress, msg.from.id)
    await telegramBot.sendMessage(msg.from.id, `The address ${walletAddress} successfully added to your private tracker!`);
});

telegramBot.onText(/\/removewallet/i, async function (msg) {
    let walletAddress = ""
    try{
        walletAddress = msg.text.split("let ")[1].toLowerCase()
    }catch(e){
        if(!walletAddress.includes("0x")){
            await telegramBot.sendMessage(msg.from.id, `The address can not be removed. Only addresses that start with 0x are allowed. Format: /removewallet WALLET`);
            return
        }
    }
    
    await removeTrackerFromWallet(walletAddress, msg.from.id)
    await telegramBot.sendMessage(msg.from.id, `The address ${walletAddress} successfully removed from your private tracker!`);
});

telegramBot.setMyCommands([
    {
        command: 'setname',
        description: '/setname YOURCUSTOMNAME - Rename the buyer to a preferred name by replying to a message',
    },
    {
        command: 'listcoins',
        description: 'List all coins above 500k mCap in the last 3 months',
    },
    {
        command: 'setgroup',
        description: 'Set your notification preferences',
    },
    {
        command: 'filterbymarketcap',
        description: 'Filter the notifications by marketcap of coin',
    },
    {
        command: 'filterbyage',
        description: 'Filter the notifications by age of contract',
    },
    {
        command: 'resetfilter',
        description: 'Resets all filters and shows all notifications',
    },
    {
        command: 'listselftrackedwallets',
        description: 'List all wallets that you added',
    },
    {
        command: 'addwallet',
        description: 'Add a wallet to your tracked wallets',
    },
    {
        command: 'removewallet',
        description: 'Remove a wallet from your tracked wallets',
    }
])

telegramBot.onText(/\/stop/i, async function (msg) {
    await removeObjectFromFile(msg.from.id)
    await telegramBot.sendMessage(msg.from.id, 'Start the notifications again with /setgroup');
});

telegramBot.onText(/\/start/i, async function (msg) {
    await telegramBot.sendMessage(msg.from.id, 'Start the notifications with /setgroup\nRename the sender by replying to a ping with /setName YOURCUSTOMNAME');
});

telegramBot.onText(/\/resetfilter/i, async function (msg) {
    await updateAgeFilter(msg.from.id, "older", "1m")
    await updateMarketcapFilter(msg.from.id, "more", 1)
    await telegramBot.sendMessage(msg.from.id, 'Successfully removed the filter!');
});


telegramBot.onText(/\/listCoins/i, async function (msg) {
    const opts = {
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: 'Previous',
                        callback_data: 'previous'
                    },
                    {
                        text: 'Next',
                        callback_data: 'next'
                    }
                ]
            ]
        }
    };
    await telegramBot.sendMessage(msg.from.id, `Page 1: Here are all coins above 500k mCap in the last 3 months: \n${scrapedCoins[0]}`, {
        ...opts,
        parse_mode: 'html',
        "disable_web_page_preview": true,
    });
});

telegramBot.onText(/\/filterbyage/i, async function (msg) {
    const opts = {
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: 'younger than',
                        callback_data: 'younger'
                    },
                    {
                        text: 'older than',
                        callback_data: 'older'
                    }
                ]
            ]
        }
    };
    await telegramBot.sendMessage(msg.from.id, `Here you can filter the notifications by the age of the contract.`, {
        ...opts,
        parse_mode: 'html',
        "disable_web_page_preview": true,
    });
});

telegramBot.onText(/\/filterbymarketcap/i, async function (msg) {
    const opts = {
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: 'more than',
                        callback_data: 'moremm'
                    },
                    {
                        text: 'less than',
                        callback_data: 'lessmm'
                    }
                ]
            ]
        }
    };
    await telegramBot.sendMessage(msg.from.id, `Here you can filter the notifications by marketcap of the coin.`, {
        ...opts,
        parse_mode: 'html',
        "disable_web_page_preview": true,
    });
});

telegramBot.onText(/\/listselftrackedwallets/i, async function (msg) {
    const wallets = await findWalletsWithTracker(msg.from.id)
    await telegramBot.sendMessage(msg.from.id, `Here are tracked wallets that you added by yourself: \n${wallets.join('\n')}`, {
        parse_mode: 'html',
        "disable_web_page_preview": true,
    });
});

async function editCoinList(callbackQuery){
    const opts = {
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: 'Previous',
                        callback_data: 'previous'
                    },
                    {
                        text: 'Next',
                        callback_data: 'next'
                    }
                ]
            ]
        }
    };
    const currentIndex = parseInt(callbackQuery.message.text.split("Page ")[1].split(":")[0]) -1
    let newIndex = 0
    if(callbackQuery.data === 'previous'){
        newIndex = currentIndex - 1
    }else{
        newIndex = currentIndex + 1
    }
    if(newIndex < 0 || newIndex >= scrapedCoins.length){
        return
    }
    await telegramBot.editMessageText( `Page ${newIndex+1}: Here are all coins above 500k mCap in the last 3 months: \n${scrapedCoins[newIndex]}`, {
        ...opts,
        chat_id: callbackQuery.from.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: 'html',
        "disable_web_page_preview": true,
    })
}

async function editAgeFilter(callbackQuery){
    const opts = {
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: '3h',
                        callback_data: `${callbackQuery.data}3h`
                    },
                    {
                        text: '12h',
                        callback_data: `${callbackQuery.data}12h`
                    },
                    {
                        text: '3d',
                        callback_data: `${callbackQuery.data}3d`
                    },
                    {
                        text: '12d',
                        callback_data: `${callbackQuery.data}12d`
                    },
                    {
                        text: '30d',
                        callback_data: `${callbackQuery.data}30d`
                    }
                ]
            ]
        }
    };
    await telegramBot.editMessageText( `Here you can filter the notifications by the age of the contract.`, {
        ...opts,
        chat_id: callbackQuery.from.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: 'html',
        "disable_web_page_preview": true,
    })
}

async function editMarketcapFilter(callbackQuery){
    const opts = {
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: '50k',
                        callback_data: `${callbackQuery.data}50000`
                    },
                    {
                        text: '100k',
                        callback_data: `${callbackQuery.data}100000`
                    },
                    {
                        text: '200k',
                        callback_data: `${callbackQuery.data}200000`
                    },
                    {
                        text: '300k',
                        callback_data: `${callbackQuery.data}300000`
                    },
                    {
                        text: '600k',
                        callback_data: `${callbackQuery.data}600000`
                    }
                ]
            ]
        }
    };
    await telegramBot.editMessageText( `Here you can filter the notifications by marketcap of the coin.`, {
        ...opts,
        chat_id: callbackQuery.from.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: 'html',
        "disable_web_page_preview": true,
    })
}

telegramBot.on("callback_query", async function onCallbackQuery(callbackQuery) {
    if(callbackQuery.data === "previous" || callbackQuery.data === "next"){
        await editCoinList(callbackQuery)
    }else if(callbackQuery.data === "younger" || callbackQuery.data === "older"){
        await editAgeFilter(callbackQuery)
    }else if(callbackQuery.data === "moremm" || callbackQuery.data === "lessmm"){
        await editMarketcapFilter(callbackQuery)
    }else if(callbackQuery.data === "younger3h" || callbackQuery.data === "younger12h" || callbackQuery.data === "younger3d" || callbackQuery.data === "younger12d" || callbackQuery.data === "younger30d"){
        await updateAgeFilter(callbackQuery.from.id, "younger", callbackQuery.data.split("younger")[1])
        await telegramBot.sendMessage(callbackQuery.from.id, `You successfully enabled the filter. You now only get notifications if the contract is younger than ${callbackQuery.data.split("younger")[1]}`);
    }else if(callbackQuery.data === "older3h" || callbackQuery.data === "older12h" || callbackQuery.data === "older3d" || callbackQuery.data === "older12d" || callbackQuery.data === "older30d"){
        await updateAgeFilter(callbackQuery.from.id, "older", callbackQuery.data.split("older")[1])
        await telegramBot.sendMessage(callbackQuery.from.id, `You successfully enabled the filter. You now only get notifications if the contract is older than ${callbackQuery.data.split("older")[1]}`);
    }else if(callbackQuery.data === "moremm50000" || callbackQuery.data === "moremm100000" || callbackQuery.data === "moremm200000" || callbackQuery.data === "moremm300000" || callbackQuery.data === "moremm600000"){
        await updateMarketcapFilter(callbackQuery.from.id, "more", parseInt(callbackQuery.data.split("moremm")[1]))
        await telegramBot.sendMessage(callbackQuery.from.id, `You successfully enabled the filter. You now only get notifications if the coin has more than ${callbackQuery.data.split("moremm")[1]} marketcap.`);
    }else if(callbackQuery.data === "lessmm50000" || callbackQuery.data === "lessmm100000" || callbackQuery.data === "lessmm200000" || callbackQuery.data === "lessmm300000" || callbackQuery.data === "lessmm600000"){
        await updateMarketcapFilter(callbackQuery.from.id, "less", parseInt(callbackQuery.data.split("lessmm")[1]))
        await telegramBot.sendMessage(callbackQuery.from.id, `You successfully enabled the filter. You now only get notifications if the coin has less than ${callbackQuery.data.split("lessmm")[1]} marketcap.`);
    }
    else{
        await removeObjectFromFile(callbackQuery.from.id)
        await addObjectToFile(callbackQuery.from.id, callbackQuery.data)
        await telegramBot.sendMessage(callbackQuery.from.id, `You successfully choose group ${callbackQuery.data}. Type /stop to stop all notifications and /setGroup again to change your group!`);
    }
    await telegramBot.answerCallbackQuery(callbackQuery.id, `Success!`);
});

async function sendTelegramMessage (senderAddress, pairAddress, buyerPublic) {
    let data = {}
    try{
        data = await getInformation(pairAddress)
    }catch(e){
        console.log("No information found for " + pairAddress)
        return
    }
    const messageObjects = await getChatIdsFromFile()
    const sender = await getEnsName(senderAddress)
    const age = await formatDate(data.creationTime)
    const message = `
SMART MONEY BUY DETECTED 🟢🟢🟢
Buyer:  <a href='https://etherscan.io/address/${senderAddress}'>${sender}</a> (${firstBuyers[senderAddress.toLowerCase()]?.amount ?? "-"} contract hits)

🏷️ <b>${data.name} (${data.symbol})</b>

<b>Token Details:</b>
⛓️ Chain: ETH
🏷️ Address: <a href='https://etherscan.io/address/${data.id.token}'>${data.id.token.substring(0, 2)}...${data.id.token.substring(data.id.token.length - 2)}</a>
🌐 Supply: ${data.token.metrics.totalSupply}

<b>Token Socials:</b>
🐦 Twitter: ${data.token.links.twitter !== "" ? data.token.links.twitter : "N/A"}
🚙 Telegram: ${data.token.links.telegram !== "" ? data.token.links.telegram : "N/A"}
💻 Website: ${data.token.links.website !== "" ? data.token.links.website : "N/A"}
⚖️ DexScore: ${data.dextScore?.total ?? 0}

<b>${data.symbol}/${data.symbolRef} Analytics: </b>
⏲️ Age: ${age}
💧 Pool: ${data.metrics.reserveRef?.toFixed(2)} WETH
🪙 MCap: ${formatNumber(data.token.metrics?.fdv) ?? 0}
💰 Price: $${data.price}
💸 Taxes: ${data.token.audit?.external?.goplus?.buy_tax * 100}% Buy | ${data.token.audit?.external?.goplus?.sell_tax * 100}% Sell

📈 Price Change:
 ╚5m ${await getPricePercentage(data.price, data.price5m?.price) ?? 0} | 1h ${await getPricePercentage(data.price, data.price1h?.price) ?? 0} | 6h ${await getPricePercentage(data.price, data.price6h?.price) ?? 0}

📊 Volume:
 ╚5m $${formatNumber(data.price5m?.volume) ?? 0} | 1h $${formatNumber(data.price1h?.volume) ?? 0} | 6h $${formatNumber(data.price6h?.volume) ?? 0}

🛒 Transactions (B/S):
 ╚5m ${data.price5m?.buys ?? 0}/${data.price5m?.sells ?? 0} | 1h ${data.price1h?.buys ?? 0}/${data.price1h?.sells ?? 0} | 6h ${data.price6h?.buys ?? 0}/${data.price6h?.sells ?? 0}

📊 View Chart:
<a href='https://www.dextools.io/app/en/ether/pair-explorer/${data.id.pair}'>DexTools</a> | <a href='https://www.dexview.com/eth/${data.id.token}'>DexView</a> | <a href='https://dexscreener.com/ethereum/${data.id.token}'>DexScreener</a> | <a href='https://www.dexspy.io/eth/token/${data.id.token}'>DexSpy</a>

🔫Open in Sniper Bots:
<a href='https://t.me/BananaGunSniper_bot?start=snp_Otto_${data.id.token}'>Banana Gun</a> | <a href='https://t.me/unibotsniper_bot?start=OttoBots-${data.id.token}'>UniBot</a> | <a href='https://t.me/MaestroSniperBot?start=${data.id.token}-ottobots'>Maestro</a> | <a href='https://t.me/MaestroProBot?start=${data.id.token}-ottobots'>Maestro Pro</a>
    `
    const senderData = await getAddressData(senderAddress.toLowerCase())
    if(!buyerPublic){
        for(const chatId of senderData.tracker){
            const response = await telegramBot.sendMessage(chatId, message.replace("SMART MONEY BUY DETECTED", "- - - CUSTOM PING"), {
                parse_mode: 'html',
                "disable_web_page_preview": true,
            });
        }
    }else{
        console.log("New message sent out")
        for(const messageObject of messageObjects){
            if(messageObject.group <= firstBuyers[senderAddress.toLowerCase()].amount){
                try {
                    if(messageObject?.options?.filterPronoun){
                        if(await compareTimeValues(messageObject.options.time, age)){
                            if(messageObject.options.filterPronoun === "younger"){
                                continue
                            }
                        }else{
                            if(messageObject.options.filterPronoun === "older"){
                                continue
                            }
                        }
                    }
                    if(messageObject?.options?.filterPronounMM){
                        if(data.token.metrics?.fdv < messageObject.options.amountMM){
                            if(messageObject.options.filterPronounMM === "more"){
                                continue
                            }
                        }else{
                            if(messageObject.options.filterPronounMM === "less"){
                                continue
                            }
                        }
                    }
                    if(messageObject?.options?.[senderAddress]){
                        const tempMessage = message.replace(`>${senderAddress}<`, `>${messageObject?.options[senderAddress]}<`)
                        const response = await telegramBot.sendMessage(messageObject.chatId, tempMessage, {
                            parse_mode: 'html',
                            "disable_web_page_preview": true,
                        });
                    }else{
                        const response = await telegramBot.sendMessage(messageObject.chatId, message, {
                            parse_mode: 'html',
                            "disable_web_page_preview": true,
                        });
                    }
                } catch (err) {
                    console.log('Something went wrong when trying to send a Telegram notification', err.message);
                    if(err.message.includes("chat not found") || err.message.includes("bot was blocked by the user") || err.message.includes("user is deactivated")){
                        await removeObjectFromFile(messageObject.chatId)
                    }
                }
            }
        }
    }
}

async function getPricePercentage(oldPrice, newPrice){
    const percentageChange = ((newPrice - oldPrice) / oldPrice) * 100;
    return `${percentageChange.toFixed(2)}%`
}

function formatNumber(number) {
    if (number >= 1000000) {
        return (number / 1000000).toFixed(1) + "m";
    } else if (number >= 1000) {
        return (number / 1000).toFixed(1) + "k";
    } else {
        return number?.toFixed(0) ?? 0;
    }
}

async function formatDate(date){
    const now = new Date();
    const then = new Date(date);

    const timeDifference = now - then;

    const elapsedMinutes = Math.floor(timeDifference / (1000 * 60));

    if (elapsedMinutes <= 59) {
        return `${elapsedMinutes}m`;
    } else if (elapsedMinutes <= 59 * 24) {
        const elapsedHours = Math.floor(elapsedMinutes / 60);
        return `${elapsedHours}h`;
    } else {
        const elapsedDays = Math.floor(elapsedMinutes / (60 * 24));
        return `${elapsedDays}d`;
    }
}

async function getInformation(pairAddress){
    const client = new tlsClient.tlsClient({sessionId: crypto.randomBytes(20).toString('hex'), debug: false})
    const response = await client.get(`https://www.dextools.io/shared/data/pair?address=${pairAddress}&chain=ether&audit=true&locks=true`, {
        headers: {
            "Referer": "https://www.dextools.io/app/en/ether/pair-explorer/" + pairAddress,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    })
    return response.body.data[0];
}

async function getEnsName(address){
    const client = new tlsClient.tlsClient({sessionId: crypto.randomBytes(20).toString('hex'), debug: false})
    const response = await client.get(`https://etherscan.io/address/${address}`, {

    })
    try{
        return response.body.split('hdnEnsText" value="')[1].split('"')[0]
    }catch (e) {
        return address
    }
}

async function startMonitoring(trackedWallets){
    const subscription = web3Socket.eth.subscribe("newBlockHeaders").on("data", async (block) => {
        try{
            let data = await web3.eth.getBlock(block.hash)
            if(data && data.transactions){
                let transactions = data.transactions
                for(const transaction of transactions){
                    await scanTransaction(transaction, trackedWallets)
                }
            }

        }catch(err){
            console.log("Error trying to get transaction",err)
        }
    })
}

async function scanTransaction(hash, trackedWallets){
    let data = await web3.eth.getTransaction(hash)
    if(data){
        let buyerPublic = false
        if(trackedWallets.hasOwnProperty(data['from'].toLowerCase())){
            buyerPublic = true
        }else if((await readArrayFromFile("./customBuyersArray.json")).hasOwnProperty(data['from'].toLowerCase())){
            buyerPublic = false
        }else{
            return
        }
        let res = ""
        try{
            res = await provider.waitForTransaction(data['hash'], 1, 30000);
        }catch (e) {
            console.log("Failed")
            return
        }
        if(res.logs){ //If logs available
            const pairAddress = isValidBuyTransaction(res.logs, res.from)
            if(pairAddress){
                await sendTelegramMessage(data['from'], pairAddress, buyerPublic)
            }
        }else{
            console.log("No res logs")
            return
        }
    }
}

async function readArrayFromFile(filePath) {
    try {
        const readJsonString = await fs.readFile(filePath, 'utf8');
        const jsonArray = JSON.parse(readJsonString);
        return jsonArray;
    } catch (error) {
        console.error('Error reading array from file:', error);
        return [];
    }
}
let firstBuyers = []
let scrapedCoins = []

~(async () => {
    console.log(await telegramBot.getMe())
    scrapedCoins = await generateFormattedList()
    firstBuyers = await readArrayFromFile("./firstBuyersArray.json")
    await startMonitoring(firstBuyers);
})();
