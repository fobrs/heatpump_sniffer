import express from "express";
import ViteExpress from "vite-express";
import {EventSource} from 'eventsource';
import bodyParser from 'body-parser';
import * as dotenv from 'dotenv';
import SSE from '@gazdagandras/express-sse';
import session from 'express-session';
import { prepare_db, save_to_db, get_metadata, get_data } from './database.js' ;
import { console_log } from './log.js' ;



dotenv.config({ path: './src/server/.env.local' });
const {
    HEATPUMP_LISTENER_IP,
    PORT, HOST,
    DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD, DATABASE_PORT, DATABASE_SCHEMA,
 } = process.env;



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
          console_log("error", "Saving to db...");
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
  console_log("error", "Log: ", event.data)
})
es.addEventListener('ping', (event) => {
  console_log("error", "Ping: ", event.data)
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
      id_object_dict[result.id].state = result.state;

      if (changed || not_seen)
      {
        if (changed)
          changed_last_run = new Date();
        //changed = false;
        //console_log("error", result);
        if (changed)
        {
          console_log("error",  "changed: ", ((result.name) ? result.name : id_object_dict[result.id].name) , old_value, " -> ", result.value);
        }
        //console_log("error", "NOT seen: ", not_seen, "CHANGED: ", changed);
        //console_log("error",  "FALSE sse.send: ", ((result.name) ? result.name : id_object_dict[result.id].name) , result.value);
        sse.send(
          {
            element: result,
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

