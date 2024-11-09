const { ethers } = require('ethers');
const fs = require('fs');
const { Mutex } = require('async-mutex');
const fileMutex = new Mutex();
const coinMutex = new Mutex();

const transferSig = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"


/**
 * @param {import('alchemy-sdk').Log} log
 * @returns {boolean}
 * */
function isTransferLog(log) {
    if (log.topics.length === 0) return false;

    return log.topics[0].toLowerCase() === transferSig;
}

function parseLogAddress(s) {
    return ethers.utils.getAddress(`0x${s.slice(-40)}`)

}

/**
 *
 * @typedef {Object} TransferLogInfo
 * @property {string} sender - Who Sent the tokens
 * @property {string} receiver - Who received the tokens
 * @property {string} asset - Which token was transfered
 * @property {string} amount - Amount transfered
 */
/**
 * @param {import('alchemy-sdk').Log} log
 * @returns {TransferLogInfo}
 * */
function parseLog(log) {
    const [_, sender, receiver] = log.topics
    const asset = log.address
    const amount = ethers.BigNumber.from(log.data).toString()
    return {
        sender: parseLogAddress(sender),
        receiver: parseLogAddress(receiver),
        asset,
        amount
    }
}

/**
 * @param {import('alchemy-sdk').Log[]} logs
 * @param {string} address
 * @returns {string}
 * */
function isValidBuyTransaction(logs, address) {
    if (logs.length === 0) return false
    if(!address) return false

    // Check if the wallet is receiving any asset
    const transferLogs = logs
        .filter(isTransferLog)
        .map(parseLog)
        .filter(l => l.receiver === ethers.utils.getAddress(address));

    if(transferLogs.length > 0){
        return transferLogs[transferLogs.length-1].sender.toLowerCase();
    }
    return undefined;
}

async function addObjectToFile(chatId, groupId) {
    const filePath = "./groupData.json"
    const object = {
        "chatId": chatId,
        "group": groupId
    }
    try {
        const release = await fileMutex.acquire();
        // Read existing data from the file
        const existingData = await fs.promises.readFile(filePath, 'utf8');
        const existingObjects = JSON.parse(existingData);

        // Add the new object to the array
        existingObjects.push(object);

        // Write the updated data back to the file
        await fs.promises.writeFile(filePath, JSON.stringify(existingObjects, null, 2));
        release();
    } catch (error) {
        console.error('Error adding object to file:', error);
    }
}

// Function to remove an object from a file by chatId
async function removeObjectFromFile(chatId) {
    const filePath = "./groupData.json"
    try {
        // Read existing data from the file
        const release = await fileMutex.acquire();
        const existingData = await fs.promises.readFile(filePath, 'utf8');
        const existingObjects = JSON.parse(existingData);

        // Find the index of the object with the provided chatId
        const indexToRemove = existingObjects.findIndex(obj => obj.chatId === chatId);

        if (indexToRemove !== -1) {
            // Remove the object from the array
            existingObjects.splice(indexToRemove, 1);

            // Write the updated data back to the file
            await fs.promises.writeFile(filePath, JSON.stringify(existingObjects, null, 2));

        } else {
            console.log('Object with specified chatId not found in the file.');
        }
        release();
    } catch (error) {
        console.error('Error removing object from file:', error);
    }
}

async function getChatIdsFromFile() {
    const filePath = "./groupData.json"
    try {
        // Read existing data from the file
        const existingData = await fs.promises.readFile(filePath, 'utf8');
        const existingObjects = JSON.parse(existingData);

        return existingObjects;
    } catch (error) {
        console.error('Error getting chatIds from file:', error);
        return [];
    }
}

async function updateOptions(chatId, newAddress, newName) {
    try {
        // Read the file and parse its content
        const release = await fileMutex.acquire();
        const data = await fs.promises.readFile("./groupData.json", 'utf8');
        const jsonArray = JSON.parse(data);

        // Find the object with the matching chatId
        const index = jsonArray.findIndex(item => item.chatId === chatId);

        if (index !== -1) {
            // If options object doesn't exist, create it
            if (!jsonArray[index].options) {
                jsonArray[index].options = {};
            }

            // Add or update the 'address' and 'newName' properties in options
            jsonArray[index].options[newAddress] = newName;
        }

        // Write the updated content back to the file
        await fs.promises.writeFile("./groupData.json", JSON.stringify(jsonArray, null, 2));
        release();
    } catch (error) {
        console.error('Error:', error);
    }
}

async function updateAgeFilter(chatId, pronoun, time) {
    try {
        // Read the file and parse its content
        const release = await fileMutex.acquire();
        const data = await fs.promises.readFile("./groupData.json", 'utf8');
        const jsonArray = JSON.parse(data);

        // Find the object with the matching chatId
        const index = jsonArray.findIndex(item => item.chatId === chatId);

        if (index !== -1) {
            // If options object doesn't exist, create it
            if (!jsonArray[index].options) {
                jsonArray[index].options = {};
            }

            // Add or update the 'address' and 'newName' properties in options
            jsonArray[index].options["filterPronoun"] = pronoun;
            jsonArray[index].options["time"] = time;
        }

        // Write the updated content back to the file
        await fs.promises.writeFile("./groupData.json", JSON.stringify(jsonArray, null, 2));
        release();
    } catch (error) {
        console.error('Error:', error);
    }
}

async function updateMarketcapFilter(chatId, pronoun, amount) {
    try {
        // Read the file and parse its content
        const release = await fileMutex.acquire();
        const data = await fs.promises.readFile("./groupData.json", 'utf8');
        const jsonArray = JSON.parse(data);

        // Find the object with the matching chatId
        const index = jsonArray.findIndex(item => item.chatId === chatId);

        if (index !== -1) {
            // If options object doesn't exist, create it
            if (!jsonArray[index].options) {
                jsonArray[index].options = {};
            }

            // Add or update the 'address' and 'newName' properties in options
            jsonArray[index].options["filterPronounMM"] = pronoun;
            jsonArray[index].options["amountMM"] = amount;
        }

        // Write the updated content back to the file
        await fs.promises.writeFile("./groupData.json", JSON.stringify(jsonArray, null, 2));
        release();
    } catch (error) {
        console.error('Error:', error);
    }
}


async function generateFormattedList() {
    try {
        // Read the JSON data from the file
        const data = await fs.promises.readFile('./scrapedCoins.json', 'utf8');
        const coinData = JSON.parse(data);

        // Initialize an empty array to store the formatted strings
        const formattedList = [];

        // Iterate through the object properties and construct formatted strings
        let currentString = ''; // Initialize the current formatted string

        for (const key in coinData) {
            if (Object.hasOwnProperty.call(coinData, key)) {
                const value = coinData[key].name;
                const formattedString = `${value}: <a href='https://www.dextools.io/app/en/ether/pair-explorer/${key}'>DexTools</a> | <a href='https://www.dexview.com/eth/${key}'>DexView</a>`;

                // Check if adding the formattedString would exceed the limit
                if (currentString.length + formattedString.length > 3950) {
                    formattedList.push(currentString); // Push the current formatted string
                    currentString = formattedString; // Start a new formatted string
                } else {
                    // Add the formattedString to the current string
                    currentString += (currentString ? '\n' : '') + formattedString;
                }
            }
        }

        // Push the last formatted string
        if (currentString) {
            formattedList.push(currentString);
        }

        return formattedList;
    } catch (error) {
        console.error('Error:', error);
        return [];
    }
}

async function findWalletsWithTracker(trackerValue) {
    let walletsWithTracker = [];

    // Read the JSON data from the file
    const data = await fs.promises.readFile('./customBuyersArray.json', 'utf8');
    const coinData = JSON.parse(data);
  
    for (const key in coinData) {
      if (coinData.hasOwnProperty(key)) {
        const element = coinData[key];
  
        // Check if the tracker array exists and contains the trackerValue
        if (element?.tracker && element.tracker.includes(trackerValue)) {
            walletsWithTracker.push(key);
        }
      }
    }
  
    return walletsWithTracker;
}

async function getAddressData(senderAddress) {
    const data = await fs.promises.readFile('./customBuyersArray.json', 'utf8');
    const buyerData = JSON.parse(data);
  
    if (buyerData[senderAddress]) {
        return buyerData[senderAddress]
    }else{
        return false;
    }
}

async function addTrackerToKey(wallet, chatId) { //key is chatId
    const release = await coinMutex.acquire();
  
    try {
      const data = await fs.promises.readFile('./customBuyersArray.json', 'utf8');
      const buyerData = JSON.parse(data);
  
      if (buyerData[wallet]) {
        // If 'tracker' is an array, add the trackerValue
        if (Array.isArray(buyerData[wallet]?.tracker)) {
          if (!buyerData[wallet].tracker.includes(chatId)) {
            buyerData[wallet].tracker.push(chatId);
          }
        } else {
          // Initialize the tracker array if it doesn't exist
          buyerData[wallet].tracker = [chatId];
        }
      } else {
        // Initialize the key with tracker and visibility if key doesn't exist
        buyerData[wallet] = {
          tracker: [chatId],
          visibility: 'private'
        };
      }
  
      await fs.promises.writeFile('./customBuyersArray.json', JSON.stringify(buyerData, null, 2));
  
    } catch (error) {
      console.error("An error occurred:", error);
    } finally {
      release();
    }
}

async function removeTrackerFromWallet(wallet, chatId) {
  const release = await coinMutex.acquire();

  try {
    // Read the file
    const data = await fs.promises.readFile('./customBuyersArray.json', 'utf8');
    const buyerData = JSON.parse(data);

    // Check if the wallet exists and if 'tracker' is an array
    if (buyerData[wallet] && Array.isArray(buyerData[wallet].tracker)) {
      // Filter out the chatId from the tracker array
      buyerData[wallet].tracker = buyerData[wallet].tracker.filter(id => id !== chatId);

      // Optionally, if the tracker array becomes empty, you might want to handle it (e.g., remove the wallet entry or keep it empty)
      if (buyerData[wallet].tracker.length === 0) {
        delete buyerData[wallet]; // or handle as needed
      }

      // Write the updated data back to the file
      await fs.promises.writeFile('./customBuyersArray.json', JSON.stringify(buyerData, null, 2));
    }
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    // Release the mutex
    release();
  }
}

async function compareTimeValues(userValue, otherValue) {
    const timeUnits = {
        'm': 60 * 1000,  // minutes in milliseconds
        'h': 60 * 60 * 1000,  // hours in milliseconds
        'd': 24 * 60 * 60 * 1000  // days in milliseconds
    };

    const extractValueAndUnit = (value) => {
        const numericValue = parseInt(value);
        const unit = value.charAt(value.length - 1).toLowerCase();
        return numericValue * (timeUnits[unit] || 1);
    };

    const userTime = extractValueAndUnit(userValue);
    const otherTime = extractValueAndUnit(otherValue);

    return userTime < otherTime;
}

module.exports = {
    isValidBuyTransaction,
    addObjectToFile,
    removeObjectFromFile,
    getChatIdsFromFile,
    updateOptions,
    generateFormattedList,
    updateAgeFilter,
    compareTimeValues,
    findWalletsWithTracker,
    addTrackerToKey,
    getAddressData,
    removeTrackerFromWallet,
    updateMarketcapFilter
};
