const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// API Endpoint to serve BKC GeoJSON buildings
app.get('/api/buildings', (req, res) => {
    const geojsonPath = path.join(__dirname, '../bkc_buildings.geojson');
    
    fs.readFile(geojsonPath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading geojson:', err);
            return res.status(500).json({ error: 'Failed to read building geometries' });
        }
        try {
            const geojson = JSON.parse(data);
            res.json(geojson);
        } catch (parseErr) {
            console.error('Error parsing geojson:', parseErr);
            res.status(500).json({ error: 'Failed to parse building geometries' });
        }
    });
});

// API Endpoint to serve BKC GeoJSON greenery/parks/trees
app.get('/api/greenery', (req, res) => {
    const geojsonPath = path.join(__dirname, '../bkc_greenery.geojson');
    
    fs.readFile(geojsonPath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading greenery geojson:', err);
            return res.status(500).json({ error: 'Failed to read greenery geometries' });
        }
        try {
            const geojson = JSON.parse(data);
            res.json(geojson);
        } catch (parseErr) {
            console.error('Error parsing greenery geojson:', parseErr);
            res.status(500).json({ error: 'Failed to parse greenery geometries' });
        }
    });
});



// Helper for HTTP GET requests
function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'BKCClimateTwin/1.0' } }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// API Endpoint to fetch live weather and AQI for BKC
app.get('/api/live-data', async (req, res) => {
    const lat = 19.0596;
    const lon = 72.8643;
    
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,wind_direction_10m`;
    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5,carbon_monoxide`;

    try {
        const [weatherData, aqiData] = await Promise.all([
            fetchJson(weatherUrl),
            fetchJson(aqiUrl)
        ]);

        const currentTemp = weatherData?.current?.temperature_2m ?? 30.0;
        const currentWindSpeed = weatherData?.current?.wind_speed_10m ?? 8.0;
        const currentWindDir = weatherData?.current?.wind_direction_10m ?? 225;
        
        const currentAqi = aqiData?.current?.us_aqi ?? 75;
        const currentPm25 = aqiData?.current?.pm2_5 ?? 24.0;
        const currentCo = aqiData?.current?.carbon_monoxide ?? 280.0;

        res.json({
            temp: currentTemp,
            windSpeed: currentWindSpeed,
            windDir: currentWindDir,
            aqi: currentAqi,
            pm25: currentPm25,
            co: currentCo,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('Error fetching live weather/AQI:', err);
        // Fallback default mock data
        res.json({
            temp: 30.0,
            windSpeed: 8.0,
            windDir: 225,
            aqi: 78,
            pm25: 25.0,
            co: 300.0,
            timestamp: new Date().toISOString(),
            isMock: true
        });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
