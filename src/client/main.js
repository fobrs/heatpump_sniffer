import "./style.css";

import { setupCounter } from "./counter.js";
import javascriptLogo from "./javascript.svg";

import { eventSource, setup_EventSource} from "./sse.js";

var current_date_point = 0;
const datetime_scale_quarter_hour = 0;
const datetime_scale_hour = 1;
const datetime_scale_day = 2;
const datetime_scale_yesterday = 3;
const datetime_scale_week = 4;
const datetime_scale_all = 5;

var datetime_scale = datetime_scale_quarter_hour;

setup_EventSource();

var res = await fetch("/getMetadata", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });
var resp = await res.json();

//console.log("Metadata", resp);
var metadata = resp

var metadata_array = Object.keys(metadata).map(key => metadata[key]);
for (var i = 0; i < metadata_array.length; i++) {
  if (!metadata_array[i].name) 
    {
      metadata_array[i].name = metadata_array[i].id;  
    } 
  if (!metadata_array[i].entity_category) 
  {
    metadata_array[i].entity_category = 0;
  }
  if (!metadata_array[i].sorting_group) 
  {
    metadata_array[i].sorting_group = '';
  }
}



metadata_array.sort((a, b) => a.name.localeCompare(b.name));

metadata_array.sort((a, b) => a.entity_category < b.entity_category ? -1 : 1);

metadata_array.sort((a, b) => a.sorting_group.localeCompare(b.sorting_group));


document.querySelector("#charts_power").innerHTML += `
      <div class="chart-container">
        <b>Calculated Power </b><span class="power_id" > </span><br>
        <canvas id="chart_power_id" class="line-chart" width="600" height="150"></canvas>
      </div>
    `;
document.querySelector("#charts_multiple").innerHTML += `
      <div class="chart-container">
        <b>Selection </b><span class="selection_id" > </span><br>
        <canvas id="chart_selection_id" class="line-chart" width="600" height="150"></canvas>
      </div>
    `;

selection_changed = function(event) {
  const id = event.target.value;
  const checked = event.target.checked;
  const color = document.getElementById(id + "_color").value;
  console.log("selection_changed", id, checked);
  if (checked)
  {
      selection_chart.data.datasets.push({
                data: metadata[id].chart.data.datasets[0].data,
                id: id,
                label: '',//element.name,
                borderColor: color,
                borderWidth: 1,
                pointRadius: datetime_scale <= datetime_scale_hour ? 2 : 0,
                fill: false
            }
        );

        
        let value_span = document.getElementsByClassName(id)[0];
         //re order div to top
        let parent_div = value_span.parentElement;
        parent_div.remove();
        document.getElementById("charts_selected").prepend(parent_div);
  }
  else
  {
    selection_chart.data.datasets = selection_chart.data.datasets.filter(
        (col) => col.id !== id
    );
    let value_span = document.getElementsByClassName(id)[0];
         //re order div to top
    let parent_div = value_span.parentElement;
    document.getElementById("charts").prepend(parent_div);
    
  }
  selection_chart.update();
};


color_change = function (e)
{
    let id = e.id.replace("_color", "");

    for (let i = 0; i < selection_chart.data.datasets.length; i++)
    {
        if (selection_chart.data.datasets[i].id == id)
        {
             selection_chart.data.datasets[i] = {
                data: metadata[id].chart.data.datasets[0].data,
                id: id,
                label: '',//element.name,
                borderColor: e.value,
                borderWidth: 1,
                pointRadius: datetime_scale <= datetime_scale_hour ? 2 : 0,
                fill: false
            };
            break;
        }
    }
    selection_chart.update();

    let d = metadata[id].chart.data.datasets[0].data;

    metadata[id].chart.data.datasets[0] = {
                data: d,
                id: id,
                label: '',//element.name,
                borderColor: e.value,
                borderWidth: 1,
                pointRadius: datetime_scale <= datetime_scale_hour ? 2 : 0,
                fill: false
            };

    metadata[id].chart.update();

}

for (const element of metadata_array) {
    //console.log("Metadata element", element);

    if (element.name.includes("set by Cic"))
    {
        document.querySelector("#charts_cic").innerHTML += `
      <div class="chart-container">
        <input type="color" id="${element.id}_color" value="#90a094" class="primary_color field-radio" onchange="color_change(this)"/>
        <b>${element.name} </b><span class="${element.id}" > </span><br>
        <canvas id="${element.id}" class="line-chart" width="600" height="150"></canvas>
      </div>
    `;
    }
    else
    {
        document.querySelector("#charts").innerHTML += `
        <div class="chart-container">
            <input type="checkbox" id="checkbox_${element.id}" name="checkbox_${element.id}" value="${element.id}" 
                onclick="selection_changed(event);"/>
            <input type="color" id="${element.id}_color" value="#90a094" class="primary_color field-radio" onchange="color_change(this)"/>
            <b>${element.name} </b><span class="${element.id}" > </span><br>
            <canvas id="${element.id}" class="line-chart" width="600" height="150"></canvas>
        </div>
        `;
    }
}



 var powerchart = new_chart("chart_power_id");
 var selection_chart = new_chart("chart_selection_id");



for (const element of metadata_array) {

    try  {
        var res = await fetch("/getData?id=" + element.id + "&scale=" + datetime_scale + "&datepoint=" + current_date_point, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                });
        var resp = await res.json();
    }
    catch (e)
    {

    }
    metadata[element.id].chart = new_chart(element.id);
     
 //   console.log("Data for element", element.id, resp);
    metadata[element.id].chart.data.datasets[0].data = resp;
    metadata[element.id].chart.update();
}

add_power_chart();

res = await fetch("/getState", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });
resp = await res.json();


document.addEventListener("visibilitychange", function() {
  console.log(`Your page is  ${document.visibilityState}`);
  if (document.visibilityState === 'hidden' && eventSource)
  {
        eventSource.close();
  }
  else
  {
        setup_EventSource();
        reload_data();
  }
});
navigate_fn = async function( event, direction)
{
    if (current_date_point == 0 && direction > 0)
        return;
    if (direction <= -2)
        direction = -1;
    if (direction > 1)
        current_date_point = 0;  
    else
        current_date_point += direction;
    if (current_date_point > 0)
    {
        current_date_point = 0;
        current_day_in_week = 0;
    }
    console.log('from navigate_fn');
    await selectDatetime_scale_fn(null, datetime_scale, true);

}

async function reload_data_get()
{
    for (const element of metadata_array) {
        try {
        var res = await fetch("/getData?id=" + element.id + "&scale=" + datetime_scale +
                                                            "&datepoint=" + current_date_point, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });
            var resp = await res.json();
        

            if (metadata[element.id].chart)
            {
                metadata[element.id].chart.data.datasets[0].pointRadius = datetime_scale <= datetime_scale_hour ? 2 : 0;
                metadata[element.id].chart.data.datasets[0].data = resp;
                metadata[element.id].chart.update();
            }

            for (let i = 0; i < selection_chart.data.datasets.length; i++)
            {
                if (selection_chart.data.datasets[i].id == element.id)
                {
                    selection_chart.data.datasets[i].pointRadius = datetime_scale <= datetime_scale_hour ? 2 : 0;
                    selection_chart.data.datasets[i].data = metadata[element.id].chart.data.datasets[0].data;
                    break;
                }
            }
        }
        catch (e)
        {

        }        
    }
    selection_chart.update();
    
}

selectDatetime_scale_fn = async function(event, s, clear, date_point)
{
    if (event)
    {
        event.stopPropagation();
        current_date_point = 0;
    }

    console.log('selectDatetime_scale_fn '+ s);

    datetime_scale = s;

    reload_data_get();
 
    add_power_chart();

}

async function reload_data()
{
     await selectDatetime_scale_fn(null, datetime_scale);
     add_power_chart();
}


export {
    metadata,
    datetime_scale,
    datetime_scale_quarter_hour,
    datetime_scale_hour,
    datetime_scale_day,
    datetime_scale_yesterday,
    datetime_scale_week,
    datetime_scale_all,
    reload_data,
    current_date_point,
    selection_chart
 };


function new_chart(element_id)
{

    const ctx = document.getElementById(element_id).getContext('2d');
    let chart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                data: [],
                label: '',//element.name,
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1,
                pointRadius: datetime_scale <= datetime_scale_hour ? 2 : 0,

                fill: false
            }]
        },
        options: {
            plugins: {
                legend: {
                    display: false
                }
            },
            showLines: false,
            spanGaps: true,
            layout: {
                padding: {
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0
                }
            },
            scales: {
                x: {
                    type: 'time',
                    /*unit: 'day',*/
                    time : { 
                        displayFormats: {
                            day: 'dd MMM',
                            hour: 'HH:mm',
                            minute: 'HH:mm',
                        }
                    },
                    ticks: {
                        source: 'auto',

                        autoSkip: false,
                        //autoSkipPadding: 50,
                        maxRotation: 0,
                        major: {
                            enabled: true
                        },
                        gridLines: {
                            color: 'rgba(133, 29, 133, 0.2)'
                        },
                    },
                    distribution: 'linear',
                    spanGaps: false,
                },
                y: {
                    beginAtZero: true,
                    spanGaps: false,
                    ticks: {
                        gridLines: {
                            color: 'rgba(133, 29, 133, 0.2)'
                        },
                    },     
                }
            }
        }
    }); 
    return chart
}

 const interval = setInterval(async function ()
    {
    reload_data_get();
       add_power_chart();
    }, 30 * 1000);

// calculate power chart
function add_power_chart()
{
    powerchart.data.datasets = [];
    const hp1_current = metadata["sensor-hp1_-_ac_current"].chart.data.datasets[0].data;
    const hp1_voltage = metadata["sensor-hp1_-_ac_voltage"].chart.data.datasets[0].data;
    const hp2_current = metadata["sensor-hp2_-_ac_current"].chart.data.datasets[0].data;
    const hp2_voltage = metadata["sensor-hp2_-_ac_voltage"].chart.data.datasets[0].data;

    const hp1_working_mode_set_by_cic = metadata["sensor-hp1_-_working_mode_set_by_cic"].chart.data.datasets[0].data;
    const hp2_working_mode_set_by_cic = metadata["sensor-hp2_-_working_mode_set_by_cic"].chart.data.datasets[0].data;
    const hp1_pump_flow = metadata["sensor-hp1_-_pump_flow"].chart.data.datasets[0].data;
    const hp2_pump_flow = metadata["sensor-hp2_-_pump_flow"].chart.data.datasets[0].data;
    
    const hp1_water_in_temperature = metadata["sensor-hp1_-_water_in_temperature"].chart.data.datasets[0].data;
    const hp2_water_in_temperature = metadata["sensor-hp2_-_water_in_temperature"].chart.data.datasets[0].data;
    const hp1_water_out_temperature = metadata["sensor-hp1_-_water_out_temperature"].chart.data.datasets[0].data;
    const hp2_water_out_temperature = metadata["sensor-hp2_-_water_out_temperature"].chart.data.datasets[0].data;
    const hp1_pump_relay = metadata["binary_sensor-hp1_-_pump_relay"].chart.data.datasets[0].data;
    const hp2_pump_relay = metadata["binary_sensor-hp2_-_pump_relay"].chart.data.datasets[0].data;
    const hp1_pump_power = metadata["sensor-hp1_-_pump_power"].chart.data.datasets[0].data;
    const hp2_pump_power = metadata["sensor-hp2_-_pump_power"].chart.data.datasets[0].data;
    const hp1_bottom_heater = metadata["binary_sensor-hp1_-_bottom_heater"].chart.data.datasets[0].data;
    const hp2_bottom_heater = metadata["binary_sensor-hp2_-_bottom_heater"].chart.data.datasets[0].data;
    const hp1_crankcase_heater = metadata["binary_sensor-hp1_-_crankcase_heater"].chart.data.datasets[0].data;
    const hp2_crankcase_heater = metadata["binary_sensor-hp2_-_crankcase_heater"].chart.data.datasets[0].data;
    
    const heat_capacity = 4.186;
    const power_data = [];
    if (true /*(hp1_current || hp2_current) && hp1_voltage && hp2_voltage*/ ) {
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
        const standby_power = 5.8 * 2;
        const reference_power = 400;
        const slope = 0.00012;
        const bottom_heater_on = 150;
        const crankcase_heater_on = 40;

        for (let i = 0; i < hp1_current.length; i++) {

            const power1 = hp1_current[i].y * hp1_voltage[i].y ;
            const power2 = hp2_current[i].y * hp2_voltage[i].y ;
            const power_ = power1 + power2;

            const pump_power = (hp1_pump_relay[i].y ? hp1_pump_power[i].y : 0) + (hp2_pump_relay[i].y ? hp2_pump_power[i].y : 0) ;
            const bottom_plate_heater = (hp1_bottom_heater[i].y ? bottom_heater_on : 0) +  (hp2_bottom_heater[i].y ? bottom_heater_on : 0);
            const crankcase_heater = (hp1_crankcase_heater[i].y ? crankcase_heater_on : 0) +  (hp2_crankcase_heater[i].y ? crankcase_heater_on : 0);

            const comp_driver_power = 1.0165 * power_;
            //const comp_driver_power2 = 1.035 * power2;
            const calibration = 1 + Math.max(0, (comp_driver_power)- reference_power) * slope;
           // const calibration2 = 1 + Math.max(0, comp_driver_power2 - reference_power) * slope;
            const power = standby_power +
                    (comp_driver_power) * calibration +
                 //   comp_driver_power2 * calibration2 +
                    pump_power +
                    bottom_plate_heater +
                    crankcase_heater;
            power_data.push({
                x: hp1_current[i].x,
                y: power // divide by 2 to get average power, as current and voltage are not measured at the same time
            });
        }
        powerchart.data.datasets.push({
                data: power_data,
                id: 0,
                label: '',//element.name,
                borderColor: 'blue',
                borderWidth: 1,
                pointRadius:  0,
                fill: false
            });
        powerchart.data.datasets[0].pointRadius = datetime_scale <= datetime_scale_hour ? 2 : 0;
    }
    if (hp1_pump_flow && hp2_pump_flow && hp1_water_in_temperature && hp2_water_in_temperature &&
        hp1_water_out_temperature && hp2_water_out_temperature)
    {
        const power_out_data = [];
        const cop_data = [];
        for (let i = 0; i < hp1_pump_flow.length && i < hp2_pump_flow.length; i++) {

            const avg_flow = (hp1_pump_flow[i].y + hp2_pump_flow[i].y) / (3600 * 2);
            const t_out_1 = hp1_water_out_temperature[i].y;
            const t_out_2 = hp2_water_out_temperature[i].y;
            const t_in_1 = hp1_water_in_temperature[i].y;
            const t_in_2 = hp2_water_in_temperature[i].y;

            const delta_t_1 = t_out_1 - t_in_1;
            const delta_t_2 = t_out_2 - t_in_2;

            const power = 1000 * heat_capacity * avg_flow * (
                    (hp1_working_mode_set_by_cic[i].y != 0 ? delta_t_1 : 0 ) + 
                    (hp2_working_mode_set_by_cic[i].y != 0 ? delta_t_2 : 0 ));
         
            power_out_data.push({
                x: hp1_pump_flow[i].x,
                y: power 
            });
            if (power_data.length > i )
            {
                const cop = Math.min(8, power / power_data[i].y) < 0 ? 0 : Math.min(8, power / power_data[i].y);


                cop_data.push({
                    x: hp1_pump_flow[i].x,
                    y: 1000 * cop
                });
            }
        }
        powerchart.data.datasets.push({
                data: power_out_data,
                id: 0,
                label: '',//element.name,
                borderColor: 'red',
                borderWidth: 1,
                pointRadius:  0,
                fill: false
            }
        );
       powerchart.data.datasets[1].pointRadius = datetime_scale <= datetime_scale_hour ? 2 : 0;

       powerchart.data.datasets.push({
                data: cop_data,
                id: 0,
                label: '',//element.name,
                borderColor: 'green',
                borderWidth: 1,
                pointRadius:  0,
                fill: false,
                spanGaps: false
            }
        );
       powerchart.data.datasets[2].pointRadius = datetime_scale <= datetime_scale_hour ? 2 : 0;

     
        let value_span = document.getElementsByClassName("power_id")[0];
        value_span.innerHTML = "in: "+ power_data[power_data.length-1].y.toFixed(0) + "W";
        value_span.innerHTML += " out: "+ power_out_data[power_out_data.length-1].y.toFixed(0)+ "W";
        value_span.innerHTML += " cop: "+ (cop_data[cop_data.length-1].y / 1000).toFixed(1);
    }
    powerchart.update();

}