# Mumbai Digital Twin: Multi-Domain CO₂ & Climate Simulator

A high-fidelity, interactive "What-If" planning dashboard and atmospheric simulation engine tailored for Mumbai's major wards (Andheri, Bandra, Chembur, Colaba, Kurla). 

This tool is designed for urban planners to model, simulate, and analyze the complex, interconnected systems of demographics, transport, industrial output, and climate interventions before deploying capital.

---

## 🌟 The Core Philosophy: Multi-Domain Interdependency

In a real city, changing one variable causes a cascade of effects across other domains. This Digital Twin models these coupled systems:

```
[Population Spike (+20%)]
         │
         ├──► [Residential Carbon Output Increases] ──► [Local Heat Output Rises]
         │
         └──► [Traffic Density Scales Up] ──► [Road-cell CO₂ Plume Spikes]
                                                              │
   ┌──────────────────────────────────────────────────────────┘
   ▼
[Wind & Diffusion Solver] ──► [AQI & Temperature Index Calculation]
                               ▲
   ┌───────────────────────────┘
   ▼
[Interventions (Trees/DAC/Gardens)] ──► [Localized Carbon Absorption & Cool Down]
```

---

## 🛠️ Key Simulation Engines & Math Models

### 1. Demographics & Energy Domain
- **Residential/Commercial Emissions**: Modeled dynamically based on ward population density $P_{\text{ward}}$:
  $$E_{\text{res}} = P_{\text{ward}} \times (1 + \Delta \text{Population}) \times E_{\text{base\_residential}}$$
- **Energy Load Grid Impact**: Simulates power grid carbon output based on cooling needs matching ambient temperature.

### 2. Transport & Infrastructure Domain
- **Road Grid Cell Emissions**: Computes vehicular carbon emissions based on traffic volume $V$, congestion multipliers, and green transit policies:
  $$E_{\text{road}} = V \times (1 + \Delta \text{Traffic}) \times F_{\text{vehicle\_type}} \times \text{Congestion\_Factor}$$

### 3. Atmospheric Dispersion & Climate Domain (2D Canvas Grid)
- **Advection (Wind Drag)**: Disperses CO₂ particles along a user-defined wind vector $\vec{w} = (w_x, w_y)$ at 60 frames per second.
- **Diffusion (Laplacian spread)**: Simulates atmospheric gas dispersion from high concentration cells to neighboring lower concentration cells.
- **Urban Heat Island (UHI)**: Calculates localized air temperature based on concrete density, industrial waste heat, and evapotranspiration from green cells:
  $$T_{\text{local}} = T_{\text{base}} + \Delta T_{\text{industry}} - \Delta T_{\text{vegetation}}$$

### 4. Intervention Dynamics
- **Roadside Capture Units (RCUs)**: Removes up to 85% of CO₂ in immediate roadside cells; high cost, local effectiveness.
- **Direct Air Capture (DAC) Plants**: Heavy-duty point-source collectors. High energy draw, high capital expenditure, removes immense amounts of global ward carbon.
- **Urban Forests & Biofilters**: Captures carbon and cools air dynamically. Capture efficiency decreases during extreme heat (simulating plant stress) and stops during nighttime.

---

## 🚀 Main Features

* **Interactive Mumbai Ward Detail Selector**: Switch between:
  - **Andheri**: High traffic congestion, commercial/residential mix.
  - **Chembur**: High industrial density (refineries, power plants), heavy base emissions.
  - **Bandra**: Coastal wind characteristics, high commercial density, moderate greenery.
* **The "What-If" Planning Console**:
  - Sliders for population growth ($\pm 50\%$), traffic density ($\pm 50\%$), and industrial capacity.
  - Controls for wind speed, wind direction, and base ambient temperature.
* **Dynamic Canvas Visualizer**: Real-time atmospheric heatmap changing dynamically with wind currents.
* **Real-time Comparative Analytics**: Multi-line graphs plotting **Total Emissions vs. Total Capture**, and side-by-side scenario saving for baseline vs. intervention policies.
* **AI Optimizer Planner**: Automates the search for optimal tree-planting locations (prioritizing high-heat, low-green residential zones) and RCU placement (at highly congested traffic junctions).

---

## 📂 Project Structure

```
├── index.html     # Dashboard layout, UI elements, canvas, control inputs
├── style.css      # Custom futuristic dark glassmorphic styles and animations
├── app.js         # Simulation loop, physics solvers, UI bindings, Chart.js hooks
└── README.md      # Documentation and technical explanation
```

---

## 💻 Getting Started

To launch the Digital Twin locally:

1. Clone or download the project files into a directory.
2. Open `index.html` directly in any modern web browser (Chrome, Safari, Edge, Firefox).
3. Switch between wards using the Ward Selector, slide the "Traffic" or "Population" sliders, and watch the atmospheric heatmap adapt in real-time.
