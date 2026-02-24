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



export { console_log };
