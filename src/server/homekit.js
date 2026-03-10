import * as dotenv from 'dotenv';
import { console_log } from './log.js' ;
import { HttpClient, IPDiscovery } from 'hap-controller';
import readline from "node:readline/promises";
import fs from 'fs';

const rl = readline.createInterface({
  terminal: true,
  input: process.stdin,
  output: process.stdout,
});


dotenv.config({ path: './src/server/.env_homekit.local' });
const {
    AccessoryPairingID, AccessoryLTPK, iOSDevicePairingID, iOSDeviceLTSK, iOSDeviceLTPK
 } = process.env;


const pairingData = {
  "AccessoryPairingID": AccessoryPairingID,
  "AccessoryLTPK": AccessoryLTPK,
  "iOSDevicePairingID": iOSDevicePairingID,
  "iOSDeviceLTSK": iOSDeviceLTSK,
  "iOSDeviceLTPK": iOSDeviceLTPK
}
var client = null;
var _service = null;

async function subscribe_to_T6()
{
    const discovery = new IPDiscovery();

    var paired = false;


    const characteristics = [
        '1.277', // aid.iid , Current Temperature	00000011-0000-1000-8000-0026BB765291
        '1.278', // aid.iid , Target Temperature	00000035-0000-1000-8000-0026BB765291
    ];

    const characteristics_set_on = {
        '1.278': 19.5 // aid.iid , Target Temperature	00000035-0000-1000-8000-0026BB765291
    };
    const characteristics_set_off = {
        '1.278': 19.5 // aid.iid , Target Temperature	00000035-0000-1000-8000-0026BB765291
    };

    discovery.on('serviceUp', async (service) => {
        _service = service;

        console.log(`Found device: ${service.name}`);

        client = new HttpClient(service.id, service.address, service.port, pairingData, {
            usePersistentConnections: true,
        });

        if (service.availableToPair)
        {
            try {
                const pairMethod = await discovery.getPairMethod(service);
                console.log(`Start pairing: ${service.name} ${pairMethod}`);
                const data = await client.startPairing(pairMethod);
                const pin = await rl.question('Enter PIN: ');
                console.log(pin);
                try {
                    await client.finishPairing(data, pin);
                    console.log(`${service.name} paired! Keep the following pairing data safe:`);
                    const ltd = client.getLongTermData();
                    console.log(JSON.stringify(ltd, null, 2));

                    // write to env_homekit.local
                    let ltd_env_strings = "";
                    for (let key in ltd) {
                        console.log(key, ltd[key]);
                        ltd_env_strings += key +"="+ ltd[key] +"\n";
                    }

                    fs.writeFile('./src/server/.env_homekit.local', ltd_env_strings, {
                        encoding: "utf8",
                        flag: "w",
                        mode: 0o666
                    },
                    function (err) {
                        if (err) throw err;
                        console.log('Saved!');
                    });
                                        

                } catch (e) {
                    console.error(`${service.name}: Error`, e);
                }
    
            } catch (e) {
                console.error(`${service.name}: Error`, e);
            }
        }



        let count = 0;
        client.on('event', async (ev) => {
            console_log("error", `Event: ${JSON.stringify(ev, null, 2)}`);

            if (false && ++count >= 2) {
                try {
                    await client.unsubscribeCharacteristics(characteristics);
                    client.close();
                    console.log(`${service.name}: Unsubscribed!`);
                } catch (e) {
                    console.error(`${service.name}:`, e);
                }
            }
        });

        client.on('event-disconnect', async (formerSubscribes) => {
            console.log(`Disconnected: ${JSON.stringify(formerSubscribes, null, 2)}`);
            // resubscribe if wanted:
            try {
                // a disconnect can happen if the device was disconnected from the network
                // so you have to catch any network errors here
                await client.subscribeCharacteristics(formerSubscribes);
            } catch (e) {
                console_log("error", "error while resubscribing", e);
                // if the discovery will detect the device again it will fire a new serviceUp event
            }
        });


        try {
            const subscribed_c = await client.getSubscribedCharacteristics();
            console_log("error", `${service.name}: Subscribed to:`, subscribed_c);
        } catch (e) {
            console_log("error", `${service.name}:`, e);
        }

        try {
            await client.subscribeCharacteristics(characteristics);
            console.log(`${service.name}: Subscribed!`);
        } catch (e) {
            console.error(`${service.name}:`, e);
        }
        // set target temp
/*
        try {
            await client.setCharacteristics(characteristics_set_on);
            console_log("error", `${service.name}: done!`);
        } catch (e) {
            console_log("error", `${service.name}:`, e);
        }
*/
        try {
            const subscribed_c = await client.getSubscribedCharacteristics();
            console_log("error", `${service.name}: Subscribed to:`, subscribed_c);
        } catch (e) {
            console_log("error", `${service.name}:`, e);
        }
    });
  console_log("error", "discovery start");
    discovery.start();
}

async function T6_change_setpoint(temperature)
{
    if (client)
    {
        const characteristics_set = {
                '1.278': temperature // aid.iid , Target Temperature	00000035-0000-1000-8000-0026BB765291
        };

        try {
            await client.setCharacteristics(characteristics_set);
            console_log("error", `${service.name}: done!`);
        } catch (e) {
            console_log("error", `${service.name}:`, e);
        }
    }
}

async function T6_get_setpoint()
{
    if (client)
    {
        const characteristics_get = {
                '1.278': temperature // aid.iid , Target Temperature	00000035-0000-1000-8000-0026BB765291
        };

        try {
            const ch = await client.getCharacteristics(characteristics_set, {
                meta: true,
                perms: true,
                type: true,
                ev: true,
            });
            console_log("error", JSON.stringify(ch, null, 2));
        } catch (e) {
            console_log("error", `${service.name}:`, e);
        }
    }
}

async function T6_remove_pairing() {
    
    
    try {
        await client.removePairing(client.pairingProtocol.iOSDevicePairingID);
        client.close();
        console_log("error",`${_service.name}: done remove pairing!`);
    } catch (e) {
        console_log("error",`${_service.name}:`, e);
        process.exit(1);
    }
}


export { subscribe_to_T6, T6_change_setpoint, T6_get_setpoint, T6_remove_pairing };