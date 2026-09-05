import axios from 'axios';

// Replace this with the live Render URL if testing on a real device, 
// or use your local machine's IP (e.g. 192.168.x.x) if testing the backend// Use localhost for local dev. (Note: use your machine's IP like http://192.168.X.X:8000/api when testing on a physical phone)
export const API_URL = 'https://placement-tracker-backend-mh3o.onrender.com/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});
