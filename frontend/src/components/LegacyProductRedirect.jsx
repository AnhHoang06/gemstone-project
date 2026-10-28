import { Navigate, useLocation, useParams } from 'react-router-dom';
export default function LegacyProductRedirect() {
  const { id } = useParams();
  const { search } = useLocation();
  return <Navigate replace to={`${id ? `/product/${encodeURIComponent(id)}` : '/shop'}${search}`} />;
}
