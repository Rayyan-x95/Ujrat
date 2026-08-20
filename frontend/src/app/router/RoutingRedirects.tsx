import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export const RoutingRedirects = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const portalToken = params.get('portal');
    if (portalToken) {
      navigate(`/portal/${portalToken}`, { replace: true });
    }
  }, [location, navigate]);

  return null;
};
