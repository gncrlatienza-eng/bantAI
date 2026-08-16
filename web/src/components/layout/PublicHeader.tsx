import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { Button } from '../common/Button';
import { ShieldLogo } from '../common/ShieldLogo';

export const PublicHeader: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="public-header">
      <Link to={ROUTES.HOME} className="brand-lockup">
        <ShieldLogo size={32} />
        <div className="brand-text">
          <strong>BantAI</strong>
          <small>Philippine Threat Intelligence</small>
        </div>
      </Link>

      <nav className="public-nav">
        <Link
          to={ROUTES.HOME}
          className={isActive(ROUTES.HOME) ? 'active' : ''}
        >
          Home
        </Link>
        <Link
          to={ROUTES.HOW_IT_WORKS}
          className={isActive(ROUTES.HOW_IT_WORKS) ? 'active' : ''}
        >
          How It Works
        </Link>
        <Link
          to={ROUTES.ABOUT}
          className={isActive(ROUTES.ABOUT) ? 'active' : ''}
        >
          About
        </Link>
        <Link
          to={ROUTES.RESEARCH}
          className={isActive(ROUTES.RESEARCH) ? 'active' : ''}
        >
          Research
        </Link>
      </nav>

      <div className="public-actions">
        <Button to={ROUTES.LOGIN} variant="ghost" size="sm">
          Log In
        </Button>
        <Button to={ROUTES.LICENSING} variant="primary" size="sm">
          Licensing
        </Button>
      </div>
    </header>
  );
};
