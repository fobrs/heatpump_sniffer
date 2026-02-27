import * as dotenv from 'dotenv';
import { console_log } from './log.js' ;
import { HttpClient, IPDiscovery } from 'hap-controller';
import readline from "node:readline/promises";

const rl = readline.createInterface({
  terminal: true,
  input: process.stdin,
  output: process.stdout,
});
dotenv.config({ path: './src/server/.env.local' });
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

async function subscribe_to_T6()
{
    const discovery = new IPDiscovery();

    var paired = true;

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
        console.log(`Found device: ${service.name}`);

        const client = new HttpClient(service.id, service.address, service.port, pairingData, {
            usePersistentConnections: true,
        });

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

    discovery.start();
}

export { subscribe_to_T6 };