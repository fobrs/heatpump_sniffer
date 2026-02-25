import "./style.css";

import { setupCounter } from "./counter.js";
import javascriptLogo from "./javascript.svg";

import { eventSource, setup_EventSource} from "./sse.js";


const datetime_scale_quarter_hour = 0;
const datetime_scale_hour = 1;
const datetime_scale_day = 2;
const datetime_scale_week = 3;
const datetime_scale_all = 4;

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

for (const element of metadata_array) {
    //console.log("Metadata element", element);

    document.querySelector("#charts").innerHTML += `
      <div class="chart-container">
        <b>${element.name} </b><span class="${element.id}" > </span><br>
        <canvas id="${element.id}" class="line-chart" width="1000" height="200"></canvas>
      </div>
    `;
 
}

for (const element of metadata_array) {

    var res = await fetch("/getData?id=" + element.id + "&scale=" + datetime_scale, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });
    var resp = await res.json();

    const ctx = document.getElementById(element.id).getContext('2d');
      metadata[element.id].chart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    data: [],
                    label: '',//element.name,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1,
                    pointRadius: 0,

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
                spanGaps: false,
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
                        unit: 'hour',
                        time : { 
                            displayFormats: {
                                second: 'HH:mm',
                                minute: 'HH:mm',
                                hour: 'HH:mm',
                                day: 'DD MMM',
                                week: 'DD MMM',
                                month: 'MMM YYYY',
                                year: 'YYYY'
                            }
                        },
                        distribution: 'linear',
                    },
                    y: {
                        beginAtZero: true
                    }
                }
            }
        }); 

     
 //   console.log("Data for element", element.id, resp);
    metadata[element.id].chart.data.datasets[0].data = resp;
    metadata[element.id].chart.update();
}


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
  }
});


selectDatetime_scale_fn = async function(event, s, clear, date_point)
{
    if (event)
        event.stopPropagation();
    console.log('selectDatetime_scale_fn '+ s);

    datetime_scale = s;
    for (const element of metadata_array) {

        var res = await fetch("/getData?id=" + element.id + "&scale=" + datetime_scale, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });
        var resp = await res.json();
    

        if (metadata[element.id].chart)
        {
            metadata[element.id].chart.data.datasets[0].data = resp;
            metadata[element.id].chart.update();
        }
    }

}



export {
    metadata,
    datetime_scale_quarter_hour,
    datetime_scale_hour,
    datetime_scale_day,
    datetime_scale_week,
    datetime_scale_all

 };
