// Global variables
let rawRssiData = [];
let timeData = [];
let fileInfo = {};
let originalData = null;
let chart = null;

// Drag selection variables
let isDragging = false;
let dragStartX = 0;
let dragEndX = 0;
let dragRect = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing...');
    setTimeout(() => {
        initializeChart();
        setupFileInput();
    }, 100);
});

function setupFileInput() {
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', handleFileSelect);
    console.log('File input setup complete');
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    console.log('Loading file:', file.name);
    updateStatus("Loading file...");

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            parseSubFile(e.target.result, file.name);
            originalData = {
                rawRssiData: [...rawRssiData],
                timeData: [...timeData],
                fileInfo: {...fileInfo}
            };

            console.log('Parsed data:', {
                dataPoints: rawRssiData.length,
                timePoints: timeData.length,
                sampleData: rawRssiData.slice(0, 10)
            });

            updateInfoDisplay();
            updatePlot();
            enableControls();
            updateStatus(`Loaded: ${file.name} (${rawRssiData.length.toLocaleString()} data points)`);
        } catch (error) {
            console.error('File loading error:', error);
            alert(`Failed to load file: ${error.message}`);
            updateStatus("Error loading file");
        }
    };
    reader.readAsText(file);
}

function parseSubFile(content, fileName) {
    console.log('Parsing file content...');

    // Initialize file info
    fileInfo = {
        'File': fileName,
        'Frequency': 'N/A',
        'Preset': 'N/A',
        'Protocol': 'N/A',
        'Filetype': 'Flipper SubGHz RAW File',
        'Version': '1'
    };

    // Parse header information
    const lines = content.split('\n');
    console.log('Total lines:', lines.length);

    for (let line of lines) {
        line = line.trim();
        if (line.startsWith('Frequency:')) {
            fileInfo['Frequency'] = line.split(':')[1].trim();
        } else if (line.startsWith('Preset:')) {
            fileInfo['Preset'] = line.split(':')[1].trim();
        } else if (line.startsWith('Protocol:')) {
            fileInfo['Protocol'] = line.split(':')[1].trim();
        } else if (line.startsWith('Filetype:')) {
            fileInfo['Filetype'] = line.split(':')[1].trim();
        } else if (line.startsWith('Version:')) {
            fileInfo['Version'] = line.split(':')[1].trim();
        }
    }

    // Extract RAW data - collect all RAW_Data lines
    rawRssiData = [];
    let rawDataLines = 0;

    for (let line of lines) {
        line = line.trim();
        if (line.startsWith('RAW_Data:')) {
            rawDataLines++;
            const dataStr = line.substring(9).trim(); // Remove 'RAW_Data:' prefix
            // Split by whitespace and convert to numbers
            const values = dataStr.split(/\s+/)
                .filter(x => x.trim() && x.trim() !== '-')
                .map(x => parseInt(x, 10))
                .filter(x => !isNaN(x));
            rawRssiData.push(...values);
        }
    }

    console.log('RAW_Data lines found:', rawDataLines);
    console.log('Total data points extracted:', rawRssiData.length);

    if (rawRssiData.length === 0) {
        throw new Error("No RAW_Data found in file or all values are invalid");
    }

    createTimeAxis();
}

function createTimeAxis() {
    if (rawRssiData.length === 0) return;

    console.log('Creating time axis...');

    // Calculate time axis from timing data
    const totalMicroseconds = rawRssiData.reduce((sum, value) => sum + Math.abs(value), 0);
    const duration = totalMicroseconds / 1_000_000; // Convert to seconds

    // Create time axis
    timeData = [];
    let currentTime = 0;
    for (let value of rawRssiData) {
        timeData.push(currentTime);
        currentTime += Math.abs(value) / 1_000_000;
    }

    console.log('Time axis created:', {
        duration: duration,
        timePoints: timeData.length,
        firstTime: timeData[0],
        lastTime: timeData[timeData.length - 1]
    });

    // Update file info
    fileInfo['Data Points'] = rawRssiData.length.toLocaleString();
    fileInfo['Duration'] = `${duration.toFixed(3)} seconds`;

    if (rawRssiData.length > 0) {
        const rssiMin = Math.min(...rawRssiData);
        const rssiMax = Math.max(...rawRssiData);
        fileInfo['RSSI Range'] = `${rssiMin} to ${rssiMax}`;
    }

    // Update trim controls
    document.getElementById('trimStart').value = '0';
    document.getElementById('trimEnd').value = duration.toFixed(3);
}

function initializeChart() {
    try {
        console.log('Initializing chart...');
        const canvas = document.getElementById('chart');
        if (!canvas) {
            console.error('Chart canvas not found');
            return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('Could not get canvas context');
            return;
        }

        // Destroy existing chart if it exists
        if (chart) {
            console.log('Destroying existing chart');
            chart.destroy();
        }

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        chart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#cccccc',
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: '#3a3a3a',
                        titleColor: '#cccccc',
                        bodyColor: '#cccccc',
                        borderColor: '#555555',
                        borderWidth: 1
                    },
                    zoom: {
                        zoom: {
                            wheel: {
                                enabled: true
                            },
                            pinch: {
                                enabled: true
                            },
                            mode: 'x'
                        },
                        pan: {
                            enabled: true,
                            mode: 'x'
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: {
                            display: true,
                            text: 'Time (seconds)',
                            color: '#cccccc'
                        },
                        ticks: {
                            color: '#cccccc'
                        },
                        grid: {
                            color: '#555555'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'RSSI Value',
                            color: '#cccccc'
                        },
                        ticks: {
                            color: '#cccccc'
                        },
                        grid: {
                            color: '#555555'
                        }
                    }
                },
                elements: {
                    point: {
                        radius: 0,
                        hoverRadius: 3
                    },
                    line: {
                        borderWidth: 1
                    }
                },
                animation: false
            }
        });

        // Setup drag selection
        setupDragSelection(canvas);

        console.log('Chart initialized successfully');
    } catch (error) {
        console.error('Chart initialization error:', error);
        updateStatus('Chart initialization failed: ' + error.message);
    }
}

function setupDragSelection(canvas) {
    // Remove existing listeners
    canvas.removeEventListener('mousedown', onCanvasMouseDown);
    canvas.removeEventListener('mousemove', onCanvasMouseMove);
    canvas.removeEventListener('mouseup', onCanvasMouseUp);
    canvas.removeEventListener('mouseleave', onCanvasMouseLeave);

    // Add new listeners
    canvas.addEventListener('mousedown', onCanvasMouseDown);
    canvas.addEventListener('mousemove', onCanvasMouseMove);
    canvas.addEventListener('mouseup', onCanvasMouseUp);
    canvas.addEventListener('mouseleave', onCanvasMouseLeave);

    // Create drag rectangle
    if (!dragRect) {
        dragRect = document.createElement('div');
        dragRect.id = 'dragSelectRect';
        dragRect.style.cssText = `
            position: absolute;
            border: 2px dashed #00d4aa;
            background-color: rgba(0, 212, 170, 0.25);
            pointer-events: none;
            display: none;
            z-index: 1000;
        `;
        document.body.appendChild(dragRect);
    }
}

function getMaxDataPoints() {
    const limitSelect = document.getElementById('dataPointsLimit');
    const selectedValue = limitSelect.value;

    if (selectedValue === 'ALL') {
        return Infinity; // No limit
    }

    return parseInt(selectedValue, 10);
}

function updatePlot() {
    if (!chart) {
        console.error('Chart not initialized');
        return;
    }

    if (rawRssiData.length === 0 || timeData.length === 0) {
        console.log('No data to plot');
        return;
    }

    console.log('Updating plot with data:', {
        dataPoints: rawRssiData.length,
        timePoints: timeData.length
    });

    try {
        const showPositive = document.getElementById('showPositive').checked;
        const showNegative = document.getElementById('showNegative').checked;
        const autoScale = document.getElementById('autoScale').checked;
        const maxPoints = getMaxDataPoints();

        console.log('Max points setting:', maxPoints);

        // Clear existing datasets
        chart.data.datasets = [];

        if (!showPositive && !showNegative) {
            chart.update('none');
            return;
        }

        let datasets = [];

        if (showPositive && showNegative) {
            // Separate positive and negative values
            const positiveData = [];
            const negativeData = [];

            for (let i = 0; i < rawRssiData.length; i++) {
                const point = { x: timeData[i], y: rawRssiData[i] };
                if (rawRssiData[i] >= 0) {
                    positiveData.push(point);
                } else {
                    negativeData.push(point);
                }
            }

            console.log('Data separation:', {
                positive: positiveData.length,
                negative: negativeData.length
            });

            if (positiveData.length > 0) {
                let sampledPositive;
                if (maxPoints === Infinity || positiveData.length <= maxPoints) {
                    sampledPositive = positiveData;
                } else {
                    const step = Math.max(1, Math.floor(positiveData.length / maxPoints));
                    sampledPositive = positiveData.filter((_, index) => index % step === 0);
                }

                datasets.push({
                    label: 'Positive values',
                    data: sampledPositive,
                    borderColor: '#00d4aa',
                    backgroundColor: 'transparent',
                    pointRadius: 0,
                    pointHoverRadius: 3,
                    spanGaps: true
                });
            }

            if (negativeData.length > 0) {
                let sampledNegative;
                if (maxPoints === Infinity || negativeData.length <= maxPoints) {
                    sampledNegative = negativeData;
                } else {
                    const step = Math.max(1, Math.floor(negativeData.length / maxPoints));
                    sampledNegative = negativeData.filter((_, index) => index % step === 0);
                }

                datasets.push({
                    label: 'Negative values',
                    data: sampledNegative,
                    borderColor: '#ff6b6b',
                    backgroundColor: 'transparent',
                    pointRadius: 0,
                    pointHoverRadius: 3,
                    spanGaps: true
                });
            }
        } else {
            // Single type
            const filteredData = [];
            for (let i = 0; i < rawRssiData.length; i++) {
                const value = rawRssiData[i];
                if ((showPositive && value >= 0) || (showNegative && value < 0)) {
                    filteredData.push({ x: timeData[i], y: value });
                }
            }

            if (filteredData.length > 0) {
                let sampledData;
                if (maxPoints === Infinity || filteredData.length <= maxPoints) {
                    sampledData = filteredData;
                } else {
                    const step = Math.max(1, Math.floor(filteredData.length / maxPoints));
                    sampledData = filteredData.filter((_, index) => index % step === 0);
                }

                const color = showPositive ? '#00d4aa' : '#ff6b6b';
                datasets.push({
                    label: showPositive ? 'Positive values' : 'Negative values',
                    data: sampledData,
                    borderColor: color,
                    backgroundColor: 'transparent',
                    pointRadius: 0,
                    pointHoverRadius: 3,
                    spanGaps: true
                });
            }
        }

        console.log('Created datasets:', datasets.length);
        datasets.forEach((dataset, i) => {
            console.log(`Dataset ${i}:`, {
                label: dataset.label,
                dataPoints: dataset.data.length,
                firstPoint: dataset.data[0],
                lastPoint: dataset.data[dataset.data.length - 1]
            });
        });

        chart.data.datasets = datasets;

        // Update scaling
        if (autoScale && datasets.length > 0) {
            let allValues = [];
            datasets.forEach(dataset => {
                allValues = allValues.concat(dataset.data.map(point => point.y));
            });

            if (allValues.length > 0) {
                const min = Math.min(...allValues);
                const max = Math.max(...allValues);
                const padding = Math.max(1, (max - min) * 0.05);
                chart.options.scales.y.min = min - padding;
                chart.options.scales.y.max = max + padding;
                console.log('Y-axis range:', min - padding, 'to', max + padding);
            }
        } else {
            delete chart.options.scales.y.min;
            delete chart.options.scales.y.max;
        }

        // Force update
        chart.update('active');

        // Update status with downsampling info
        const totalDisplayedPoints = datasets.reduce((sum, dataset) => sum + dataset.data.length, 0);
        const limitStr = maxPoints === Infinity ? 'ALL' : maxPoints.toLocaleString();

        if (maxPoints === Infinity) {
            updateStatus(`Displaying ALL ${totalDisplayedPoints.toLocaleString()} data points`);
        } else if (rawRssiData.length > totalDisplayedPoints) {
            updateStatus(`Displaying ${totalDisplayedPoints.toLocaleString()} of ${rawRssiData.length.toLocaleString()} points (Limit: ${limitStr})`);
        } else {
            updateStatus(`Displaying ${totalDisplayedPoints.toLocaleString()} data points (Limit: ${limitStr})`);
        }

        console.log('Plot update completed successfully');

    } catch (error) {
        console.error('Plot update error:', error);
        updateStatus('Error updating plot: ' + error.message);
    }
}

// Drag selection functions
function getChartRelativePosition(event) {
    const canvas = document.getElementById('chart');
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    return { x, top: rect.top, left: rect.left, rect };
}

function onCanvasMouseDown(event) {
    if (event.button !== 0) return;
    if (event.ctrlKey || event.shiftKey) return;

    isDragging = true;
    const pos = getChartRelativePosition(event);
    dragStartX = pos.x;
    dragEndX = pos.x;

    positionDragRect();
    dragRect.style.display = 'block';
    event.preventDefault();
}

function onCanvasMouseMove(event) {
    if (!isDragging) return;
    const pos = getChartRelativePosition(event);
    dragEndX = pos.x;
    positionDragRect();
}

function onCanvasMouseUp(event) {
    if (!isDragging) return;
    isDragging = false;
    dragRect.style.display = 'none';

    if (!chart || !chart.scales || !chart.scales.x) return;

    const xScale = chart.scales.x;
    let xStart = xScale.getValueForPixel(dragStartX);
    let xEnd = xScale.getValueForPixel(dragEndX);

    if (xEnd < xStart) {
        const tmp = xStart;
        xStart = xEnd;
        xEnd = tmp;
    }

    if (Math.abs(dragEndX - dragStartX) < 5) {
        return;
    }

    const maxTime = timeData.length > 0 ? timeData[timeData.length - 1] : 0;
    xStart = Math.max(0, xStart);
    xEnd = Math.min(maxTime, xEnd);

    document.getElementById('trimStart').value = xStart.toFixed(3);
    document.getElementById('trimEnd').value = xEnd.toFixed(3);

    updateStatus(`Selection: ${xStart.toFixed(3)}s - ${xEnd.toFixed(3)}s (Click Apply Trim to confirm)`);
}

function onCanvasMouseLeave(event) {
    if (isDragging) {
        isDragging = false;
        dragRect.style.display = 'none';
    }
}

function positionDragRect() {
    const canvas = document.getElementById('chart');
    const canvasRect = canvas.getBoundingClientRect();
    const startX = Math.min(dragStartX, dragEndX);
    const width = Math.abs(dragEndX - dragStartX);

    dragRect.style.top = canvasRect.top + window.scrollY + 'px';
    dragRect.style.left = (canvasRect.left + window.scrollX + startX) + 'px';
    dragRect.style.height = canvasRect.height + 'px';
    dragRect.style.width = width + 'px';
}

// Rest of the functions remain the same...
function applyTrim() {
    const startTime = parseFloat(document.getElementById('trimStart').value);
    const endTime = parseFloat(document.getElementById('trimEnd').value);

    if (startTime >= endTime) {
        alert("Start time must be less than end time");
        return;
    }

    if (startTime < 0 || endTime < 0) {
        alert("Times must be positive");
        return;
    }

    if (!confirm("This will trim the data (use Reset Data to restore). Proceed?")) {
        return;
    }

    const startIdx = timeData.findIndex(time => time >= startTime);
    const endIdx = timeData.findIndex(time => time >= endTime);

    const actualStartIdx = startIdx === -1 ? 0 : startIdx;
    const actualEndIdx = endIdx === -1 ? rawRssiData.length : endIdx;

    rawRssiData = rawRssiData.slice(actualStartIdx, actualEndIdx);
    timeData = timeData.slice(actualStartIdx, actualEndIdx).map(time => time - startTime);

    document.getElementById('trimStart').value = '0';
    document.getElementById('trimEnd').value = (endTime - startTime).toFixed(3);

    createTimeAxis();
    updateInfoDisplay();
    updatePlot();
    updateStatus(`Data trimmed to ${startTime.toFixed(3)}s - ${endTime.toFixed(3)}s`);
}

function resetData() {
    if (originalData) {
        rawRssiData = [...originalData.rawRssiData];
        timeData = [...originalData.timeData];
        fileInfo = {...originalData.fileInfo};

        createTimeAxis();
        updateInfoDisplay();
        updatePlot();
        updateStatus("Data reset to original");
    }
}

function zoomFit() {
    if (chart && chart.resetZoom) {
        chart.resetZoom();
        updateStatus("Zoomed to fit data");
    }
}

function showStatistics() {
    if (rawRssiData.length === 0) {
        alert("No data loaded");
        return;
    }

    const rssiArray = rawRssiData;
    const mean = rssiArray.reduce((sum, val) => sum + val, 0) / rssiArray.length;
    const sortedArray = [...rssiArray].sort((a, b) => a - b);
    const median = sortedArray[Math.floor(sortedArray.length / 2)];
    const variance = rssiArray.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / rssiArray.length;
    const stdDev = Math.sqrt(variance);
    const min = Math.min(...rssiArray);
    const max = Math.max(...rssiArray);
    const range = max - min;

    const positiveCount = rssiArray.filter(val => val > 0).length;
    const negativeCount = rssiArray.filter(val => val < 0).length;
    const zeroCount = rssiArray.filter(val => val === 0).length;

    const duration = timeData.length > 0 ? timeData[timeData.length - 1] : 0;

    const stats = `RSSI Signal Statistics:

Total Data Points: ${rssiArray.length.toLocaleString()}
Duration: ${duration.toFixed(3)} seconds

RSSI Statistics:
  Mean: ${mean.toFixed(2)}
  Median: ${median.toFixed(2)}
  Standard Deviation: ${stdDev.toFixed(2)}
  Min Value: ${min}
  Max Value: ${max}
  Range: ${range}

Value Distribution:
  Positive Values: ${positiveCount.toLocaleString()} (${(positiveCount / rssiArray.length * 100).toFixed(1)}%)
  Negative Values: ${negativeCount.toLocaleString()} (${(negativeCount / rssiArray.length * 100).toFixed(1)}%)
  Zero Values: ${zeroCount.toLocaleString()} (${(zeroCount / rssiArray.length * 100).toFixed(1)}%)`;

    document.getElementById('statsContent').textContent = stats;
    document.getElementById('statsModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('statsModal').style.display = 'none';
}

function exportData() {
    if (rawRssiData.length === 0) {
        alert("No data to export");
        return;
    }

    let content = `Filetype: ${fileInfo.Filetype}\n`;
    content += `Version: ${fileInfo.Version}\n`;
    content += `Frequency: ${fileInfo.Frequency}\n`;
    content += `Preset: ${fileInfo.Preset}\n`;
    content += `Protocol: ${fileInfo.Protocol}\n`;

    const rawStr = rawRssiData.join(' ');
    const maxCharsPerLine = 100;
    const words = rawStr.split(' ');

    let currentLine = '';
    for (const word of words) {
        if (currentLine.length + word.length + 1 > maxCharsPerLine && currentLine) {
            content += `RAW_Data: ${currentLine}\n`;
            currentLine = word;
        } else {
            if (currentLine) {
                currentLine += ' ' + word;
            } else {
                currentLine = word;
            }
        }
    }

    if (currentLine) {
        content += `RAW_Data: ${currentLine}\n`;
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    const fileName = fileInfo.File ? fileInfo.File.replace(/\.[^/.]+$/, '') : 'rssi_data';
    a.download = `${fileName}_trimmed.sub`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    updateStatus("Data exported as .sub file");
}

function updateInfoDisplay() {
    const mapping = {
        'File': 'infoFile',
        'Frequency': 'infoFrequency',
        'Preset': 'infoPreset',
        'Protocol': 'infoProtocol',
        'Data Points': 'infoDataPoints',
        'Duration': 'infoDuration',
        'RSSI Range': 'infoRSSIRange'
    };

    Object.keys(mapping).forEach(key => {
        const element = document.getElementById(mapping[key]);
        if (element && fileInfo[key]) {
            element.textContent = fileInfo[key];
        }
    });
}

function updateStatus(message) {
    const statusBar = document.getElementById('statusBar');
    if (statusBar) {
        statusBar.textContent = message;
    }
    console.log('Status:', message);
}

function enableControls() {
    const buttons = ['exportBtn', 'trimBtn', 'resetBtn', 'zoomBtn', 'statsBtn'];
    buttons.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.disabled = false;
        }
    });
}

// Event listeners
window.onclick = function(event) {
    const modal = document.getElementById('statsModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
};

window.addEventListener('resize', function() {
    if (chart) {
        chart.resize();
    }
});
