import express from "express";
import ViteExpress from "vite-express";
import {EventSource} from 'eventsource';
import bodyParser from 'body-parser';
import * as dotenv from 'dotenv';
import SSE from '@gazdagandras/express-sse';
import session from 'express-session';
import { prepare_db, save_to_db, get_metadata, get_data } from './database.js' ;
import { console_log } from './log.js' ;
import readline from "node:readline/promises";

const rl = readline.createInterface({
  terminal: true,
  input: process.stdin,
  output: process.stdout,
});
dotenv.config({ path: './src/server/.env.local' });
const {
    HEATPUMP_LISTENER_IP,
    PORT, HOST,
    DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD, DATABASE_PORT, DATABASE_SCHEMA,
    AccessoryPairingID, AccessoryLTPK, iOSDevicePairingID, iOSDeviceLTSK, iOSDeviceLTPK
 } = process.env;


const pairingData = {
  "AccessoryPairingID": AccessoryPairingID,
  "AccessoryLTPK": AccessoryLTPK,
  "iOSDevicePairingID": iOSDevicePairingID,
  "iOSDeviceLTSK": iOSDeviceLTSK,
  "iOSDeviceLTPK": iOSDeviceLTPK
}

import { HttpClient, IPDiscovery } from 'hap-controller';

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
        console_log("info", `Event: ${JSON.stringify(ev, null, 2)}`);

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
            console.error('error while resubscribing', e);
            // if the discovery will detect the device again it will fire a new serviceUp event
        }
    });


    try {
        const subscribed_c = await client.getSubscribedCharacteristics();
        console.log(`${service.name}: Subscribed to:`, subscribed_c);
    } catch (e) {
        console.error(`${service.name}:`, e);
    }

    try {
        await client.subscribeCharacteristics(characteristics);
        console.log(`${service.name}: Subscribed!`);
    } catch (e) {
        console.error(`${service.name}:`, e);
    }
    // target temp

      try {
        await client.setCharacteristics(characteristics_set_on);
        client.close();
        console.log(`${service.name}: done!`);
    } catch (e) {
        console.error(`${service.name}:`, e);
    }
});

discovery.start();


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
//paired = true;
while (!paired)
{
  await sleep(1000);
}

console.log("Paired, starting server...");





var prepare_db_done = false;

var id_value_dict = {};

var id_object_dict = {};
var do_fetch = false;

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
    secret: 'secret-key'
}));

const sse = new SSE();

var session_id = 0;

var sessions_local_scope = {};

app.get('/stream/meter', (req, res) => {

    res.setHeader('Access-Control-Allow-Origin', '*');
    req.query.client = req.session.id;
    session_id = req.session.id;
    console_log("debug",  "session_id: " + session_id);
    //sse.options.isCompressed = true;
    sse.init(req, res);

   
    var ip;
    var msg;
    if (req.headers['x-forwarded-for'])
         ip = req.headers['x-forwarded-for'];
    else
        ip = req.session.req.ip;

    msg = "connection from " + ip +  " ...";
    var local = false;
    const pieces = ip.split('.');
    if (pieces.length == 4)
        if (pieces[0] = 192 && pieces[1] == 168)
            local = true;

    sessions_local_scope[session_id] = local;
   
    sse.sendToClient(
        session_id,
        {
            clientID: session_id,
            ip_address: ip
        },
        'clientID',
    );
    
  });



app.get("/getState", (req, res) => {

  const ids = Object.keys(id_object_dict);
      
    ids.forEach(element => { 
      let o = id_object_dict[element];
      
     //console_log("error",  "TRUE sse.send: ", ((o.name) ? o.name : o.id) , o.value);
 
      sse.send(
      {
        element: o,
        initial: true
      },
      'state',
    );
    });
    res.send(true);
});


app.get("/getMetadata", (req, res) => {

  get_metadata().then((metadata) => {

    res.send(metadata);
  }).catch((err) => {
    console_log("error", "Error getting metadata: ", err);
    res.status(500).send("Error getting metadata");
  });
});

app.get("/getData", (req, res) => {

  const id = req.query.id;
  const scale = req.query.scale;
  if (!id)
  {
    res.status(400).send("Missing id parameter");
    return;
  }

  get_data(id, scale).then((data) => {

    res.send(data);
  }).catch((err) => {
    console_log("error", "Error getting data: ", err);
    res.status(500).send("Error getting data");
  });
});

const server = app.listen(PORT, HOST, () =>
  console_log("info",  `App listening on ${HOST}:${PORT}`),
);

var save_to_db_last_run = new Date();
var changed_last_run = save_to_db_last_run;

setTimeout( async function ()
{        
    // check db tables
  if (!prepare_db_done) {
    prepare_db_done = true;
    await prepare_db(id_object_dict); 
    await save_to_db(id_object_dict, id_value_dict);
    const interval = setInterval(async function ()
    {
        if (changed_last_run > save_to_db_last_run)  {  
          var d = new Date();
          let diff = (d - changed_last_run) / 1000;
          console_log("debug", "Data changed ", diff, " seconds ago");
          save_to_db_last_run = d;
          console_log("database", "Saving to db...");
          await save_to_db(id_object_dict, id_value_dict, diff);
         
        }
      }
      , 30 * 1000);
  }
}, 10*1000);

const es = new EventSource(`http://${HEATPUMP_LISTENER_IP}/events`)

es.addEventListener('state', async (event) =>  {

  const data = JSON.parse(event.data);
  try {
    var b = await parse_state(data);
  }
  catch (e)
  {
    console_log("error", "JSON exception: ", event.data); 
  }
  finally
  {
  }
})
es.addEventListener('log', (event) => {
  console_log("info", "Log: ", event.data)
})
es.addEventListener('ping', (event) => {
  console_log("info", "Ping: ", event.data)
})


ViteExpress.bind(app, server);


async function parse_state(data)
{
  // first call is with all data, then only with changed values,
  // so we need to store all values in a dict and check if they are changed or not.
   let not_seen = false;
  if (!(data.id in id_object_dict))
  {
    id_object_dict[data.id] = data;
    not_seen = true;
  }
    // replace first '-' with '/''
  var url = data.id.replace("-", "/");

  try {
      var result = data;
      if (do_fetch)
      {
        const response = await fetch(`http://${HEATPUMP_LISTENER_IP}/`  + url, {
            method: "GET"
        });
        result = await response.json();
      }
    
      let changed = false;
     
      let old_value = "";
      if (result.id in id_value_dict)
      {
        if (id_value_dict[result.id] != result.value)
        {
          changed = true;
          old_value = id_value_dict[result.id];
        }
      }
      

      id_value_dict[result.id] = result.value;
      id_object_dict[result.id].value = result.value;
      let old_state = id_object_dict[result.id].state;
      id_object_dict[result.id].state = result.state;

      if (changed || not_seen)
      {
        if (changed)
          changed_last_run = new Date();
        //changed = false;
        //console_log("error", result);
        if (changed)
        {
          console_log("info",  "changed: ", ((result.name) ? result.name : id_object_dict[result.id].name) , old_value, " -> ", result.value);
        }
        //console_log("error", "NOT seen: ", not_seen, "CHANGED: ", changed);
        //console_log("error",  "FALSE sse.send: ", ((result.name) ? result.name : id_object_dict[result.id].name) , result.value);
        sse.send(
          {
            element: result,
            diff: (old_value != "") ? (result.value - old_value) : undefined,
            previous_state: old_state,
            initial: false
          },
          'state',
        );
      }
      return changed;
    } catch (error) {
        console_log("error", url)
        console_log("error", "Error:", error);
    }
    return true;
}

