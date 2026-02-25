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
        
        value_span.innerHTML = data.element.state;


        // add value to chart   

        if (metadata[data.element.id].chart)
        {
            metadata[data.element.id].chart.data.datasets[0].data.shift();
            const d = new Date();
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