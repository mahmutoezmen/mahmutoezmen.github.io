// Constants for margin, width, and height
const margin = { top: 10, right: 20, bottom: 50, left: 80 };
const width = 900;
const height = 600;
const scatter_sq = width * 0.45;

// Load the data with parsing
d3.csv('cars.csv', d3.autoType).then(cars => {
    // Print the loaded data to verify
    console.log(cars);

    // Filter data to remove null values
    const carData = cars.filter(d => d.Miles_per_Gallon != null && d.Horsepower != null);

    // Check if columns exist
    const requiredColumns = ["Origin", "Miles_per_Gallon", "Horsepower", "Weight_in_lbs", "Cylinders", "Displacement", "Acceleration"];
    for (const column of requiredColumns) {
        if (!carData.every(d => d.hasOwnProperty(column))) {
            console.error(`Column ${column} is missing or has invalid values.`);
            return;
        }
    }

    // Compute origin counts
    const originCounts = d3.rollup(carData, group => group.length, d => d.Origin);
    const origins = Array.from(originCounts.keys()).sort();

    // Define color scale
    const carColor = d3.scaleOrdinal()
        .domain(origins)
        .range(d3.schemeTableau10);

    // Function to create the bar chart
    function barChart() {
        const barWidth = scatter_sq;
        const barHeight = 50;

        const svg = d3.create('svg')
            .attr('width', barWidth + margin.left + margin.right)
            .attr('height', barHeight + margin.top + margin.bottom);

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`);

        const x = d3.scaleLinear()
            .range([0, barWidth])
            .domain([0, d3.max(Array.from(originCounts.values()))]).nice();

        const y = d3.scaleBand()
            .domain(origins)
            .range([0, barHeight])
            .padding(0.2);

        const xAxis = d3.axisBottom(x);
        const xAxisGroup = g.append("g")
            .attr("transform", `translate(0, ${barHeight})`);
        xAxisGroup.call(xAxis)
            .call(g => g.selectAll('.tick line')
                .clone()
                .attr('stroke', '#d3d3d3')
                .attr('y1', -barHeight)
                .attr('y2', 0));

        const yAxis = d3.axisLeft(y);
        const yAxisGroup = g.append("g").call(yAxis);
        yAxisGroup.append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", -1 * (barHeight / 2))
            .attr("y", -50)
            .attr("fill", "black")
            .attr("dominant-baseline", "middle")
            .attr("text-anchor", "middle")
            .attr("font-weight", "bold")
            .text("Origin");

        const barsGroup = g.append("g");

        function update(data) {
            const originCounts = d3.rollup(
                data,
                group => group.length,
                d => d.Origin
            );

            const t = svg.transition()
                .ease(d3.easeLinear)
                .duration(200);

            barsGroup.selectAll("rect")
                .data(originCounts, ([origin, count]) => origin)
                .join("rect")
                .attr("fill", ([origin, count]) => carColor(origin))
                .attr("height", y.bandwidth())
                .attr("x", 0)
                .attr("y", ([origin, count]) => y(origin))
                .transition(t)
                .attr("width", ([origin, count]) => x(count));
        }

        return Object.assign(svg.node(), { update });
    }

    // Function to create a histogram
    function filteredHisto(col) {
        const histoWidth = width * 0.33;
        const num_hist = 4;
        const histoHeight = (scatter_sq / num_hist) - (6 * num_hist);

        const svg = d3.create('svg')
            .attr('class', 'histogram')
            .attr('width', histoWidth + margin.left + margin.right)
            .attr('height', histoHeight + margin.top + margin.bottom);

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`);

        const x = d3.scaleLinear()
            .range([0, histoWidth])
            .domain(d3.extent(carData, d => d[col])).nice();

        const histogram = d3.bin()
            .value(d => d[col])
            .domain(x.domain());
        const bins = histogram(carData);

        const y = d3.scaleLinear()
            .range([histoHeight, 0])
            .domain([0, d3.max(bins, d => d.length)]).nice();

        const xAxis = d3.axisBottom(x);
        const xAxisGroup = g.append("g")
            .attr("transform", `translate(0, ${histoHeight})`);
        xAxisGroup.append("text")
            .attr("x", 0)
            .attr("y", 33)
            .attr("fill", "black")
            .attr("font-weight", "bold")
            .attr("text-anchor", "start")
            .text(col);
        xAxisGroup.call(xAxis);

        const yAxis = d3.axisLeft(y).ticks(3);
        const yAxisGroup = g.append("g").call(yAxis)
            .call(g => g.selectAll('.tick line')
                .clone()
                .attr('stroke', '#d3d3d3')
                .attr('x1', 0)
                .attr('x2', histoWidth));

        g.append("g").selectAll("rect")
            .data(bins)
            .join("rect")
            .attr("fill", "lightgray")
            .attr("x", d => x(d.x0) + 1)
            .attr("width", d => x(d.x1) - x(d.x0) - 1)
            .attr("y", d => y(d.length))
            .attr("height", d => histoHeight - y(d.length));

        const barsGroup = g.append("g");

        function update(data) {
            const bins = histogram(data);

            const t = svg.transition()
                .ease(d3.easeLinear)
                .duration(200);

            barsGroup.selectAll("rect")
                .data(bins)
                .join("rect")
                .attr("fill", "steelblue")
                .attr("x", d => x(d.x0) + 1)
                .attr("width", d => x(d.x1) - x(d.x0) - 1)
                .transition(t)
                .attr("y", d => y(d.length))
                .attr("height", d => histoHeight - y(d.length));
        }

        return Object.assign(svg.node(), { update });
    }

    // Function to create a brushable scatterplot
    function brushableScatterplot() {
        const visWidth = 400, visHeight = 400;
        const xCol = "Weight_in_lbs", xLabel = "Weight (lbs)";
        const yCol = "Miles_per_Gallon", yLabel = "MPG";
        const initialValue = carData;

        const svg = d3.create('svg')
            .attr('width', visWidth + margin.left + margin.right)
            .attr('height', visHeight + margin.top + margin.bottom)
            .property('value', initialValue);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        const x = d3.scaleLinear()
            .domain([0, d3.max(carData, d => d[xCol])]).nice()
            .range([0, visWidth]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(carData, d => d[yCol])]).nice()
            .range([visHeight, 0]);

        const xAxis = d3.axisBottom(x);
        const xAxisGroup = g.append('g')
            .attr('transform', `translate(0, ${visHeight})`);
        xAxisGroup.call(xAxis)
            .call(g => g.selectAll('.tick line')
                .clone()
                .attr('stroke', '#d3d3d3')
                .attr('y1', -visHeight)
                .attr('y2', 0))
            .append('text')
            .attr('x', visWidth / 2)
            .attr('y', 40)
            .attr('fill', 'black')
            .attr('font-weight', 'bold')
            .attr('text-anchor', 'middle')
            .text(xLabel);

        const yAxis = d3.axisLeft(y);
        const yAxisGroup = g.append('g')
            .call(yAxis)
            .call(g => g.selectAll('.tick line')
                .clone()
                .attr('stroke', '#d3d3d3')
                .attr('x1', 0)
                .attr('x2', visWidth))
            .append('text')
            .attr('x', -40)
            .attr('y', visHeight / 2)
            .attr('fill', 'black')
            .attr('text-anchor', 'middle')
            .attr('font-weight', 'bold')
            .attr('transform', `rotate(-90, -40, ${visHeight / 2})`)
            .text(yLabel);

        const radius = 3;
        const dots = g.append('g')
            .selectAll('circle')
            .data(initialValue)
            .join('circle')
            .attr('cx', d => x(d[xCol]))
            .attr('cy', d => y(d[yCol]))
            .attr('r', radius)
            .attr('fill', d => carColor(d.Origin));

        const brush = d3.brush()
            .extent([[0, 0], [visWidth, visHeight]])
            .on('brush', brushed)
            .on('end', brushed);

        g.append('g').call(brush);

        function brushed(event) {
            const selection = event.selection;
            let value = initialValue;
            if (selection) {
                const [[left, top], [right, bottom]] = selection;
                const isBrushed = d => left <= x(d[xCol]) && x(d[xCol]) <= right && top <= y(d[yCol]) && y(d[yCol]) <= bottom;
                value = initialValue.filter(isBrushed);
            }
            svg.property('value', value).dispatch('input');
        }

        return svg.node();
    }

    // Create the bar chart
    const barChartSvg = barChart();
    document.getElementById('bar-chart').appendChild(barChartSvg);

    // Update bar chart on input
    d3.select(barChartSvg).on('input', function () {
        barChartSvg.update(this.value);
    });

    // Create histograms for different car attributes
    const columns = ['Cylinders', 'Displacement', 'Horsepower', 'Acceleration'];
    const histograms = columns.map(filteredHisto);
    histograms.forEach(histogram => document.getElementById('right').appendChild(histogram));

    // Update histograms on input
    histograms.forEach(histogram => {
        d3.select(histogram).on('input', function () {
            histogram.update(this.value);
        });
    });

    // Create brushable scatterplot
    const scatterplot = brushableScatterplot();
    document.getElementById('scatter-plot').appendChild(scatterplot);

    // Update scatterplot on input
    d3.select(scatterplot).on('input', function () {
        const value = scatterplot.value;
        barChartSvg.update(value);
        histograms.forEach(histogram => histogram.update(value));
    });
});
