import api from "../api/api";

export const cancelCustomerOrder = id => api.put(`/orders/${id}/cancel`);
