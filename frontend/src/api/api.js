import axios from "axios";

const api = axios.create({
    baseURL: "https://localhost:1111/api"
});

export default api;