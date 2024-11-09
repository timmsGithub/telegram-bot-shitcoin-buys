const crypto = require("crypto");
const tlsClient = require("./tlsClient/tlsClientSimpleWrapper");
const fs = require('fs').promises;

async function getAllCoins(client){
    const result = [];
    let index = 1;
    while(1){
        const resp = await client.get(`https://www.dextools.io/shared/analytics/pairs/gainers?limit=51&interval=24h&page=${index}&chain=ether&minFdv=500000&creationLowerTimeRange=7776000000&creationTimeSince=1700417034517`, {
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Referer": "https://www.dextools.io/app/en/ether/gainers"
            }
        })
        if(resp.body.data){
            for(const element of resp.body.data){
                result.push(element["_id"].pair)
                console.log(element["_id"].pair)
            }
            index += 1
        }else{
            return result
        }
    }
}


async function saveAllCoins(client){
    const result = {};
    let index = 1;
    while(1){
        const resp = await client.get(`https://www.dextools.io/shared/analytics/pairs/gainers?limit=51&interval=24h&page=${index}&chain=ether&minFdv=500000&creationLowerTimeRange=7776000000&creationTimeSince=1700417034517`, {
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Referer": "https://www.dextools.io/app/en/ether/gainers"
            }
        })
        console.log(resp.body)
        if(resp.body.data){
            for(const element of resp.body.data){
                const stablecoins = ["USDT", "USDC", "DAI", "TUSD", "FDUSD", "BUSD", "USDD", "USDP", "USTC", "FRAX", "LUSD", "USDJ", "PYUSD", "GUSD", "EURS", "vUSDC", "USDX", "SBD", "vBUSD", "SUSD", "EURC", "vUSDT", "CUSD"]
                if(!stablecoins.includes(element.pair.symbol)){
                    result[element["_id"].pair] = { name: element.pair.symbol }
                    console.log(element.pair.symbol)
                }
            }
            index += 1
        }else{
            const jsonString = JSON.stringify(result, null, 2);
            await fs.writeFile("./scrapedCoins.json", jsonString, 'utf8');
            return
        }
    }
}

async function getFirstBuyersForCoin(client, coinAddress){
    let resp
    try{
        resp = await client.get(`https://www.dextools.io/shared/data/swaps?chain=ether&pair=${coinAddress}&ts=1700419450&filter=true`, {
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Referer": "https://www.dextools.io/app/en/ether/gainers"
            }
        })
    }catch(e){
        resp = await client.get(`https://www.dextools.io/shared/data/swaps?chain=ether&pair=${coinAddress}&ts=1700419450&filter=true`, {
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Referer": "https://www.dextools.io/app/en/ether/gainers"
            }
        })
    }
    console.log(resp.body)
    const sortedArray = await filterAndSortArray(resp.body.data?.swaps ?? [])
    const result = []
    for(const element of sortedArray){
        if(!result.includes(element.maker)){
            result.push(element.maker)
            console.log(element.maker)
        }
        if(result.length === 25){
            return result
        }
    }
}

async function saveArrayToFile(filePath, data) {
    try {
        await fs.writeFile(filePath, data);
        console.log('Array saved to file:', filePath);
    } catch (error) {
        console.error('Error saving array to file:', error);
    }
}

async function filterAndSortArray(arr) {
    let filteredArray = arr.filter(item => item.type === 'buy' && (!item.others || !item.others.bot));
    return filteredArray.sort((a, b) => a.timestamp - b.timestamp);
}

~(async () => {
    console.log("Started scraper")
    const client = new tlsClient.tlsClient({sessionId: crypto.randomBytes(20).toString('hex'), debug: false, proxy: "http://parateek:myPassword_country-de_session-l1kQJAjx_lifetime-5s_streaming-1@geo.iproyal.com:12321"})
    await saveAllCoins(client)
    const coinList = await getAllCoins(client)
    let firstBuyers = {}
    for(const coin of coinList){
        const firstCoinBuyers = await getFirstBuyersForCoin(client, coin)
        if(firstCoinBuyers && firstCoinBuyers.length != 0){
            const validAddresses = firstCoinBuyers.filter(address => address !== undefined && address !== null)
                .map(address => address.toLowerCase());
            for (const address of validAddresses) {
                if (firstBuyers[address]) {
                    firstBuyers[address].amount++;
                } else {
                    firstBuyers[address] = { amount: 1 };
                }
            }
        }
    }
    const jsonString = JSON.stringify(firstBuyers, null, 2);
    await fs.writeFile("./firstBuyersArray.json", jsonString, 'utf8');
    console.log("Successfully scraped!")
})();