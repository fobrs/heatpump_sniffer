import express from "express";
import ViteExpress from "vite-express";
import {EventSource} from 'eventsource';
import * as dotenv from 'dotenv';
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

app.get("/hello", (req, res) => {
  res.send("Hello Vite!");
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
  if (!id)
  {
    res.status(400).send("Missing id parameter");
    return;
  }

  get_data(id).then((data) => {

    res.send(data);
  }).catch((err) => {
    console_log("error", "Error getting data: ", err);
    res.status(500).send("Error getting data");
  });
});

const server = app.listen(PORT, HOST, () =>
  console_log("info",  `App listening on ${HOST}:${PORT}`),
);


setTimeout( async function ()
{        
    // check db tables
  if (!prepare_db_done) {
    prepare_db_done = true;
    await prepare_db(id_object_dict); 
    await save_to_db(id_object_dict, id_value_dict);
    const interval = setInterval(() => save_to_db(id_object_dict, id_value_dict) , 30 * 1000);
  }
}, 10*1000);

const es = new EventSource(`http://${HEATPUMP_LISTENER_IP}/events`)

es.addEventListener('state', async (event) =>  {

  const data = JSON.parse(event.data);
  try {
    var b = await parse_state(data);
    if (b)
       console_log("info", event.data);
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
  if (!(data.id in id_object_dict))
  {
    id_object_dict[data.id] = data;
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

      if (changed)
      {
        changed = false;
        //console_log("error", result);
        if (!result.name)
        {
          console_log("error",  "changed: ", ((result.name) ? result.name : id_object_dict[result.id].name) , old_value, " -> ", result.value);
          //changed = true;
        }            
      }
      return changed;
    } catch (error) {
        console_log("error", url)
        console_log("error", "Error:", error);
    }
    return true;
}

