import "./style.css";

import { setupCounter } from "./counter.js";
import javascriptLogo from "./javascript.svg";



var res = await fetch("/getMetadata", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });
var resp = await res.json();

console.log("Metadata", resp);
var metadata = resp


for (const key in metadata) {
  if (metadata.hasOwnProperty(key)) {
    const element = metadata[key];
    console.log("Metadata element", element);


    document.querySelector("#charts").innerHTML += `
      <div class="chart-container">
        <h3>${element.name}</h3>
        <canvas id="${element.id}" class="line-chart" width="1000" height="200"></canvas>
      </div>
    `;
   

     
  }   
}

for (const key in metadata) {
    if (metadata.hasOwnProperty(key)) {
    const element = metadata[key];

    var res = await fetch("/getData?id=" + element.id , {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });
    var resp = await res.json();

    const ctx = document.getElementById(element.id).getContext('2d');
      metadata[key].chart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    data: [],
                    label: element.name,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1,
                    pointRadius: 0,

                    fill: false
                }]
            },
            options: {
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
                        distribution: 'linear',
                    },
                    y: {
                        beginAtZero: true
                    }
                }
            }
        }); 

     
    console.log("Data for element", element.id, resp);
    metadata[key].chart.data.datasets[0].data = resp;
    metadata[key].chart.update();
   }
}

