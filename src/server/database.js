import * as mariadb from 'mariadb';
import * as dotenv from 'dotenv';
import { console_log } from './log.js' ;




const datetime_scale_quarter_hour = 0;
const datetime_scale_hour = 1;
const datetime_scale_day = 2;
const datetime_scale_week = 3;
const datetime_scale_all = 4;


dotenv.config({ path: './src/server/.env.local' });
const {
    HEATPUMP_LISTENER_IP,
    PORT, HOST,
    DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD, DATABASE_PORT, DATABASE_SCHEMA,
 } = process.env;


var conn = null;
var fields = []; // field names in cardinal order, get from database to be sure of correct order when insert data

const pool = mariadb.createPool({
    host: DATABASE_HOST,
    user: DATABASE_USER,
    password: DATABASE_PASSWORD,
    port: DATABASE_PORT,
    database: DATABASE_SCHEMA,
    connectionLimit: 10,
    connectTimeout: 3000,
});


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




async function prepare_db(id_object_dict)
{

  var errr = false;
  try {
    console_log("error",  "get connecttion...");
      if (!conn || !conn.isValid())
        conn = await _pool_get_connection();
      try {
            //const row = await conn.query(
                
            var _sql =  sql`CREATE TABLE IF NOT EXISTS \`heatpump_modbus\` (
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
                _sql += `\`${o.id}\` ${Type} NULL DEFAULT NULL,            `
            });    

            _sql += `PRIMARY KEY (\`id\`) USING BTREE,
            UNIQUE INDEX \`time\` (\`time\`) USING BTREE ) ENGINE=InnoDB COLLATE='utf8mb3_general_ci';`;

            //console_log("database",  _sql);
            const row = await conn.query(_sql);

            _sql =  sql`CREATE TABLE IF NOT EXISTS \`heatpump_modbus_metadata\` (
                \`data\` JSON NULL DEFAULT NULL
                ) ENGINE=InnoDB COLLATE='utf8mb3_general_ci';`;
            const  row2 = await conn.query(_sql);

            if (id_object_dict != null && Object.keys(id_object_dict).length > 0)
            {
                _sql =  sql`DELETE FROM heatpump_modbus_metadata`;
                const  row4 = await conn.query(_sql);
                _sql =  sql`INSERT IGNORE INTO heatpump_modbus_metadata (data) VALUES (?)`;
                const  row3 = await conn.query(_sql, [JSON.stringify(id_object_dict)]);
            }

            // get fields in cardinal order
            _sql =  sql`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'heatpump_modbus' ORDER BY ORDINAL_POSITION`;
            const  row5 = await conn.query(_sql);
            var fields = [];
            row5.forEach(row => {
                fields.push(row.COLUMN_NAME);
            });
            //console_log("database",  "Fields in cardinal order: ", fields);
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

var ids_in_cardinal_order = [];

async function save_to_db(id_object_dict, id_value_dict, diff)
{
  var errr = false;
  try {
    if (!conn || !conn.isValid())
        conn = await _pool_get_connection();
    var arr = []
    var _sql;
  
      try {

          //console_log("database",  id_value_dict);
          let obj = [];
          let values = "";
          if (ids_in_cardinal_order.length == 0)
          {
            const ids = Object.keys(id_object_dict);
            // order ids by fields in database to be sure of correct order when insert data
            ids.sort((a, b) => {
                let indexA = fields.indexOf(a);
                let indexB = fields.indexOf(b);
                return indexA - indexB;
            });
            //console_log("database",  "Sorted ids: ", ids);
            ids_in_cardinal_order = ids;
          }

          obj.push(new Date);
          
          ids_in_cardinal_order.forEach(element => { 
            let o = id_object_dict[element];
            obj.push(id_value_dict[element]);
            values += "?, ";  
          });

          values += "?, ";  
          values += "?";  
          
          //values = values.substring(0, values.length - 2); // Remove trailing ", "

          arr = Object.keys(obj).map(key => obj[key]);

          // add 0 id field to get autonumber id                     
          arr.unshift(0);


          //console_log("database",  arr);

          _sql = sql`INSERT INTO heatpump_modbus values (${values})`

          const row = await conn.query(_sql, arr)
             
          if (row.length > 0) {
              data_exists = true;
          }

      }
      catch (err) {
          errr = true;

          console_log("error",  err);
          console
          console_log("error",  arr);

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

async function get_metadata()
{
  var errr = false;
  try {
     if (!conn || !conn.isValid())
        conn = await _pool_get_connection();
      try {                         
            var _sql =  sql`SELECT data FROM heatpump_modbus_metadata LIMIT 1`;
            const row = await conn.query(_sql);
            if (row.length > 0) {
                return row[0].data;
            }
            return null;
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

async function get_data(id, scale)
{
    var where = 2;
    switch (parseInt(scale))
    {
        case datetime_scale_quarter_hour:
            where = "time > DATE_SUB(NOW(), INTERVAL 15 MINUTE)";
            break;
        case datetime_scale_hour:
            where = "time > DATE_SUB(NOW(), INTERVAL 1 HOUR)";
              break;
        case datetime_scale_day:
            where = "time > DATE_SUB(NOW(), INTERVAL 1 DAY)";
              break;
        case datetime_scale_week:
           where = "time > DATE_SUB(NOW(), INTERVAL 1 WEEK)";
             break;
        case datetime_scale_all:
             where = "1=1";
               break;
    }
   // console_log("database",  "get_data for id: "+ id + " with scale: " + scale + " and limit: " + Limit);

  var errr = false;
  try {
     if (!conn || !conn.isValid())
        conn = await _pool_get_connection();
      try {                        
            // one day data with 30 sec interval
            /*
            SELECT * FROM
(
 SELECT * FROM table ORDER BY id DESC LIMIT 50
) AS sub
ORDER BY id ASC;
            */
            var _sql =  sql` SELECT time, \`${id}\` FROM heatpump_modbus WHERE ${where} ORDER BY time ASC`;
           
            const rows = await conn.query(_sql);            
            
            var last_row = null;
            var data = [];
            
            rows.forEach(row => {
                if (last_row == null)
                    last_row = row;
                if (row.time.getTime() - last_row.time.getTime() >= 90 * 1000) 
                {
                    data.push( { x: row.time.getTime() - 1000, y: last_row[id] });
                }
                data.push( { x: row.time.getTime(), y: row[id] });
                last_row = row;
            });
            return data;
        }
        catch (err) {
            errr = true;
            console_log("error",  err);
            throw err;
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

export { prepare_db, save_to_db, get_metadata, get_data };