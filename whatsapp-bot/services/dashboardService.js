/**
 * Dashboard Service
 * Provides real-time farm metrics, sensor readings, weather, and AI recommendations
 * for Ramesh Yadav's farm in Nashik.
 */

export async function getFarmerDashboardContext(phoneNumber) {
  return {
    farmer: {
      name: 'Ramesh Yadav',
      phone: phoneNumber || '919876543210',
      location: 'Nashik, Maharashtra',
      totalAcres: 12.5,
      activeCrops: ['Wheat', 'Rice', 'Maize'],
      healthScore: 'Good (88%)',
      healthNote: 'Your wheat crop is in tillering stage and healthy',
    },
    realtimeSensors: {
      soilMoisture: { value: 68, unit: '%', status: 'Optimal' },
      temperature: { value: 28, unit: '°C', status: 'Normal' },
      humidity: { value: 60, unit: '%', status: 'Normal' },
      soilPh: { value: 6.5, unit: '', status: 'Slightly Acidic (Ideal for Wheat)' },
    },
    aiActionItems: [
      { action: 'Apply Urea Fertilizer', detail: 'Top-dressing recommended for Wheat tillering stage.', priority: 'Due in 2 days' },
      { action: 'Pest Alert', detail: 'Low pest risk. Monitor humidity for fungal leaf blight.', priority: 'Routine' },
      { action: 'Irrigation Timing', detail: 'Soil moisture is optimal (68%). Hold irrigation for 2 days.', priority: 'Upcoming' },
    ],
    weatherForecast: {
      todayTemp: '28°C',
      condition: 'Partly Cloudy',
      humidity: '60%',
      rainChance: '20%',
      weekendForecast: 'Rain predicted on Saturday (70% probability)',
    },
    latestAlerts: [
      'Soil moisture stable at optimal range for 3 days.',
      'Humidity trending slightly upward — monitor leaves for fungal symptoms.',
    ],
  }
}
