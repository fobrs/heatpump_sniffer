import express from "express";
import ViteExpress from "vite-express";
import {EventSource} from 'eventsource';
import bodyParser from 'body-parser';
import * as dotenv from 'dotenv';
import SSE from '@gazdagandras/express-sse';
import session from 'express-session';
import { prepare_db, save_to_db, get_metadata, get_data } from './database.js' ;
import { console_log } from './log.js' ;
import { subscribe_to_T6, T6_remove_pairing } from './homekit.js' ;
import  process from 'node:process';

dotenv.config({ path: './src/server/.env.local' });
const {
    HEATPUMP_LISTENER_IP,
    PORT, HOST
 } = process.env;

// get data from thermostat and subscribe to changes
//await subscribe_to_T6();


process.stdin.resume();


process.on('SIGHUP', function() {
    console_log("error", "Caught HUP  interrupt signal");
})
process.on('SIGQUIT', function() {
    console_log("error", "Caught QUIT interrupt signal");
})
process.on('SIGINT', async function() {
    console_log("error", "Caught INT interrupt signal");
    //await T6_remove_pairing();

    process.exitCode = 1;
    process.kill();
});

process.on('SIGTERM', function() {
    console_log("error", "Caught TERM interrupt signal");
});


process.on('exit',() => {
    console_log("error", "process.exit() method is fired")
})

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
  const datepoint = req.query.datepoint;
  if (!id)
  {
    res.status(400).send("Missing id parameter");
    return;
  }

  get_data(id, scale, datepoint).then((data) => {

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

  
  try {
    const data = JSON.parse(event.data);
    var b = await parse_state(data);
  }
  catch (e)
  {
    console_log("error", "JSON exception: ", e, event.data); 
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


var fetch_ids =
{
    hp1_current:"sensor-hp1_-_ac_current",
    hp1_voltage:"sensor-hp1_-_ac_voltage",
    hp2_current:"sensor-hp2_-_ac_current",
    hp2_voltage:"sensor-hp2_-_ac_voltage",

    hp1_working_mode_set_by_cic:"sensor-hp1_-_working_mode_set_by_cic",
    hp2_working_mode_set_by_cic:"sensor-hp2_-_working_mode_set_by_cic",
    hp1_pump_flow:"sensor-hp1_-_pump_flow",
    hp2_pump_flow:"sensor-hp2_-_pump_flow",
  
    hp1_water_in_temperature:"sensor-hp1_-_water_in_temperature",
    hp2_water_in_temperature:"sensor-hp2_-_water_in_temperature",
    hp1_water_out_temperature:"sensor-hp1_-_water_out_temperature",
    hp2_water_out_temperature:"sensor-hp2_-_water_out_temperature",
    hp1_pump_relay:"binary_sensor-hp1_-_pump_relay",
    hp2_pump_relay:"binary_sensor-hp2_-_pump_relay",
    hp1_pump_power:"sensor-hp1_-_pump_power",
    hp2_pump_power:"sensor-hp2_-_pump_power",
    hp1_bottom_heater:"binary_sensor-hp1_-_bottom_heater",
    hp2_bottom_heater:"binary_sensor-hp2_-_bottom_heater",
    hp1_crankcase_heater:"binary_sensor-hp1_-_crankcase_heater",
    hp2_crankcase_heater:"binary_sensor-hp2_-_crankcase_heater",
}

const interval2 = setInterval(async function ()
    {
       get_realtime_power()
    },
    15 * 1000);


async function get_realtime_power()
{
   var power_in, power_out;
   power_in = power_out = 0.0;
   var values = {}; 
   for (const endpoint of Object.values(fetch_ids)) {
        const url = endpoint.replace("-", "/");

        //console_log("error",  url);
        try {
        
            let response = await fetch(`http://${HEATPUMP_LISTENER_IP}/`  + url);
            if (!response.ok) // or check for response.status
              throw new Error(response.statusText);
            let result = await response.json();
            values[endpoint] = result.value;

        } catch (err) {
          console_log("error", err)
        }     
   }

  const hp1_current = values["sensor-hp1_-_ac_current"];
  const hp1_voltage = values["sensor-hp1_-_ac_voltage"];
  const hp2_current = values["sensor-hp2_-_ac_current"];
  const hp2_voltage = values["sensor-hp2_-_ac_voltage"];

  const hp1_working_mode_set_by_cic = values["sensor-hp1_-_working_mode_set_by_cic"];
  const hp2_working_mode_set_by_cic = values["sensor-hp2_-_working_mode_set_by_cic"];
  const hp1_pump_flow = values["sensor-hp1_-_pump_flow"];
  const hp2_pump_flow = values["sensor-hp2_-_pump_flow"];

  const hp1_water_in_temperature = values["sensor-hp1_-_water_in_temperature"];
  const hp2_water_in_temperature = values["sensor-hp2_-_water_in_temperature"];
  const hp1_water_out_temperature = values["sensor-hp1_-_water_out_temperature"];
  const hp2_water_out_temperature = values["sensor-hp2_-_water_out_temperature"];
  const hp1_pump_relay = values["binary_sensor-hp1_-_pump_relay"];
  const hp2_pump_relay = values["binary_sensor-hp2_-_pump_relay"];
  const hp1_pump_power = values["sensor-hp1_-_pump_power"];
  const hp2_pump_power = values["sensor-hp2_-_pump_power"];
  const hp1_bottom_heater = values["binary_sensor-hp1_-_bottom_heater"];
  const hp2_bottom_heater = values["binary_sensor-hp2_-_bottom_heater"];
  const hp1_crankcase_heater = values["binary_sensor-hp1_-_crankcase_heater"];
  const hp2_crankcase_heater = values["binary_sensor-hp2_-_crankcase_heater"];

  const heat_capacity = 4.186;
  //if (hp1_current && hp1_voltage && hp2_current && hp2_voltage)
  {
          /*
    {% set standby_power = 5.15 %}
    {% set voltage = states('sensor.modbus_quatt_hp1_ac_voltage') | float(0) %}
    {% set current = states('sensor.modbus_quatt_hp1_ac_current') | float(0) %}
    {% set pump_power = states('sensor.modbus_quatt_hp1_pump_power') | float(0) if is_state('binary_sensor.modbus_quatt_hp1_dc_pump_relay', 'on') else 0 %}
    {% set bottom_plate_heater = 150 if is_state('binary_sensor.modbus_quatt_hp1_bottom_plate_heater', 'on') else 0 %}
    {% set crank_case_heater = 40 if is_state('binary_sensor.modbus_quatt_hp1_crankcase_heater', 'on') else 0 %}
    
    {# 1.035 is voltage correctie #}
    {% set comp_driver_power = 1.035 * voltage * current %}
    
    {# vermogensafhankelijke calibratie (gefit op daadwerkelijke data) #}
    {% set reference_power = 400 %}
    {% set slope = 0.00012 %}   {# ≈ +1.2% per 100W boven 400W #}
    
    {% set calibration = 1 + max(0, comp_driver_power - reference_power) * slope %}
    
    {{ (
        standby_power
      + comp_driver_power * calibration
      + pump_power
      + bottom_plate_heater
      + crank_case_heater
      ) | round(2)
    }}
          */
    var standby_power = 5.8 ;
    const reference_power = 400;
    const slope = 0.00012;
    const bottom_heater_on = 150;
    const crankcase_heater_on = 40;
    
    const power1 = hp1_current * hp1_voltage ;
    const power2 = hp2_current * hp2_voltage ;
    const power_ = power1 + power2;
    if ((power1 > 0 && power2 > 0) || (power1 ==  0 && power2 == 0))
      standby_power *= 2;

    const pump_power = (hp1_pump_relay ? hp1_pump_power : 0) + (hp2_pump_relay ? hp2_pump_power : 0) ;
    const bottom_plate_heater = (hp1_bottom_heater ? bottom_heater_on : 0) +  (hp2_bottom_heater ? bottom_heater_on : 0);
    const crankcase_heater = (hp1_crankcase_heater ? crankcase_heater_on : 0) +  (hp2_crankcase_heater ? crankcase_heater_on : 0);

    const comp_driver_power = 1.017 * power_;
    //const comp_driver_power2 = 1.035 * power2;
    const calibration = 1 + Math.max(0, (comp_driver_power)- reference_power) * slope;
    // const calibration2 = 1 + Math.max(0, comp_driver_power2 - reference_power) * slope;
    power_in = standby_power +
            (comp_driver_power) /** calibration*/ +
          //   comp_driver_power2 * calibration2 +
            pump_power +
            bottom_plate_heater +
            crankcase_heater;
  }
  //if (hp1_pump_flow && hp2_pump_flow && hp1_water_in_temperature && hp2_water_in_temperature &&
   //   hp1_water_out_temperature && hp2_water_out_temperature)
  {
      const avg_flow = (hp1_pump_flow + hp2_pump_flow) / (3600 * 2);
      const t_out_1 = hp1_water_out_temperature;
      const t_out_2 = hp2_water_out_temperature;
      const t_in_1 = hp1_water_in_temperature;
      const t_in_2 = hp2_water_in_temperature;

      const delta_t_1 = t_out_1 - t_in_1;
      const delta_t_2 = t_out_2 - t_in_2;

      power_out = 1000 * heat_capacity * avg_flow * (
              (hp1_working_mode_set_by_cic != 0 ? delta_t_1 : 0 ) + 
              (hp2_working_mode_set_by_cic != 0 ? delta_t_2 : 0 ));
    
  } 
  console_log("error", "power in: ", power_in.toFixed(0), "Out: ", power_out.toFixed(0)); 


  sse.send(
      {
        power: [ power_in, power_out ]
      },
      'power',
    );
}

