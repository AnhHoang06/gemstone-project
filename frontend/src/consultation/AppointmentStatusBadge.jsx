import { appointmentLabels } from "./status";

export default function AppointmentStatusBadge({ status }) {
  return <span className={`appt-badge appt-badge--${status}`}>{appointmentLabels[status] || status}</span>;
}
