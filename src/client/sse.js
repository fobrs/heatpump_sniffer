import { metadata } from "./main.js";

var eventSource = null;
var reconnect_delay = 1000;


function setup_EventSource()
{
    console.log('setup_EventSource');
    eventSource = new EventSource('./stream/meter/'); //
   // message_clear();
    eventSource.addEventListener('error', (e) => {
        const timeElapsed = Date.now();
        const today = new Date(timeElapsed);
        if (e.eventPhase === EventSource.CLOSED) {
            eventSource.close();
            console.log("Event Source Closed");
        }
     
        //set_values_waiting(true);

    
        
        setTimeout(() => {
            //message("Event Source reconnect at: " + today.toTimeString() );
            console.log('call setup_EventSource');
            setup_EventSource();
            }, reconnect_delay);
        if (reconnect_delay < 3000)
            reconnect_delay *= 2;            
    });


    eventSource.addEventListener('open', (e) => 
    {
        console.log('Connected to event source at', e.target.url);

       //DOMContentLoaded_func();
    });

    eventSource.addEventListener('clientID', (e) => 
    {
        const data = JSON.parse(e.data);
        clientID = data.clientID;
        console.log("clientID: " + clientID );
        console.log("ip: " + data.ip_address );
        g_ip_address = data.ip_address ;   
        if (data.ip_address != undefined)
        {
            const pieces = data.ip_address.split('.');
            if (pieces.length == 4)
            {
                if (true /*pieces[0] = 192 && pieces[1] == 168*/)
                {
                    local_ip_address = true;
                  //  document.getElementById("checkboxes_id").style.display = "flex";
                }
            }
        }
    });


    eventSource.addEventListener('state', (e) => {
         const data = JSON.parse(e.data);

        //console.log("state: ", data.element);
        
        let value_span = document.getElementsByClassName(data.element.id)[0];
        if (!value_span)
            return;
        if (data.previous_state != undefined)
        {            
             value_span.innerHTML = data.previous_state + (data.diff > 0 ? " ↗ " : " ↘ ") + data.element.state;
        }
        else
        {
            value_span.innerHTML = data.element.state;
        }


        // add value to chart   

        if (metadata[data.element.id].chart)
        {
            metadata[data.element.id].chart.data.datasets[0].data.shift();
            const d = new Date();
            // copy last value to avoid gaps in chart when value does change
            if (metadata[data.element.id].chart.data.datasets[0].data.length > 0 &&
                metadata[data.element.id].chart.data.datasets[0].data[metadata[ data.element.id].chart.data.datasets[0].data.length - 1].x
                 - d.getTime() > 60 * 1000) // if last value is older than 1 minute, add a copy of it to avoid gaps in chart
            {
                metadata[data.element.id].chart.data.datasets[0].data.push({x: d.getTime() - 1000, y:
                    metadata[data.element.id].chart.data.datasets[0].data[
                        metadata[data.element.id].chart.data.datasets[0].data.length - 1].y});
            }
            metadata[data.element.id].chart.data.datasets[0].data.push({x: d.getTime(), y: data.element.value});
            metadata[data.element.id].chart.update();
        }

        if (!data.initial)
        {
            //re order div to top
            let parent_div = value_span.parentElement;
            parent_div.parentElement.prepend(parent_div);


        }

    } );

}

export { eventSource, setup_EventSource};