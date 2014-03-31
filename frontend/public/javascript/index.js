function createChart(elementId, data) {
    var ctx = document.getElementById(elementId).getContext("2d");

    new Chart(ctx).Bar({
        labels: _.map(data, function(i) { return i[0] }),
        datasets: [
            {
                fillColor : "rgba(151,187,205,0.5)",
                strokeColor : "rgba(151,187,205,1)",
                pointColor : "rgba(151,187,205,1)",
                pointStrokeColor : "#fff",
                data : _.map(data, function(i) { return i[1] })
            }
        ]
    });
}

$(function() {
    $('canvas').each(function() { $(this).attr("width", $(this).parent().width()); });

    function makeCharts() {
        //createChart('user-count', window.stats.user_count);
        createChart('cycle-duration', _.map(window.stats.cycle_durations, function(i) {
            return [moment(i[0]).format('HH:mm'), i[1]];
        }));
    }

    window.onresize = function(){
        var width = $('canvas').parent().width();
        $('canvas').attr("width",width);
        makeCharts();
    };

    makeCharts();
})