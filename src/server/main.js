import express from "express";
import ViteExpress from "vite-express";
import {EventSource} from 'eventsource';
import * as dotenv from 'dotenv';
import * as mariadb from 'mariadb';

dotenv.config({ path: './src/server/.env.local' });
const {
    HEATPUMP_LISTENER_IP,
    PORT, HOST,
    DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD, DATABASE_PORT, DATABASE_SCHEMA,
 } = process.env;

const pool = mariadb.createPool({
    host: DATABASE_HOST,
    user: DATABASE_USER,
    password: DATABASE_PASSWORD,
    port: DATABASE_PORT,
    database: DATABASE_SCHEMA,
    connectionLimit: 10,
    connectTimeout: 3000,
});

var prepare_db_done = false;

var id_value_dict = {};
var id_name_dict = {};
var id_object_dict = {};
var do_fetch = false;

const app = express();

app.get("/hello", (req, res) => {
  res.send("Hello Vite!");
});

const g_level = 6;
var g_levels = ["error", "info", "warning", "database", "debug", "all"];
var logCopy = console.log.bind(console);

console.log = function (data) {
    var currentDate = '[' + new Date().toUTCString() + '] ';
    logCopy(currentDate, data);
};

function console_log(...args)
{
    var _level = g_levels.indexOf(args[0]);
    if (_level < g_level)
        console.log(args);
}

const server = app.listen(PORT, HOST, () =>
  console_log("info",  `App listening on ${HOST}:${PORT}`),
);


setTimeout( async function ()
{        
    // check db tables
  if (!prepare_db_done) {
    
    prepare_db_done = true;
    await prepare_db();
    await save_to_db();
    const interval = setInterval(save_to_db, 30 * 1000);
  }
}, 10*1000);

const es = new EventSource(`http://${HEATPUMP_LISTENER_IP}/events`)

es.addEventListener('state', async (event) =>  {

  const data = JSON.parse(event.data);
  //console_log("info", data);
  try {
    var b = await parse_state(data);
    if (b)
    {
       console_log("info", event.data);
    }
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

var conn = null;

async function parse_state(data)
{
  // replace first '-' with '/''
  if (!(data.id in id_object_dict))
  {
    id_object_dict[data.id] = data;
  }

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
      if (result.name && !(result.name in id_name_dict))
      {
           id_name_dict[result.id] = result.name;
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
          console_log("error",  "changed: ", ((result.name) ? result.name : id_name_dict[result.id]) , old_value, " -> ", result.value);
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

async function _pool_get_connection()
{
    connection_pool_info();

    if (pool.activeConnections() == 100)
    {
       console_log("database",  "Oeps");
    }

    var conn = null;
    try {
        conn = await pool.getConnection();
    }
    catch (err)
    {
        console_log("error",  err)
        connection_pool_info();
    }
    finally {
        if (conn)
            return conn;
    }
    return conn;
}

function connection_pool_info()
{
    var stack = new Error().stack,
        caller = stack.split('\n')[2].trim();
    console_log("database",  stack);
    console_log("database",  'in function: '+ caller);
    console_log("database",  "Total connections: " + pool.totalConnections());
    console_log("database",  "Active connections: " + pool.activeConnections());
    console_log("database",  "Idle connections: " + pool.idleConnections());
}

function sql(strings, ...values)
{
    //console_log("error", strings[0], strings.length, values.length);
    let result = strings[0];
    for (let i = 1; i < strings.length; i++)
    {
        result += values[i-1] + strings[i];
    }
    //console_log("error", result);
    return result;
}




async function prepare_db()
{

  var errr = false;
  try {
    console_log("error",  "get connecttion...");
      conn = await _pool_get_connection();
      try {
          //const row = await conn.query(
            
          var _sql =  sql`
          
              CREATE TABLE IF NOT EXISTS \`heatpump_modbus\` (
                \`id\` int(11) UNSIGNED NOT NULL auto_increment,
                \`time\` datetime NOT NULL default current_timestamp,
                `;
          const ids = Object.keys(id_object_dict);

          ids.forEach(element => {
            let o = id_object_dict[element];
            //console_log("database",  o, id_object_dict[o]);
            let Type = "VARCHAR(32)";
            if (o.id && o.id.startsWith("binary"))
            {
              Type = "BOOLEAN";
            }
            else if (o.id && o.id.startsWith("text"))
            {
              Type = "VARCHAR(32)";
            }
            else if (o.id && o.id.startsWith("switch"))
            {
              Type = "BOOLEAN";
            }
            else if (o.id && o.id.startsWith("sensor"))
            {
              Type = "FLOAT";
            }
            else if (o.id && o.id.startsWith("number"))
            {
              Type = "FLOAT";
            }
            else if (o.id && o.id.startsWith("select"))
            {
              Type = "VARCHAR(32)";
            }
            _sql += `\`${o.id}\` ${Type} NULL DEFAULT NULL,
            `
          });    

          _sql += `PRIMARY KEY (\`id\`) USING BTREE,
          UNIQUE INDEX \`time\` (\`time\`) USING BTREE ) ENGINE=InnoDB COLLATE='utf8mb3_general_ci';`;

          //console_log("database",  _sql);
          const row = await conn.query(_sql);


      }
      catch (err) {
          errr = true;

          console_log("error",  err);

          ;
      }
      finally {
          ;
      }
      if (errr)
      {
          if (conn) {
          //    conn.end();
          //    conn = null;
          }
      }

  } catch (err) { 
      console_log("error",  err);
  }
  finally {
//      if (conn)
//          conn.end();
  }
}

async function save_to_db()
{
  var errr = false;
  try {
      
  
      try {

          //console_log("database",  id_value_dict);
          let obj = [];
          let values = "";

          const ids = Object.keys(id_object_dict);

          obj.push(new Date);
          
          ids.forEach(element => { 
            let o = id_object_dict[element];
            obj.push(id_value_dict[element]);
            values += "?, ";  
          });

          values += "?, ";  
          values += "?";  
          
          //values = values.substring(0, values.length - 2); // Remove trailing ", "

          let arr = Object.keys(obj).map(key => obj[key]);

          // add 0 id field to get autonumber id                     
          arr.unshift(0);


          //console_log("database",  arr);

          var _sql = sql`
              INSERT INTO heatpump_modbus values (${values})`


          const row = await conn.query(_sql, arr)
             
          if (row.length > 0) {
              data_exists = true;
          }

      }
      catch (err) {
          errr = true;

          console_log("error",  err);

          ;
      }
      finally {
          ;
      }
      if (errr)
      {
         
      }
  } catch (err) {
      console_log("error",  err);
  }
  finally {
     
  }
}